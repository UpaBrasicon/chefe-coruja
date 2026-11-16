#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Preparo do ensaio ou da demo (backlog comercial, item 1). Rodar NO DIA, até
# uma hora antes, entre 7h e 18h50. SÓ NA HOMOLOGAÇÃO (projeto ligado).
#   1. 02_plantao_agora.sql: plantão de agora, 17 pacientes, 8 de 11 leitos;
#   2. 03_acesso_conta.sql com a conta @chefecoruja.com.br ("Equipe Chefe
#      Coruja"): escala de hoje no Pronto Socorro e os quatro papéis. O e-mail
#      é lido da homologação na hora: não fica no git nem aparece na tela;
#   3. conferência: pacientes na unidade e plantões de hoje da conta.
# Uso: bash scripts/demo/preparar-ensaio.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
node scripts/ambiente/supabase-alvo.mjs qual | grep -q homolog || { echo "RECUSADO: o projeto ligado não é a homologação"; exit 1; }
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
consulta() { npx supabase db query --linked -f "$1" 2>/dev/null | python -c "import sys,json; t=sys.stdin.read(); d=json.JSONDecoder().raw_decode(t[t.index('{'):])[0]; print(json.dumps(d['rows'], ensure_ascii=False))"; }

echo "select email from auth.users where email ilike '%@chefecoruja.com.br' limit 1;" > "$T/email.sql"
EMAIL=$(consulta "$T/email.sql" | python -c "import sys,json; print(json.load(sys.stdin)[0]['email'])")
sed "s/TROQUE-PELO-SEU-EMAIL@exemplo.com/$EMAIL/" scripts/demo/03_acesso_conta.sql > "$T/03.sql"

echo "== 02 plantão de agora"; npx supabase db query --linked -f scripts/demo/02_plantao_agora.sql 2>&1 | grep -E "ERROR" || echo ok
echo "== 03 acesso da conta"; npx supabase db query --linked -f "$T/03.sql" 2>&1 | grep -E "ERROR" || echo ok

cat > "$T/conf.sql" <<'SQL'
with u as (select id from public.unidades where nome ilike '%Jardim Primavera%' limit 1),
c as (select id from auth.users where email ilike '%@chefecoruja.com.br')
select (select count(*) from public.pacientes p, u where p.unidade_id = u.id) as pacientes,
       (select count(*) from public.escala_plantao e, u where e.unidade_id = u.id and e.ativo
          and e.perfil_id in (select id from c) and e.data = private.data_atual()) as plantoes_hoje_da_conta;
SQL
echo "== conferência"; consulta "$T/conf.sql"
