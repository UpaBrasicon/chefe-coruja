// Verifica o schema real de escala_plantao vs escala_plantoes (e se é view).
// Uso: node auditoria/ver-escala.cjs <token> [ref]
const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

const sql = `
-- 1. o que são (tabela vs view)?
select c.relname, c.relkind,
       case c.relkind when 'r' then 'tabela' when 'v' then 'VIEW' when 'm' then 'MATVIEW' else c.relkind::text end as tipo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('escala_plantao','escala_plantoes');

-- 2. colunas de escala_plantao (singular)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='escala_plantao'
order by ordinal_position;

-- 3. colunas de escala_plantoes (plural)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='escala_plantoes'
order by ordinal_position;`

;(async () => {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { erro: texto.slice(0, 500) } }
  console.log(JSON.stringify(json, null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
