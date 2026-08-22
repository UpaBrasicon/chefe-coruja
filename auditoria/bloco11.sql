-- BLOCO 11 — TOP 15 QUERIES MAIS CARAS (pg_stat_statements)
select
  round(total_exec_time::numeric)             as tempo_total_ms,
  calls                                       as chamadas,
  round(mean_exec_time::numeric, 2)           as media_ms,
  round((100 * total_exec_time /
         nullif(sum(total_exec_time) over (), 0))::numeric, 1) as pct_do_total,
  left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
from pg_stat_statements
where query !~* '^(SET|SHOW|COMMIT|BEGIN|DEALLOCATE)'
  and query !~* 'pg_stat_statements'
order by total_exec_time desc
limit 15;
