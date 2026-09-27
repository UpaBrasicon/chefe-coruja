-- Testes da migration 20260927000005_hermes_vinculo_canal.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/hermes_vinculo_canal.sql
BEGIN;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
INSERT INTO t VALUES ('c1', public.gerar_codigo_vinculo_hermes('telegram'));
INSERT INTO t VALUES ('c2', public.gerar_codigo_vinculo_hermes('telegram'));
DO $$ BEGIN
  BEGIN
    PERFORM public.confirmar_vinculo_hermes('telegram', '999', (SELECT valor FROM t WHERE nome = 'c2'));
    RAISE EXCEPTION 'FALHOU: usuário comum confirmou vínculo direto';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  só o backend (service role) confirma o vínculo';
  END;
END $$;
RESET ROLE;

DO $$
DECLARE c1 text := (SELECT valor FROM t WHERE nome = 'c1'); c2 text := (SELECT valor FROM t WHERE nome = 'c2'); p uuid;
BEGIN
  IF c2 !~ '^\d{6}$' THEN RAISE EXCEPTION 'FALHOU: código fora do formato (%)', c2; END IF;
  IF c1 <> c2 AND public.confirmar_vinculo_hermes('telegram', '777', c1) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: código anterior continuou valendo';
  END IF;
  RAISE NOTICE 'OK  gerar um código novo derruba o anterior';
  IF public.confirmar_vinculo_hermes('telegram', '777', '000000') IS NOT NULL AND c2 <> '000000' THEN
    RAISE EXCEPTION 'FALHOU: código errado aceito';
  END IF;
  p := public.confirmar_vinculo_hermes('telegram', '777', c2);
  IF p IS DISTINCT FROM '10000000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'FALHOU: vínculo (%)', p; END IF;
  IF public.confirmar_vinculo_hermes('telegram', '888', c2) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: código reutilizado';
  END IF;
  RAISE NOTICE 'OK  código certo vincula, e só uma vez';
  IF public.confirmar_vinculo_hermes('whatsapp', '777', c2) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: código de um canal valeu em outro';
  END IF;
  RAISE NOTICE 'OK  código vale só no canal em que foi gerado';
END $$;

-- vencido
UPDATE private.hermes_codigos_vinculo SET expira_em = now() - interval '1 minute' WHERE usado_em IS NULL;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.hermes_identidades) THEN
    RAISE EXCEPTION 'FALHOU: gestor viu vínculo de outra pessoa';
  END IF;
  RAISE NOTICE 'OK  cada um vê só os próprios vínculos';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$ BEGIN
  DELETE FROM public.hermes_identidades WHERE canal = 'telegram';
  IF EXISTS (SELECT 1 FROM public.hermes_identidades) THEN RAISE EXCEPTION 'FALHOU: não desfez o próprio vínculo'; END IF;
  RAISE NOTICE 'OK  a pessoa desfaz o próprio vínculo';
END $$;
RESET ROLE;
ROLLBACK;
