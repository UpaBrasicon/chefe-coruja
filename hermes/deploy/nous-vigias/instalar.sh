#!/bin/sh
# Instala os vigias no cron do Nous (etapa 2 da migração Hermes → Nous).
# Rodar NA VPS, como hermes, de dentro desta pasta (ou de qualquer lugar):
#   sh instalar.sh
# O que faz:
#   1. confere que o hermes-agent tem HERMES_PG_JOB_URL no ambiente (sem mostrar);
#   2. copia os scripts para /opt/data/scripts/coruja-vigias no contêiner
#      (= /home/hermes/.hermes/scripts/coruja-vigias no host), com o dono do
#      contêiner (uid 10000) — por isso vai por `tar | docker exec`;
#   3. cria um job --no-agent por vigia, com os horários do agendador.ts
#      convertidos para o fuso do cron do Nous (agenda.py). Job que já existe
#      com o mesmo nome é pulado (idempotente). --deliver local: nada vai ao
#      Telegram nem em falha (a falha fica em `hermes cron list` e no
#      /opt/data/cron/output).
# Não liga o modo valer: isso é VIGIAS_MODO no ~/.agent.extra.env (README).
set -eu
C="${NOUS_CONTAINER:-hermes-agent}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
DEST=/opt/data/scripts/coruja-vigias

docker inspect "$C" >/dev/null 2>&1 || { echo "contêiner $C não encontrado" >&2; exit 1; }

if ! docker exec "$C" sh -c 'test -n "${HERMES_PG_JOB_URL:-}"'; then
  echo "o $C não tem HERMES_PG_JOB_URL no ambiente: ponha a linha no ~/.agent.extra.env e rode recriar-agente.sh (README)" >&2
  exit 1
fi
# Tudo dentro do contêiner roda com o dono de /opt/data (o uid do Nous, 10000),
# senão o cron do Nous não consegue gravar o registro da sombra nem o jobs.json.
U="$(docker exec "$C" stat -c %u:%g /opt/data)"
MODO="$(docker exec "$C" sh -c 'echo "${VIGIAS_MODO:-sombra}"')"
echo "modo dos vigias no $C: $MODO"

# 2. cópia (sem testes, sem os .sh, sem cache)
tar -C "$AQUI" --exclude='./tests' --exclude='__pycache__' --exclude='*.sh' --exclude='*.md' -cf - . \
  | docker exec -i -u "$U" "$C" sh -c "mkdir -p $DEST /opt/data/logs/vigias-sombra /opt/data/logs/vigias /opt/data/maestro-saida && chmod 755 /opt/data/maestro-saida && tar -xf - -C $DEST"
echo "scripts copiados para $DEST"

# O cron roda .py com o MESMO python do Nous (sys.executable), que tem asyncpg.
# Aqui só avisamos se nenhum python do PATH enxerga o asyncpg (o compara.py precisa).
if ! docker exec "$C" sh -c 'for p in python3 /opt/hermes/.venv/bin/python /opt/hermes/venv/bin/python; do command -v $p >/dev/null 2>&1 && $p -c "import asyncpg" 2>/dev/null && exit 0; done; exit 1'; then
  echo "AVISO: nenhum python do PATH importa asyncpg; o cron usa o python do próprio Nous, mas o compara.py precisa de um que importe" >&2
fi

echo "fuso do cron do Nous: $(docker exec "$C" python3 "$DEST/agenda.py" fuso)"

# 3. jobs (idempotente)
docker exec "$C" python3 "$DEST/agenda.py" linhas | while IFS="$(printf '\t')" read -r NOME SCRIPT EXPR; do
  [ -n "$NOME" ] || continue
  if [ -n "$(docker exec "$C" python3 "$DEST/agenda.py" ids "$NOME")" ]; then
    echo "já existe: $NOME (pulado)"
    continue
  fi
  docker exec -u "$U" "$C" hermes cron create "$EXPR" --no-agent --script "$SCRIPT" --name "$NOME" --deliver local </dev/null
  echo "criado: $NOME  [$EXPR]  $SCRIPT"
done

echo "pronto. Conferir: docker exec $C hermes cron list"
echo "teste manual (sombra, não grava): docker exec $C hermes cron run coruja-cadeia_auditoria"
