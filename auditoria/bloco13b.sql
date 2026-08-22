-- BLOCO 13b — max_connections
select
  current_setting('max_connections')                as max_conexoes,
  (select count(*) from pg_stat_activity)           as em_uso;
