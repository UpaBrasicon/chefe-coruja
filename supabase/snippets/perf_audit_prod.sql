-- ============================================================================
-- Auditoria de performance — rodar em PRODUÇÃO (precisa de estatísticas reais).
-- ----------------------------------------------------------------------------
-- Pilar 1 (Supabase/Postgres best-practices). Estas consultas são de LEITURA
-- apenas (SELECT em catálogos pg_stat_*). Não alteram dados nem schema.
--
-- Por que só em produção: pg_stat_user_* acumula contadores de uso desde o
-- último reset das estatísticas. Em banco local recém-resetado tudo é zero e
-- as respostas enganam. Rodar contra o banco com tráfego real.
--
-- Como rodar: cole bloco a bloco no SQL Editor do dashboard Supabase (projeto
-- de produção) ou via `psql` na connection string do pooler. Leia o comentário
-- de cada bloco antes de agir sobre o resultado.
-- ============================================================================


-- [1] ÍNDICES NÃO-USADOS -----------------------------------------------------
-- idx_scan = 0 → índice nunca serviu uma busca desde o último reset de stats.
-- Candidato a DROP (economiza escrita e espaço). CUIDADO antes de remover:
--   - Deixe acumular tráfego representativo (semanas, incluindo picos/relatórios).
--   - NÃO remova índice que banca UNIQUE/PK ou constraint de FK.
--   - idx_scan baixo (não zero) pode ser caminho crítico raro mas importante.
-- Só gerar o DROP depois de confirmar que o índice é mesmo morto.
SELECT
  s.schemaname,
  s.relname              AS tabela,
  s.indexrelname         AS indice,
  s.idx_scan             AS buscas,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS tamanho,
  i.indisunique          AS eh_unique,
  i.indisprimary         AS eh_pk
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.schemaname = 'public'
  AND s.idx_scan = 0
  AND NOT i.indisprimary
  AND NOT i.indisunique
ORDER BY pg_relation_size(s.indexrelid) DESC;


-- [2] TABELAS COM SEQ SCAN DEMAIS --------------------------------------------
-- seq_scan alto com seq_tup_read grande e idx_scan baixo = tabela varrida
-- inteira repetidamente. Indica índice faltante num filtro/join quente.
-- Confirmar depois com EXPLAIN (bloco 5) na query real antes de criar índice.
SELECT
  schemaname,
  relname                AS tabela,
  seq_scan               AS varreduras_seq,
  seq_tup_read           AS linhas_lidas_seq,
  idx_scan               AS buscas_idx,
  n_live_tup             AS linhas_vivas,
  CASE WHEN seq_scan > 0
       THEN round(seq_tup_read::numeric / seq_scan, 1)
       ELSE 0 END        AS media_linhas_por_seq_scan
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND seq_scan > 0
  AND n_live_tup > 1000           -- ignora tabelas pequenas (seq scan nelas é OK)
ORDER BY seq_tup_read DESC
LIMIT 30;


-- [3] BLOAT / DEAD TUPLES ----------------------------------------------------
-- n_dead_tup alto vs n_live_tup = bloat; autovacuum não deu conta ou nunca
-- rodou. Checar last_autovacuum. Ação: VACUUM (ANALYZE) manual na tabela, ou
-- ajustar autovacuum. NÃO rodar VACUUM FULL em prod sem janela (trava a tabela).
SELECT
  schemaname,
  relname                AS tabela,
  n_live_tup             AS vivas,
  n_dead_tup             AS mortas,
  CASE WHEN n_live_tup > 0
       THEN round(100.0 * n_dead_tup / n_live_tup, 1)
       ELSE 0 END        AS pct_mortas,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_dead_tup > 100
ORDER BY n_dead_tup DESC
LIMIT 30;


-- [4] QUERIES MAIS CARAS (precisa extensão pg_stat_statements) ---------------
-- Mostra as queries que mais consomem tempo total. Base para escolher o que
-- otimizar. Se a extensão não existir, este bloco dá erro — ignorar ou pedir
-- ao Supabase para habilitar (Dashboard > Database > Extensions).
-- mean_exec_time alto + calls alto = alvo prioritário.
SELECT
  round(total_exec_time::numeric, 0)  AS tempo_total_ms,
  calls,
  round(mean_exec_time::numeric, 2)   AS media_ms,
  round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct_do_total,
  left(query, 120)                    AS query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 25;


-- [5] EXPLAIN de uma query quente (template) ---------------------------------
-- Pegar a query do bloco 2 ou 4 e rodar com EXPLAIN ANALYZE para ver o plano
-- real. Procurar "Seq Scan" em tabela grande, "Rows Removed by Filter" alto,
-- ou estimativa de linhas muito diferente do real (stats desatualizadas →
-- rodar ANALYZE <tabela>). Trocar o SELECT abaixo pela query real.
--
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
-- SELECT ... ;   -- <- sua query quente aqui


-- [6] CACHE HIT RATIO --------------------------------------------------------
-- < 0.99 em prod com RAM suficiente sugere working set maior que shared_buffers
-- ou falta de índice forçando leitura de disco. Valor global do banco.
SELECT
  sum(heap_blks_hit)                                   AS cache_hits,
  sum(heap_blks_read)                                  AS disk_reads,
  round(sum(heap_blks_hit)::numeric
        / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) AS hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'public';
