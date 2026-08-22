// Colunas da interop_outbox (para o índice parcial).
// Uso: node auditoria/colunas-outbox.cjs <token> [ref]
const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

const sql = `
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'interop_outbox'
order by ordinal_position;`

;(async () => {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { erro: texto.slice(0, 400) } }
  console.log(JSON.stringify(json, null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
