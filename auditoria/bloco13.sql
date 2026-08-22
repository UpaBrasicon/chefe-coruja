-- BLOCO 13 — CONEXÕES: VOCÊ ESTÁ USANDO O POOLER?
select
  usename                            as usuario,
  coalesce(application_name,'(vazio)') as aplicacao,
  state,
  count(*)                           as conexoes,
  max(now() - state_change)          as mais_antiga
from pg_stat_activity
where datname = current_database()
group by 1,2,3
order by conexoes desc;
