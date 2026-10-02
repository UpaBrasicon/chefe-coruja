-- Testes da migration 20261022000006 (decisões do RT de 02/10/2026).
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/decisoes_rt_2026_10_02.sql
-- (O termo — 16/17 assistido e sem nascimento — está em porte_termo.sql.)
BEGIN;

-- 2.3: o médico de telemedicina do seed (…0006) declara uma especialidade e
-- mesmo assim não é parecerista; o plantonista (…0002) com a mesma é.
INSERT INTO public.especialidades_perfil (perfil_id, especialidade)
SELECT p, (SELECT nome FROM public.especialidades_parecer LIMIT 1)
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002']::uuid[]) p
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
DO $$ BEGIN
  IF private.sou_parecerista('21000000-0000-4000-8000-000000000001', (SELECT nome FROM public.especialidades_parecer LIMIT 1)) THEN
    RAISE EXCEPTION 'FALHOU: telemedicina é parecerista';
  END IF;
  RAISE NOTICE 'OK  telemedicina não é parecerista (lê só pela teleinterconsulta)';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$ BEGIN
  IF NOT private.sou_parecerista('21000000-0000-4000-8000-000000000001', (SELECT nome FROM public.especialidades_parecer LIMIT 1)) THEN
    RAISE EXCEPTION 'FALHOU: plantonista com a especialidade deixou de ser parecerista';
  END IF;
  RAISE NOTICE 'OK  plantonista com a especialidade segue parecerista';
END $$;

ROLLBACK;
