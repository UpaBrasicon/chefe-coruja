-- BLOCO 8 — COLUNAS DE TENANT SEM ÍNDICE [PERFORMANCE + SEGURANÇA]
with tenant_cols as (
  select c.table_name, c.column_name
  from information_schema.columns c
  join pg_tables t
    on t.tablename = c.table_name and t.schemaname = c.table_schema
  where c.table_schema = 'public'
    and c.column_name ~* '^(tenant_id|organizacao_id|organization_id|unidade_id|org_id)$'
),
first_col as (
  select
    t.relname as table_name,
    a.attname as primeira_coluna_do_indice,
    i.relname as index_name
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a
    on a.attrelid = t.oid and a.attnum = x.indkey[0]
  where n.nspname = 'public'
)
select
  tc.table_name,
  tc.column_name,
  case
    when exists (
      select 1 from first_col f
      where f.table_name = tc.table_name
        and f.primeira_coluna_do_indice = tc.column_name
    ) then 'ok'
    else '⛔ sem índice liderado por esta coluna'
  end as status,
  format(
    'CREATE INDEX CONCURRENTLY idx_%s_%s ON public.%I (%I);',
    tc.table_name, tc.column_name, tc.table_name, tc.column_name
  ) as sugestao
from tenant_cols tc
order by 3 desc, 1;
