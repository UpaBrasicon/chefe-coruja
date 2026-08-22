-- BLOCO 6 — VIEWS COM SECURITY DEFINER (RLS IGNORADA)
select
  c.relname as view_name,
  case
    when c.reloptions::text ~ 'security_invoker=(true|on)' then 'ok (invoker)'
    else '⛔ definer — atravessa RLS'
  end as status,
  format('ALTER VIEW public.%I SET (security_invoker = true);', c.relname) as correcao
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v','m')
order by 2, 1;
