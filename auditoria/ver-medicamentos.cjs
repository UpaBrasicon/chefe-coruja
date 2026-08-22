// Verifica FKs/views/colunas que apontam para medicamentos antes do DROP.
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
  console.log('=== 1. FKs de outras tabelas APONTANDO para medicamentos ===')
  console.log(JSON.stringify(await q(`
    select conrelid::regclass as tabela_filha, conname, pg_get_constraintdef(oid) as def
    from pg_constraint where contype='f'
      and confrelid = 'public.medicamentos'::regclass;`), null, 2))

  console.log('=== 2. FKs de medicamentos apontando PARA fora ===')
  console.log(JSON.stringify(await q(`
    select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid) as def
    from pg_constraint where contype='f'
      and conrelid = 'public.medicamentos'::regclass;`), null, 2))

  console.log('=== 3. views que referenciam medicamentos ===')
  console.log(JSON.stringify(await q(`
    select c.relname from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v'
      and pg_get_viewdef(c.oid) ilike '%medicamentos%';`), null, 2))

  console.log('=== 4. funções SQL que referenciam medicamentos (excluindo medicamento) ===')
  console.log(JSON.stringify(await q(`
    select n.nspname, p.proname from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
      and p.prosrc ~ '\\mmedicamentos\\M'
      and p.prosrc !~ '\\mmedicamento\\M' -- sem sufixo s
    order by 1,2;`), null, 2))

  console.log('=== 5. colunas de medicamentos ===')
  console.log(JSON.stringify(await q(`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='medicamentos'
    order by ordinal_position;`), null, 2))

  console.log('=== 6. amostra de dados de medicamentos (o que tem lá) ===')
  console.log(JSON.stringify(await q(`
    select count(*) as total, count(distinct nome) as nomes_distintos from public.medicamentos;`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
