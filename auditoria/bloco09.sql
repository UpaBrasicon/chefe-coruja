-- BLOCO 9 — FOREIGN KEYS SEM ÍNDICE
select
  conrelid::regclass as tabela,
  conname            as constraint_name,
  a.attname          as coluna_fk,
  '⚠️ FK sem índice' as status
from pg_constraint ct
join pg_attribute a
  on a.attrelid = ct.conrelid and a.attnum = ct.conkey[1]
join pg_class c on c.oid = ct.conrelid
join pg_namespace n on n.oid = c.relnamespace
where ct.contype = 'f'
  and n.nspname = 'public'
  and not exists (
    select 1 from pg_index x
    where x.indrelid = ct.conrelid and x.indkey[0] = ct.conkey[1]
  )
order by 1;
