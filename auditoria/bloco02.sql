-- BLOCO 2 — TABELAS COM RLS LIGADA MAS SEM NENHUMA POLICY
select
  t.schemaname,
  t.tablename,
  '⚠️ RLS sem policy' as status
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.rowsecurity = true
group by t.schemaname, t.tablename
having count(p.policyname) = 0
order by t.tablename;
