-- BLOCO 12 — EXTENSÕES INSTALADAS NO SCHEMA public
select
  e.extname                as extensao,
  n.nspname                as schema,
  case when n.nspname = 'public' then '⚠️ mover para extensions' else 'ok' end as status
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by 3 desc, 1;
