-- Testes da migration 20261210000001_trava_colunas_perfil.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/trava_colunas_perfil.sql
BEGIN;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');

-- ── 1. colunas de identidade e registro: recusadas ─────────────────────────
SELECT pg_temp.negado($$UPDATE public.perfis SET crm = '999999' WHERE id = '10000000-0000-4000-8000-000000000002'$$, 'trocou o próprio CRM');
SELECT pg_temp.negado($$UPDATE public.perfis SET registro_numero = '1', conselho = 'CRM', registro_uf = 'SP' WHERE id = '10000000-0000-4000-8000-000000000002'$$, 'trocou o próprio registro');
SELECT pg_temp.negado($$UPDATE public.perfis SET ativo = true WHERE id = '10000000-0000-4000-8000-000000000002'$$, 'mexeu no próprio ativo');
SELECT pg_temp.negado($$UPDATE public.perfis SET nome_completo = 'Outro Nome' WHERE id = '10000000-0000-4000-8000-000000000002'$$, 'trocou o próprio nome');
SELECT pg_temp.negado($$UPDATE public.perfis SET cpf = '00000000000' WHERE id = '10000000-0000-4000-8000-000000000002'$$, 'trocou o próprio CPF');
SELECT pg_temp.negado($$UPDATE public.perfis SET cbo = '225125', cns = '1' WHERE id = '10000000-0000-4000-8000-000000000002'$$, 'gravou CBO e CNS sem a validação');
DO $$ BEGIN RAISE NOTICE 'OK  CRM, registro, ativo, nome, CPF, CBO e CNS não mudam por UPDATE direto'; END $$;

-- ── 2. o que as telas gravam continua passando ─────────────────────────────
UPDATE public.perfis SET foto_url = 'https://exemplo.test/f.png', tipo_sanguineo = 'O+', dados_pessoais = '{"telefone":"11"}'::jsonb, tema = 'claro'
 WHERE id = '10000000-0000-4000-8000-000000000002';
-- e o CNS pela função que valida (vazio limpa)
SELECT public.definir_meu_cns(NULL);
RESET ROLE;
DO $$
BEGIN
  IF (SELECT tema FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000002') <> 'claro'
     OR (SELECT tipo_sanguineo FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000002') <> 'O+' THEN
    RAISE EXCEPTION 'FALHOU: foto, tipo sanguíneo, dados pessoais ou tema não gravaram';
  END IF;
  RAISE NOTICE 'OK  foto, tipo sanguíneo, dados pessoais e tema gravam; CNS pela função segue funcionando';
END $$;

ROLLBACK;
