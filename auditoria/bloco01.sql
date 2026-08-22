-- BLOCO 1 — TABELAS SEM RLS [CRITICO]
select
  schemaname,
  tablename,
  '⛔ SEM RLS' as status
from pg_tables
where schemaname in ('public','storage')
  and rowsecurity = false
order by schemaname, tablename;
