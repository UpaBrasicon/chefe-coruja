-- BLOCO 7 — GRANTS EXCESSIVOS PARA anon
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','public')
group by table_name, grantee
having grantee = 'anon'
    or string_agg(privilege_type, ',') ~* '(DELETE|TRUNCATE)'
order by grantee, table_name;
