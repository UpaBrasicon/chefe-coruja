// Verifica RLS, policies e alimentação de escala_plantoes.
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
  console.log('=== 1. RLS + policies de escala_plantoes ===')
  console.log(JSON.stringify(await q(`select c.relname, c.relrowsecurity, p.policyname, p.cmd, p.roles from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname where n.nspname='public' and c.relname='escala_plantoes' order by 3;`), null, 2))

  console.log('=== 2. quem insere em escala_plantoes no código (plural com aspas) ===')
  const fs = require('fs')
  const { execSync } = require('child_process')
  const alvos = []
  function walk(d) {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = d + '/' + e.name
      if (e.isDirectory()) walk(f)
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const c = fs.readFileSync(f, 'utf8')
        if (/'escala_plantoes'|"escala_plantoes"/.test(c)) alvos.push(f)
      }
    }
  }
  walk('src'); walk('hermes/src')
  for (const f of alvos) {
    const c = fs.readFileSync(f, 'utf8')
    const linhas = c.split('\n')
    linhas.forEach((l, i) => {
      if (/'escala_plantoes'|"escala_plantoes"/.test(l)) console.log(`  ${f}:${i + 1}: ${l.trim().slice(0, 110)}`)
    })
  }
  console.log('--- fim usos escala_plantoes ---')

  console.log('=== 3. migrations que criam/inserem escala_plantoes ===')
  const migra = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))
  for (const f of migra) {
    const c = fs.readFileSync('supabase/migrations/' + f, 'utf8')
    const linhas = c.split('\n')
    linhas.forEach((l, i) => {
      if (/escala_plantoes/.test(l)) console.log(`  ${f}:${i + 1}: ${l.trim().slice(0, 110)}`)
    })
  }
  console.log('--- fim migrations ---')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
