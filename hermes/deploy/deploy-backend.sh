#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy do backend Hermes — Skill API (C1) — 23/08
# Rodar como root na VPS, na pasta /home/hermes/deploy
#
# Passos:
#   1. Gera SKILL_API_TOKEN (se ainda não existir no .env.prod)
#   2. Rebuild + sobe o container hermes-app
#   3. Verifica /skill/consulta → 401 (token ausente) = rota no ar
#   4. Imprime o token para colar no ambiente do Nous
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

echo "---"
echo "TOKEN PARA O NOUS (cole no .env do Nous como HERMES_SKILL_TOKEN):"
grep '^SKILL_API_TOKEN=' .env.prod | cut -d= -f2
