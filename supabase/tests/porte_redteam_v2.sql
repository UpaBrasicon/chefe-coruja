-- Testes do red-team V2/V15 (migration 20261019000002). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_redteam_v2.sql
BEGIN;

-- V15: as views só têm SELECT para authenticated (sem INSERT/UPDATE/DELETE)
DO $$
DECLARE v_privs text;
BEGIN
  SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) INTO v_privs
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND grantee='authenticated' AND table_name='vw_censo_unidade';
  IF v_privs <> 'SELECT' THEN RAISE EXCEPTION 'FALHOU V15: vw_censo_unidade tem % (esperado SELECT)', v_privs; END IF;
  RAISE NOTICE 'OK  V15: views só com SELECT para authenticated';
END $$;

-- V2: plantonista (não gestor/super) é NEGADO no painel do Gavião
SELECT set_config('request.jwt.claims',
  json_build_object('sub','10000000-0000-4000-8000-000000000002','role','authenticated')::text, true);
DO $$
BEGIN
  PERFORM public.gaviao_painel_admin();
  RAISE EXCEPTION 'FALHOU V2: plantonista não foi negado no painel do Gavião';
EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Acesso negado%' THEN RAISE EXCEPTION 'FALHOU V2: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'OK  V2: plantonista negado no painel do Gavião';
END $$;

-- V2: gestor (não super) entra, mas o relatório platform-wide fica NULL
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
VALUES ('10000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','gestor',true,
        '10000000-0000-4000-8000-000000000002');
DO $$
DECLARE v jsonb;
BEGIN
  v := public.gaviao_painel_admin();
  IF v->>'erro' IS NOT NULL THEN RAISE EXCEPTION 'FALHOU V2: gestor não deveria ser barrado'; END IF;
  IF v->'relatorio' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FALHOU V2: gestor não-super viu relatório platform-wide (%)', v->'relatorio';
  END IF;
  RAISE NOTICE 'OK  V2: gestor entra; relatório platform-wide só para super (null para gestor)';
END $$;

ROLLBACK;
