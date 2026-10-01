-- Testes da camada de menor privilégio do Hermes (migration 20261020000001).
-- Prova que as RPCs scoped recusam fora do escopo. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_redteam_v1_hermes.sql
-- Ids do seed: plantonista ...0002 (unidade 21..01); unidade 00..0101 sem vínculo dele.
BEGIN;

-- membro: lista setores da própria unidade
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.hermes_unidade_setores(
    '10000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001');
  IF n < 1 THEN RAISE EXCEPTION 'FALHOU V1: membro não viu setores'; END IF;
  RAISE NOTICE 'OK  V1: membro lista setores da própria unidade';
END $$;

-- não-membro: unidade onde não tem vínculo → bloqueado
DO $$
BEGIN
  PERFORM public.hermes_unidade_censo(
    '10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000101');
  RAISE EXCEPTION 'FALHOU V1: não-membro leu censo de outra unidade (cross-tenant)';
EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Acesso negado%' THEN RAISE EXCEPTION 'FALHOU V1: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'OK  V1: não-membro bloqueado (cross-tenant negado)';
END $$;

-- não-super: relatório da plataforma → bloqueado
DO $$
BEGIN
  PERFORM public.hermes_relatorio_semanal_ultimo('10000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'FALHOU V1: não-super leu relatório da plataforma';
EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%super admin%' THEN RAISE EXCEPTION 'FALHOU V1: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'OK  V1: relatório/quarentena/incidentes só super_admin';
END $$;

-- roles criados e sem acesso de tabela para hermes_user
DO $$
DECLARE tem_grant boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hermes_user')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hermes_job') THEN
    RAISE EXCEPTION 'FALHOU V1: roles hermes_user/hermes_job não existem';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee='hermes_user' AND table_schema='public'
  ) INTO tem_grant;
  IF tem_grant THEN RAISE EXCEPTION 'FALHOU V1: hermes_user tem grant de tabela (deveria ser zero)'; END IF;
  RAISE NOTICE 'OK  V1: roles existem; hermes_user sem grant de tabela (só EXECUTE em RPC)';
END $$;

ROLLBACK;
