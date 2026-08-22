-- BLOCO 14 — PLACAR FINAL
select 'Tabelas sem RLS'                as item,
       count(*)                         as qtd,
       'deve ser 0'                     as meta
from pg_tables where schemaname='public' and rowsecurity=false
union all
select 'Policies liberando tudo (true)', count(*), 'deve ser 0'
from pg_policies where schemaname='public' and (qual='true' or with_check='true')
union all
select 'auth.uid() sem (select ...)', count(*), 'deve ser 0'
from pg_policies where schemaname='public'
  and (qual ~* '(?<!select )auth\.(uid|jwt|role)\(\)'
    or with_check ~* '(?<!select )auth\.(uid|jwt|role)\(\)')
union all
select 'SECURITY DEFINER sem search_path', count(*), 'deve ser 0'
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prosecdef and n.nspname='public'
  and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
union all
select 'Views SECURITY DEFINER', count(*), 'deve ser 0'
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m')
  and coalesce(c.reloptions::text,'') !~ 'security_invoker=(true|on)'
union all
select 'FKs sem índice', count(*), 'perto de 0'
from pg_constraint ct join pg_class c on c.oid=ct.conrelid
join pg_namespace n on n.oid=c.relnamespace
where ct.contype='f' and n.nspname='public'
  and not exists (select 1 from pg_index x
                  where x.indrelid=ct.conrelid and x.indkey[0]=ct.conkey[1]);
