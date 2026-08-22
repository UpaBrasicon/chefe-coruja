// Verifica referências SQL vivas a escala_plantoes (v2 — pg_proc com prosrc).
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
  console.log('=== funções SQL que referenciam escala_plantoes (prosrc) ===')
  console.log(JSON.stringify(await q(`
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and p.prosrc ilike '%escala_plantoes%'
    order by 1,2;`), null, 2))

  console.log('=== RPCs que o FRONTEND ainda chama (escala_plantoes nas migrations + code) ===')
  const fs = require('fs')
  const migra = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))
  for (const f of migra) {
    const c = fs.readFileSync('supabase/migrations/' + f, 'utf8')
    const linhas = c.split('\n')
    for (let i = 0; i < linhas.length; i++) {
      // ignora criações da própria tabela (000011) e a de cópia (000014)
      if (/escala_plantoes/.test(linhas[i]) && !f.includes('000011') && !f.includes('000014')) {
        console.log(`  ${f}:${i + 1}: ${linhas[i].trim().slice(0, 100)}`)
      }
    }
  }
  console.log('--- fim ---')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
