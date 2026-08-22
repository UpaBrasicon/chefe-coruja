-- BLOCO 5 — FUNÇÕES SECURITY DEFINER SEM search_path [CRITICO]
select
  n.nspname                                   as schema,
  p.proname                                   as funcao,
  pg_get_function_identity_arguments(p.oid)   as assinatura,
  pg_get_userbyid(p.proowner)                 as owner,
  coalesce(array_to_string(p.proconfig, ', '), '(nenhum)') as config,
  format(
    'ALTER FUNCTION %I.%I(%s) SET search_path = '''';',
    n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  ) as correcao_pronta
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef = true
  and n.nspname not in ('pg_catalog','information_schema','extensions',
                        'graphql','graphql_public','pgbouncer','vault',
                        'auth','storage','realtime','supabase_migrations')
  and (p.proconfig is null
       or not exists (
         select 1 from unnest(p.proconfig) c where c like 'search_path=%'
       ))
order by n.nspname, p.proname;
