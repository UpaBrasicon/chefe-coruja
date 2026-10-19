-- Testes da migration 20261209000001_perfil_tema.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/perfil_tema.sql
BEGIN;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

-- ── 1. começa em automático ────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT tema FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000002') <> 'automatico' THEN
    RAISE EXCEPTION 'FALHOU: o tema não começa em automatico';
  END IF;
  RAISE NOTICE 'OK  o tema começa em automático';
END $$;

-- ── 2. a pessoa grava o próprio tema; não grava o de outra ─────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
UPDATE public.perfis SET tema = 'escuro' WHERE id = '10000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET tema = 'escuro' WHERE id = '10000000-0000-4000-8000-000000000001';
RESET ROLE;
DO $$
BEGIN
  IF (SELECT tema FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000002') <> 'escuro' THEN
    RAISE EXCEPTION 'FALHOU: a pessoa não gravou o próprio tema';
  END IF;
  IF (SELECT tema FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000001') <> 'automatico' THEN
    RAISE EXCEPTION 'FALHOU: a pessoa mudou o tema de outra';
  END IF;
  RAISE NOTICE 'OK  a pessoa grava o próprio tema e não o de outra';
END $$;

-- ── 3. valor fora da lista é recusado ──────────────────────────────────────
DO $$
BEGIN
  BEGIN
    UPDATE public.perfis SET tema = 'roxo' WHERE id = '10000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK  tema fora de claro, escuro e automático é recusado';
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: aceitou tema fora da lista';
END $$;

ROLLBACK;
