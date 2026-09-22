// Levantamento parte 2 — terminologia, observação, storage, conceitos.
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
  try { return JSON.parse(texto) } catch { return { erro: texto.slice(0, 250) } }
}

;(async () => {
  console.log('### 1. TABELAS do schema terminologia')
  console.log(JSON.stringify(await q(`
    select table_name from information_schema.tables
    where table_schema='terminologia' order by table_name;`)))

  console.log('### 2. SCHEMAS existentes')
  console.log(JSON.stringify(await q(`
    select nspname from pg_namespace
    where nspname not like 'pg_%' and nspname not in ('information_schema')
    order by 1;`)))

  console.log('### 3. MODELO DE OBSERVAÇÃO (conceito/observacao)')
  console.log(JSON.stringify(await q(`
    select table_name, count(*) as colunas from information_schema.columns
    where table_schema='public' and table_name in ('conceito','conceito_opcao','observacao')
    group by 1 order by 1;`)))

  console.log('### 4. STORAGE buckets')
  console.log(JSON.stringify(await q(`select id, name, public from storage.buckets order by id;`)))

  console.log('### 5. Tabelas com organizacao_id (isolamento)')
  console.log(JSON.stringify(await q(`
    select count(distinct table_name) as tabelas_com_organizacao_id
    from information_schema.columns
    where table_schema='public' and column_name='organizacao_id';`)))

  console.log('### 6. Tabelas com unidade_id')
  console.log(JSON.stringify(await q(`
    select count(distinct table_name) as tabelas_com_unidade_id
    from information_schema.columns
    where table_schema='public' and column_name='unidade_id';`)))

  console.log('### 7. RPCs expostas para authenticated (amostra + total)')
  console.log(JSON.stringify(await q(`
    select count(*) as rpcs_publicas from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public';`)))

  console.log('### 8. RLS: policies por comando (select/insert/update/delete)')
  console.log(JSON.stringify(await q(`
    select cmd, count(*) from pg_policies where schemaname='public' group by 1 order by 2 desc;`)))

  console.log('### 9. Advisors de segurança nativos (tabelas sem policy etc.)')
  console.log(JSON.stringify(await q(`
    select count(*) as tabelas_rls_sem_policy from (
      select t.tablename from pg_tables t
      left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
      where t.schemaname='public' and t.rowsecurity
      group by t.tablename having count(p.policyname)=0
    ) x;`)))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
