// Roda todos os blocos da auditoria via Management API do Supabase.
// Uso: node auditoria/rodar-auditoria.cjs <token> <project-ref>
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) {
  console.error('uso: node rodar-auditoria.cjs <token> [ref]')
  process.exit(1)
}

const dir = __dirname
const blocos = fs
  .readdirSync(dir)
  .filter((f) => /^bloco\d+.*\.sql$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0], 10)
    const nb = parseInt(b.match(/\d+/)[0], 10)
    return na - nb
  })

async function rodarBloco(nome, sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  let json
  try {
    json = JSON.parse(texto)
  } catch {
    json = { erro_parse: texto.slice(0, 500) }
  }
  return { nome, status: resp.status, json }
}

;(async () => {
  const resultados = []
  for (const b of blocos) {
    const sql = fs.readFileSync(path.join(dir, b), 'utf8')
    const r = await rodarBloco(b, sql)
    resultados.push(r)
    const ok = r.status === 200 || r.status === 201
    console.log(`${ok ? '✅' : '❌'} ${b} (HTTP ${r.status})`)
  }
  fs.writeFileSync(path.join(dir, 'resultados.json'), JSON.stringify(resultados, null, 2), 'utf8')
  console.log('\nResultados salvos em auditoria/resultados.json')
})().catch((e) => {
  console.error('falha:', e.message)
  process.exit(1)
})
