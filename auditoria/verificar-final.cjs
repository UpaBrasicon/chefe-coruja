// Verificação final pós-correções — Bloco 14 + checagens específicas.
// Uso: node auditoria/verificar-final.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

const QUERIES = {
  placar: `select 'Tabelas sem RLS' as item, count(*) as qtd, 'deve ser 0' as meta from pg_tables where schemaname='public' and rowsecurity=false
union all select 'Policies liberando tudo (true)', count(*), 'deve ser 0' from pg_policies where schemaname='public' and (qual='true' or with_check='true')
union all select 'auth.uid() sem (select ...)', count(*), 'deve ser 0' from pg_policies where schemaname='public' and (qual ~* '(?<!select )auth\\.(uid|jwt|role)\\(\\)' or with_check ~* '(?<!select )auth\\.(uid|jwt|role)\\(\\)')
union all select 'SECURITY DEFINER sem search_path', count(*), 'deve ser 0' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname='public' and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
union all select 'Views SECURITY DEFINER', count(*), 'deve ser 0' from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m') and coalesce(c.reloptions::text,'') !~ 'security_invoker=(true|on)'
union all select 'FKs sem índice', count(*), 'perto de 0' from pg_constraint ct join pg_class c on c.oid=ct.conrelid join pg_namespace n on n.oid=c.relnamespace where ct.contype='f' and n.nspname='public' and not exists (select 1 from pg_index x where x.indrelid=ct.conrelid and x.indkey[0]=ct.conkey[1]);`,
  truncate_restante: `select count(*) as qtd from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type='TRUNCATE';`,
  anon_grants: `select distinct privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='anon' order by 1;`,
  auth_uid_solto: `select tablename, policyname, cmd from pg_policies where schemaname='public' and (qual ~* '(?<!select )auth\\.uid\\(\\)' or with_check ~* '(?<!select )auth\\.uid\\(\\)');`,
  idx_criados: `select count(*) as total_idx_novos from pg_indexes where schemaname='public' and indexname like 'idx_%' and indexname not in ('idx_perfis_id');`,
  comentarios: `select c.relname as tabela, obj_description(c.oid) as comentario from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('hermes_audit_log','hermes_sessions','cerbero_url_cache','medicamento','medicamentos','escala_plantoes','vw_censo_unidade','vw_indicadores_unidade') and obj_description(c.oid) is not null order by 1;`,
}

async function rodar(nome, sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { erro: texto.slice(0, 300) } }
  return json
}

;(async () => {
  for (const [nome, sql] of Object.entries(QUERIES)) {
    const json = await rodar(nome, sql)
    console.log(`\n=== ${nome} ===`)
    console.log(JSON.stringify(json, null, 2))
  }
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
