-- BLOCO 4 — POLICIES COM auth.uid() NÃO ENVOLTO EM SELECT [PERFORMANCE]
select
  tablename,
  policyname,
  cmd,
  qual as using_expr,
  '🐢 trocar auth.uid() por (select auth.uid())' as acao
from pg_policies
where schemaname = 'public'
  and (
        qual       ~* '(?<!select )auth\.(uid|jwt|role)\(\)'
     or with_check  ~* '(?<!select )auth\.(uid|jwt|role)\(\)'
  )
order by tablename;
