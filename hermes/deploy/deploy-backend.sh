#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy do backend Hermes — Skill API (C1) — 23/08
# Rodar como root na VPS, na pasta /home/hermes/deploy
#
# Passos:
#   1. Gera SKILL_API_TOKEN (se ainda não existir no .env.prod)
#   2. Rebuild + sobe o container hermes-app
#   3. Verifica /skill/consulta → 401 (token ausente) = rota no ar
#   4. Grava o token no ambiente do Nous (/home/hermes/.agent.extra.env,
#      HERMES_SKILL_TOKEN), sem imprimir o valor (S8, D6). Vale no próximo
#      `sh recriar-agente.sh`.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd /home/hermes/deploy

if ! grep -q '^SKILL_API_TOKEN=' .env.prod; then
  TOKEN="$(openssl rand -hex 32)"
  printf '\n# Skill API (POST /skill/consulta) — token das skills da Corujinha\nSKILL_API_TOKEN=%s\n' "$TOKEN" >> .env.prod
  echo "[ok] SKILL_API_TOKEN adicionado ao .env.prod"
else
  echo "[ok] SKILL_API_TOKEN já existe no .env.prod (mantido)"
fi

echo "[...] rebuild + up do hermes-app"
docker compose -f docker-compose.prod.yml up -d --build app 2>&1 | tail -3

echo "[...] aguardando healthcheck"
for i in $(seq 1 20); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/skill/consulta || true)"
  if [ "$CODE" = "401" ]; then
    echo "[ok] /skill/consulta responde 401 sem token — rota ativa e protegida"
    break
  fi
  sleep 2
done
if [ "$CODE" != "401" ]; then
  echo "[ERRO] /skill/consulta respondeu $CODE (esperado 401). Verifique os logs."
  docker compose -f docker-compose.prod.yml logs app --tail 30
  exit 1
fi

# S8 (D6): o token vai direto para o arquivo do Nous; o valor nunca aparece no terminal
EXTRA=/home/hermes/.agent.extra.env
( umask 077
  touch "$EXTRA"
  grep -v '^HERMES_SKILL_TOKEN=' "$EXTRA" > "$EXTRA.tmp" || true
  printf 'HERMES_SKILL_TOKEN=%s\n' "$(grep '^SKILL_API_TOKEN=' .env.prod | cut -d= -f2 | tr -d '\r')" >> "$EXTRA.tmp"
  mv "$EXTRA.tmp" "$EXTRA" )
chown hermes:hermes "$EXTRA" && chmod 600 "$EXTRA"
echo "---"
echo "[ok] HERMES_SKILL_TOKEN gravado em $EXTRA (valor não exibido)."
echo "     Para valer no Nous: sh /home/hermes/deploy/recriar-agente.sh (como hermes)."
