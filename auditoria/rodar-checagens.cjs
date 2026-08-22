// Checagens da PARTE B da auditoria + gerador da PARTE C (somente leitura).
// Uso: node auditoria/rodar-checagens.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso: node rodar-checagens.cjs <token> [ref]'); process.exit(1) }

const CHECAGENS = {
  B1_policies_perfis: `select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'perfis' order by policyname;`,
  B2_policies_true: `select policyname, tablename, roles, cmd from pg_policies where schemaname = 'public' and (qual = 'true' or with_check = 'true') order by tablename, policyname;`,
  B3_anon_public_policies: `select tablename, policyname, roles from pg_policies where schemaname = 'public' and (roles::text[] && array['anon','public']);`,
  B4_tabelas_homonimas: `select relname as tabela, n_live_tup as linhas, greatest(coalesce(last_autovacuum, '-infinity'), coalesce(last_analyze, '-infinity')) as ultima_atividade, pg_size_pretty(pg_total_relation_size(relid)) as tamanho from pg_stat_user_tables where schemaname = 'public' and relname in ('medicamento','medicamentos','escala_plantao','escala_plantoes') order by relname;`,
  B5_publication_realtime: `select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1,2;`,
  B5b_publications: `select pubname, pubinsert, pubupdate, pubdelete, pubtruncate from pg_publication order by pubname;`,
  C1_gerador_tenant: `select format('create index if not exists idx_%s_%s on public.%I (%I);', c.table_name, c.column_name, c.table_name, c.column_name) as ddl from information_schema.columns c join pg_tables t on t.tablename = c.table_name and t.schemaname = 'public' where c.table_schema = 'public' and c.column_name ~* '^(tenant_id|organizacao_id|unidade_id|org_id)$' and not exists ( select 1 from pg_index x join pg_class ic on ic.oid = x.indrelid join pg_attribute a on a.attrelid = ic.oid and a.attnum = x.indkey[0] where ic.relname = c.table_name and a.attname = c.column_name ) order by 1;`,
  C1_gerador_fk: `select format('create index if not exists idx_%s_%s on public.%s (%I);', ct.conrelid::regclass::text, a.attname, ct.conrelid::regclass::text, a.attname) as ddl from pg_constraint ct join pg_attribute a on a.attrelid = ct.conrelid and a.attnum = ct.conkey[1] join pg_class c on c.oid = ct.conrelid join pg_namespace n on n.oid = c.relnamespace where ct.contype = 'f' and n.nspname = 'public' and not exists (select 1 from pg_index x where x.indrelid = ct.conrelid and x.indkey[0] = ct.conkey[1]) order by 1;`,
  B_verif_helpers_volatile: `select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.provolatile = 'v' and p.proname ~* '(perfil|admin|gestor|tenant|unidade|papel|role)' order by p.proname;`,
}

async function rodar(nome, sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { erro_parse: texto.slice(0, 400) } }
  return { nome, status: resp.status, json }
}

;(async () => {
  const out = {}
  for (const [nome, sql] of Object.entries(CHECAGENS)) {
    const r = await rodar(nome, sql)
    out[nome] = r.json
    const dados = Array.isArray(r.json) ? r.json : []
    console.log(`${r.status === 200 || r.status === 201 ? '✅' : '❌'} ${nome} — ${dados.length} linha(s)`)
  }
  fs.writeFileSync(path.join(__dirname, 'checagens.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('\nSalvo em auditoria/checagens.json')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
