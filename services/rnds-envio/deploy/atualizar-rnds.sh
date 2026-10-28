#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Atualiza o serviço de envio à RNDS no VPS a partir do master (5C-5.3c).
# Mesmo modelo do update-hermes.sh: teste de saúde depois de subir e volta à
# imagem anterior se falhar. Cron do root, 04:10 (depois do Hermes, às 04:00):
#   10 4 * * * /home/rnds/deploy/atualizar-rnds.sh >> /home/rnds/logs/atualizar.log 2>&1
#
# Lê o clone /opt/chefe-coruja (o mesmo do Hermes) SEM mexer no HEAD dele:
# só `git fetch` e `git archive origin/master`. O update-hermes.sh compara o
# HEAD com o origin/master e continua vendo a novidade.
# Só sobe quando muda algo em services/rnds-envio ou src/interop/fhir.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CLONE=/opt/chefe-coruja
DEPLOY=/home/rnds/deploy
CAMINHOS=(services/rnds-envio src/interop/fhir)
COMPOSE=(docker compose -f "$DEPLOY/docker-compose.yml" --project-directory "$DEPLOY")
agora() { date -u +%Y-%m-%dT%H:%M:%SZ; }

git -C "$CLONE" fetch --quiet origin master
novo=$(git -C "$CLONE" log -1 --format=%H origin/master -- "${CAMINHOS[@]}")
atual=$(cat "$DEPLOY/.versao" 2>/dev/null || echo nenhum)
if [ "$novo" = "$atual" ] && [ "${1:-}" != "--forcar" ]; then
  echo "$(agora) nada novo ($atual)"
  exit 0
fi
echo "$(agora) atualizando $atual -> $novo"

# código novo numa pasta à parte; troca só depois de copiar inteiro
rm -rf "$DEPLOY/app.novo"
mkdir -p "$DEPLOY/app.novo"
git -C "$CLONE" archive "$novo" "${CAMINHOS[@]}" | tar -x -C "$DEPLOY/app.novo"
# o compose do VPS é o do repositório
cp "$DEPLOY/app.novo/services/rnds-envio/deploy/docker-compose.yml" "$DEPLOY/docker-compose.yml.novo"

# guarda a imagem em uso para a volta
if docker image inspect rnds-envio:latest >/dev/null 2>&1; then
  docker tag rnds-envio:latest rnds-envio:anterior
fi
rm -rf "$DEPLOY/app.anterior"
[ -d "$DEPLOY/app" ] && mv "$DEPLOY/app" "$DEPLOY/app.anterior"
mv "$DEPLOY/app.novo" "$DEPLOY/app"
[ -f "$DEPLOY/docker-compose.yml" ] && cp "$DEPLOY/docker-compose.yml" "$DEPLOY/docker-compose.yml.anterior"
mv "$DEPLOY/docker-compose.yml.novo" "$DEPLOY/docker-compose.yml"

"${COMPOSE[@]}" build --quiet
"${COMPOSE[@]}" up -d

# teste de saúde: o envio só fica "healthy" depois de um ciclo que falou com a fila
for _ in $(seq 1 24); do
  estado=$(docker inspect --format '{{.State.Health.Status}}' rnds-envio 2>/dev/null || echo ausente)
  [ "$estado" = healthy ] && break
  sleep 5
done

if [ "$estado" = healthy ]; then
  echo "$novo" > "$DEPLOY/.versao"
  echo "$(agora) ok: $novo saudável"
  exit 0
fi

echo "$(agora) FALHOU o teste de saúde ($estado); voltando"
"${COMPOSE[@]}" logs --tail 30 envio || true
if docker image inspect rnds-envio:anterior >/dev/null 2>&1 && [ -d "$DEPLOY/app.anterior" ]; then
  rm -rf "$DEPLOY/app" && mv "$DEPLOY/app.anterior" "$DEPLOY/app"
  [ -f "$DEPLOY/docker-compose.yml.anterior" ] && mv "$DEPLOY/docker-compose.yml.anterior" "$DEPLOY/docker-compose.yml"
  docker tag rnds-envio:anterior rnds-envio:latest
  "${COMPOSE[@]}" up -d --no-build
  echo "$(agora) voltou para $atual"
else
  "${COMPOSE[@]}" stop envio
  echo "$(agora) sem versão anterior: envio parado"
fi
exit 1
