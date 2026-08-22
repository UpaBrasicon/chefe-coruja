// Valida a sintaxe da PARTE C em transação com ROLLBACK (nenhum efeito).
// Uso: node auditoria/testar-parte-c.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

// Lê só os CREATE INDEX + analyze (sem os comentários)
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260823000003_auditoria_parte_c_indices.sql'), 'utf8')
const linhas = sql.split('\n').filter((l) => !l.startsWith('--') && l.trim() !== '')
const corpo = linhas.join('\n')

// Envolve em transação e faz ROLLBACK no final — se qualquer statement falhar,
// o Postgres aborta a transação e nada persiste.
const query = `BEGIN;\n${corpo}\nROLLBACK;`

;(async () => {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { raw: texto.slice(0, 500) } }
  if (resp.status === 200 || resp.status === 201) {
    console.log('✅ PARTE C válida (transação ROLLBACK — nada foi aplicado)')
  } else {
    console.log('❌ FALHOU:')
    console.log(JSON.stringify(json, null, 2).slice(0, 2000))
  }
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
