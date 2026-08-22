// Verifica RLS de setores (o plantonista pode ler nomes?).
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
  console.log('=== policies de setores ===')
  console.log(JSON.stringify(await q(`select policyname, cmd, roles, qual::text from pg_policies where schemaname='public' and tablename='setores' order by 1;`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
