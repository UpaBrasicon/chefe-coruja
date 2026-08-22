#!/usr/bin/env bash
# Seed de telefones (teste) + validação E2E do fluxo 200 (23/08)
set -uo pipefail
SB_URL=$(grep '^SUPABASE_URL=' /home/hermes/deploy/.env.prod | cut -d= -f2 | tr -d '\r')
SB_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /home/hermes/deploy/.env.prod | cut -d= -f2 | tr -d '\r')
TOKEN=$(grep '^SKILL_API_TOKEN=' /home/hermes/deploy/.env.prod | cut -d= -f2 | tr -d '\r')

echo "=== 1. Seed telefones (Admin/Gestor/Plantonista Teste) ==="
curl -s -m 20 -X PATCH "$SB_URL/rest/v1/perfis?id=eq.c5ad3d56-5258-4039-9e26-3d830a828cf5" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" -H 'Content-Type: application/json' \
  -d '{"telefone":"+5511999990001"}' -w 'HTTP:%{http_code}\n' -o /dev/null
curl -s -m 20 -X PATCH "$SB_URL/rest/v1/perfis?id=eq.da6c5d33-a123-4960-a494-a00c883906a1" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" -H 'Content-Type: application/json' \
  -d '{"telefone":"+5511999990002"}' -w 'HTTP:%{http_code}\n' -o /dev/null
curl -s -m 20 -X PATCH "$SB_URL/rest/v1/perfis?id=eq.df02d652-070f-4e2d-be82-18e432f128f7" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" -H 'Content-Type: application/json' \
  -d '{"telefone":"+5511999990003"}' -w 'HTTP:%{http_code}\n' -o /dev/null

echo "=== 2. E2E: ADMIN Teste (wa_id 5511999990001) — aguia resumo (esperado: dados) ==="
docker exec -e HERMES_BACKEND_URL=http://hermes-app:3000 -e HERMES_SKILL_TOKEN="$TOKEN" -e CORUJA_WA_ID="5511999990001" hermes-agent \
  bash /opt/data/skills/chefe-coruja-athena/scripts/aguia.sh resumo 2>&1 | head -c 400
echo ""

echo "=== 3. E2E: PLANTONISTA Teste (5511999990003) — sentinela alertas (esperado: negado genérico) ==="
docker exec -e HERMES_BACKEND_URL=http://hermes-app:3000 -e HERMES_SKILL_TOKEN="$TOKEN" -e CORUJA_WA_ID="5511999990003" hermes-agent \
  bash /opt/data/skills/chefe-coruja-sentinela/scripts/sentinela.sh alertas 2>&1 | head -c 300
echo ""

echo "=== 4. E2E: GESTOR Teste (5511999990002) — escala meus_plantoes (esperado: dados do próprio perfil) ==="
docker exec -e HERMES_BACKEND_URL=http://hermes-app:3000 -e HERMES_SKILL_TOKEN="$TOKEN" -e CORUJA_WA_ID="5511999990002" hermes-agent \
  bash /opt/data/skills/chefe-coruja/scripts/escala.sh meus_plantoes 2>&1 | head -c 400
echo ""
