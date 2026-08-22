// Verifica colunas status/org/unidade das tabelas dos compostos C2.
// Uso: node auditoria/colunas-status.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

const sql = `
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('internacoes','interop_outbox','censo_ocupacao')
  and column_name in ('status','organizacao_id','unidade_id')
order by table_name, column_name;`

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
