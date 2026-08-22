// Verifica referências SQL vivas a escala_plantoes (funções, views, triggers).
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
  // funções que referenciam escala_plantoes
  console.log('=== funções SQL que referenciam escala_plantoes ===')
  console.log(JSON.stringify(await q(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args,
           left(pg_get_functiondef(p.oid), 200) as def_inicio
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and pg_get_functiondef(p.oid) ilike '%escala_plantoes%'
    order by 1;`), null, 2))

  // views que referenciam
  console.log('=== views que referenciam escala_plantoes ===')
  console.log(JSON.stringify(await q(`
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and pg_get_viewdef(c.oid) ilike '%escala_plantoes%';`), null, 2))

  // triggers
  console.log('=== triggers em escala_plantoes ===')
  console.log(JSON.stringify(await q(`
    select tgname, tgenabled from pg_trigger
    where tgrelid = 'public.escala_plantoes'::regclass;`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
