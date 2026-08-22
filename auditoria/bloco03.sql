-- BLOCO 3 — POLICIES PERMISSIVAS DEMAIS [CRITICO]
select
  tablename,
  policyname,
  cmd                     as operacao,
  roles,
  qual                    as using_expr,
  with_check,
  case
    when qual = 'true' or with_check = 'true' then '⛔ LIBERA TUDO'
    when qual is null and cmd <> 'INSERT'     then '⛔ SEM FILTRO'
    when qual !~* '(tenant|organizacao|organization|unidade|org_id)'
     and qual !~* 'auth\.uid'                 then '⚠️ sem escopo aparente'
    else 'ok'
  end as veredito
from pg_policies
where schemaname = 'public'
order by
  case
    when qual = 'true' or with_check = 'true' then 1
    when qual is null and cmd <> 'INSERT'     then 2
    else 3
  end,
  tablename;
