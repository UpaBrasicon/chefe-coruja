// Verifica o uso real da FK prescricao_itens -> medicamentos.
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
  console.log('=== 1. prescricao_itens tem dados? ===')
  console.log(JSON.stringify(await q(`select count(*) as total from public.prescricao_itens;`), null, 2))

  console.log('=== 2. prescricao_itens referenciando medicamentos (legada) vs medicamento (canônica) ===')
  console.log(JSON.stringify(await q(`
    select
      (select count(*) from public.prescricao_itens pi join public.medicamentos m on m.id = pi.medicamento_id) as itens_apontando_medicamentos,
      (select count(*) from public.prescricao_itens pi join public.medicamento m on m.id = pi.medicamento_id) as itens_apontando_medicamento;`), null, 2))

  console.log('=== 3. amostra: os medicamento_id de prescricao_itens batem com QUAL tabela? ===')
  console.log(JSON.stringify(await q(`
    select pi.id as item_id, pi.medicamento_id,
           case when m_legado.id is not null then 'legado(medicamentos)'
                when m_canon.id is not null then 'canonico(medicamento)'
                else 'nenhum' end as pertence_a
    from public.prescricao_itens pi
    left join public.medicamentos m_legado on m_legado.id = pi.medicamento_id
    left join public.medicamento m_canon on m_canon.id = pi.medicamento_id
    limit 5;`), null, 2))

  console.log('=== 4. a FK de prescricao_itens aponta para medicamentos — existe OUTRA FK para medicamento? ===')
  console.log(JSON.stringify(await q(`
    select conname, confrelid::regclass as referencia
    from pg_constraint
    where conrelid = 'public.prescricao_itens'::regclass and contype = 'f';`), null, 2))

  console.log('=== 5. medicamento_id em prescricao_itens é usado pelo código? ===')
  const fs = require('fs')
  const alvos = []
  function walk(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = d + '/' + e.name; if (e.isDirectory()) walk(f); else if (/\.(ts|tsx)$/.test(e.name)) { const c = fs.readFileSync(f, 'utf8'); if (/medicamento_id/.test(c)) alvos.push(f) } } }
  walk('src')
  let total = 0
  for (const f of alvos) {
    const c = fs.readFileSync(f, 'utf8')
    const ls = c.split('\n')
    ls.forEach((l, i) => { if (/medicamento_id/.test(l) && !/medicamento_id:.*(?:uuid|string)/.test(l.trim())) { console.log('  ' + f + ':' + (i + 1) + ': ' + l.trim().slice(0, 100)); total++ } })
  }
  console.log('  (total usos:', total + ')')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
