// Levantamento REAL do sistema — números verificáveis para o documento técnico.
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
  try { return JSON.parse(texto) } catch { return { erro: texto.slice(0, 200) } }
}

;(async () => {
  console.log('### 1. TABELAS E RLS')
  console.log(JSON.stringify(await q(`
    select
      (select count(*) from pg_tables where schemaname='public') as tabelas_public,
      (select count(*) from pg_tables where schemaname='public' and rowsecurity) as com_rls,
      (select count(*) from pg_tables where schemaname='public' and not rowsecurity) as sem_rls,
      (select count(*) from pg_policies where schemaname='public') as policies;`)))

  console.log('### 2. FUNÇÕES SECURITY DEFINER (guardas + helpers)')
  console.log(JSON.stringify(await q(`
    select n.nspname as schema, count(*) as total,
           count(*) filter (where p.proconfig is not null) as com_search_path_fixo
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prosecdef and n.nspname in ('public','private')
    group by 1 order by 1;`)))

  console.log('### 3. HELPERS DE AUTORIZAÇÃO (private)')
  console.log(JSON.stringify(await q(`
    select p.proname, p.provolatile from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname ~ 'perfil|admin|papel|unidade|org|super'
    order by 1;`)))

  console.log('### 4. TRILHAS DE AUDITORIA (estrutura)')
  console.log(JSON.stringify(await q(`
    select table_name, column_name, data_type from information_schema.columns
    where table_schema='public' and table_name in ('log_auditoria','log_acesso_prontuario')
    order by table_name, ordinal_position;`)))

  console.log('### 5. TERMINOLOGIA EMBARCADA (contagens reais)')
  console.log(JSON.stringify(await q(`
    select 'cid10' as t, count(*) from terminologia.cid10
    union all select 'sigtap', count(*) from terminologia.sigtap
    union all select 'cbo', count(*) from terminologia.cbo
    union all select 'cmed', count(*) from terminologia.cmed
    union all select 'loinc', count(*) from terminologia.loinc;`)))

  console.log('### 6. PRESENÇA / CHECK-IN (colunas)')
  console.log(JSON.stringify(await q(`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='presenca_plantonista' order by ordinal_position;`)))

  console.log('### 7. GEOLOCALIZAÇÃO DA UNIDADE')
  console.log(JSON.stringify(await q(`
    select column_name, data_type, column_default from information_schema.columns
    where table_schema='public' and table_name='unidades' and column_name ~ 'lat|long|raio';`)))

  console.log('### 8. PAPÉIS (enum + super_admins)')
  console.log(JSON.stringify(await q(`
    select 'papel_enum' as item, string_agg(enumlabel, ', ' order by enumsortorder) as valor
    from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='papel'
    union all select 'super_admins', count(*)::text from public.super_admins;`)))

  console.log('### 9. INTEROP (outbox + gatilho)')
  console.log(JSON.stringify(await q(`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='interop_outbox' order by ordinal_position;`)))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
