// Verifica pós-DROP: tabelas sumiram + FK reatada.
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
  console.log('=== 1. tabelas existem? ===')
  console.log(JSON.stringify(await q(`
    select c.relname, c.relkind from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('escala_plantoes','medicamentos','escala_plantao','medicamento');`), null, 2))

  console.log('=== 2. FK de prescricao_itens agora aponta para? ===')
  console.log(JSON.stringify(await q(`
    select conname, confrelid::regclass as referencia
    from pg_constraint
    where conrelid='public.prescricao_itens'::regclass and contype='f';`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
