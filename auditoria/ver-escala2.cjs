// Verifica escala_plantao (singular) — tipo e colunas.
// Uso: node auditoria/ver-escala2.cjs <token> [ref]
const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

async function q(sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  try { return JSON.parse(texto) } catch { return { raw: texto.slice(0, 300) } }
}

;(async () => {
  console.log('=== 1. tipo das duas ===')
  console.log(JSON.stringify(await q(`select c.relname, c.relkind, case c.relkind when 'r' then 'tabela' when 'v' then 'VIEW' when 'm' then 'MATVIEW' else c.relkind::text end as tipo from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('escala_plantao','escala_plantoes') order by 1;`), null, 2))

  console.log('=== 2. colunas escala_plantao (singular) ===')
  console.log(JSON.stringify(await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='escala_plantao' order by ordinal_position;`), null, 2))

  console.log('=== 3. RLS/policies de cada uma ===')
  console.log(JSON.stringify(await q(`select c.relname as tabela, c.rowsecurity, p.policyname, p.cmd from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname where n.nspname='public' and c.relname in ('escala_plantao','escala_plantoes') order by 1,4;`), null, 2))

  console.log('=== 4. FKs apontando para cada uma ===')
  console.log(JSON.stringify(await q(`select confrelid::regclass as tabela_pai, conrelid::regclass as tabela_filha, conname from pg_constraint where contype='f' and confrelid::regclass::text in ('escala_plantao','escala_plantoes');`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
