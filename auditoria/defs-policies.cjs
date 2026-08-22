// Busca a definição COMPLETA das policies (v3 — via format/texto).
// Uso: node auditoria/defs-policies.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

const sql = `
select tablename, policyname, cmd, roles::text as roles_txt,
       qual::text as using_expr,
       with_check::text as with_check_expr
from pg_policies
where schemaname = 'public'
  and (tablename = 'perfis' or tablename in ('medicamento','medicamentos'))
order by tablename, policyname;`

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
  fs.writeFileSync(path.join(__dirname, 'defs-policies.json'), JSON.stringify(json, null, 2), 'utf8')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
