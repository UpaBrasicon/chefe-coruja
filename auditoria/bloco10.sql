-- BLOCO 10 — TABELAS SOFRENDO SEQUENTIAL SCAN
select
  relname                    as tabela,
  n_live_tup                 as linhas,
  seq_scan                   as varreduras_completas,
  idx_scan                   as usos_de_indice,
  case when seq_scan > 0 then round(seq_tup_read::numeric / seq_scan, 0) end
                             as linhas_por_varredura,
  pg_size_pretty(pg_total_relation_size(relid)) as tamanho
from pg_stat_user_tables
where schemaname = 'public'
  and n_live_tup > 500
  and seq_scan > coalesce(idx_scan, 0)
order by seq_tup_read desc nulls last
limit 20;
