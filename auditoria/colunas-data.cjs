// Descobre as colunas de data reais das tabelas dos compostos C2.
// Uso: node auditoria/colunas-data.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

const sql = `
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('internacoes','documentos_clinicos','log_acesso_prontuario',
                     'censo_ocupacao','eventos_adt','notificacoes_plantonista',
                     'interop_outbox')
  and (column_name ~* 'data|created|criado|quando|dt_|_em$' or data_type like 'timestamp%' or data_type like 'date%')
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
