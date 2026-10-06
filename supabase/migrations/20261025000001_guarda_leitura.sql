-- Fase 0, tarefa 8 do BACKLOG.md — conta da guarda automática de 20 anos.
--
-- A guarda roda sozinha no servidor (infra/guarda/) e precisa ler o banco
-- inteiro (inclusive auth e as tabelas com RLS) sem poder gravar nada. Em vez
-- da senha principal do banco no servidor, uma conta só de leitura:
--   • pg_read_all_data: SELECT em tudo (papel pronto do Postgres);
--   • BYPASSRLS: a cópia precisa de todas as linhas, não só as "visíveis";
--   • nenhuma permissão de escrita (provado no teste fase0_guarda_leitura.sql).
--
-- Nasce SEM login. O responsável liga na produção, com a senha que ele mesmo
-- escolhe (nunca no repositório), pelo SQL Editor:
--   ALTER ROLE guarda_leitura WITH LOGIN PASSWORD '<senha forte>';
-- e o servidor conecta pelo pooler da Supabase como guarda_leitura.<ref-do-projeto>.
--
-- ROLLBACK: DROP ROLE IF EXISTS guarda_leitura;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guarda_leitura') THEN
    CREATE ROLE guarda_leitura NOLOGIN BYPASSRLS;
  END IF;
END $$;
GRANT pg_read_all_data TO guarda_leitura;
ALTER ROLE guarda_leitura SET statement_timeout = 0;
ALTER ROLE guarda_leitura SET default_transaction_read_only = on;
