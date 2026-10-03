#!/bin/sh
# Tira os vigias do cron do Nous (volta atrás da etapa 2). Rodar NA VPS, como hermes:
#   sh remover.sh              → remove os jobs coruja-* (os scripts e logs ficam)
#   sh remover.sh --arquivos   → também apaga /opt/data/scripts/coruja-vigias
# Os registros da sombra (/opt/data/logs/vigias-sombra) NUNCA são apagados aqui.
# Depois de remover, religar os crons do Hermes: tirar HERMES_CRONS=0 do
# .env.prod e recriar o hermes-app (README, "Volta atrás").
set -eu
C="${NOUS_CONTAINER:-hermes-agent}"
DEST=/opt/data/scripts/coruja-vigias

docker exec "$C" test -f "$DEST/agenda.py" || { echo "agenda.py não está em $DEST: nada instalado?" >&2; exit 1; }

docker exec "$C" python3 "$DEST/agenda.py" linhas | while IFS="$(printf '\t')" read -r NOME SCRIPT EXPR; do
  [ -n "$NOME" ] || continue
  IDS="$(docker exec "$C" python3 "$DEST/agenda.py" ids "$NOME")"
  if [ -z "$IDS" ]; then
    echo "não existe: $NOME"
    continue
  fi
  for ID in $IDS; do
    docker exec "$C" hermes cron remove "$ID" </dev/null
    echo "removido: $NOME ($ID)"
  done
done

if [ "${1:-}" = "--arquivos" ]; then
  docker exec "$C" rm -rf "$DEST"
  echo "scripts apagados de $DEST (logs mantidos)"
fi
