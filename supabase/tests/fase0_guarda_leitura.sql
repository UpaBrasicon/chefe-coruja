-- Fase 0, tarefa 8 — migration 20261025000001_guarda_leitura.sql: a conta da
-- guarda lê tudo (inclusive auth e tabelas com RLS) e não grava nada.
BEGIN;
GRANT guarda_leitura TO postgres;   -- só para o SET ROLE do teste (desfeito no ROLLBACK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guarda_leitura' AND rolbypassrls AND NOT rolsuper) THEN
    RAISE EXCEPTION 'FALHOU: guarda_leitura sem BYPASSRLS (ou superusuário)';
  END IF;
  RAISE NOTICE 'OK  guarda_leitura existe, lê ignorando RLS e não é superusuário';
END $$;
SET LOCAL ROLE guarda_leitura;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.pacientes) = 0 THEN   -- o seed tem pacientes; a RLS esconderia todos
    RAISE EXCEPTION 'FALHOU: guarda_leitura não leu pacientes (RLS não foi ignorada)';
  END IF;
  PERFORM count(*) FROM auth.users;
  PERFORM count(*) FROM storage.objects;
  PERFORM count(*) FROM private.segundo_fator_eventos;
  PERFORM count(*) FROM public.log_auditoria;
  RAISE NOTICE 'OK  lê public, private, auth, storage e a trilha de auditoria';
END $$;
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'INSERT INTO public.super_admins (perfil_id) VALUES (''10000000-0000-4000-8000-000000000001'')',
    'UPDATE public.pacientes SET nome = nome',
    'DELETE FROM public.log_auditoria',
    'CREATE TABLE public.x_guarda (id int)'] LOOP
    BEGIN
      EXECUTE c;
      RAISE EXCEPTION 'FALHOU: guarda_leitura conseguiu: %', c;
    EXCEPTION WHEN insufficient_privilege OR read_only_sql_transaction THEN NULL;
    END;
  END LOOP;
  RAISE NOTICE 'OK  não grava, não altera, não apaga, não cria';
END $$;
RESET ROLE;
ROLLBACK;
