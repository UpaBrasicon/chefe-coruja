-- Testes da migration 20261001000002_fase6_painel_auditoria_agregados.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase6_painel_auditoria.sql
--
-- Gestor (…0001) lê auditoria e painel da unidade. Plantonista (…0002) e
-- administrador (…0003) não: o administrador só vê a organização em agregado.
BEGIN;

-- um acesso registrado, para a auditoria ter o que mostrar
INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso)
SELECT u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'plantonista', 'impressao'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN raise_exception THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

SET LOCAL ROLE authenticated;

-- ── gestor ──────────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE p jsonb;
BEGIN
  IF (SELECT count(*) FROM public.acessos_prontuario_da_unidade('21000000-0000-4000-8000-000000000001')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: gestor não vê o acesso';
  END IF;
  IF (SELECT paciente_nome FROM public.acessos_prontuario_da_unidade('21000000-0000-4000-8000-000000000001') LIMIT 1) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: auditoria do gestor sem o nome do paciente';
  END IF;
  p := public.painel_gestor('21000000-0000-4000-8000-000000000001');
  IF (p ->> 'impressoes_24h')::int <> 1 OR jsonb_array_length(p -> 'ocupacao') = 0 THEN
    RAISE EXCEPTION 'FALHOU: painel do gestor incompleto (%)', p;
  END IF;
  IF (public.integridade_trilha('21000000-0000-4000-8000-000000000001') ->> 'integra')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: trilha dada como quebrada';
  END IF;
  PERFORM * FROM public.trilha_da_unidade('21000000-0000-4000-8000-000000000001');
  RAISE NOTICE 'OK  gestor lê acessos, trilha, integridade e painel';
END $$;

-- ── plantonista ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.painel_gestor('21000000-0000-4000-8000-000000000001')$$, 'plantonista leu o painel do gestor');
SELECT pg_temp.negado($$SELECT * FROM public.acessos_prontuario_da_unidade('21000000-0000-4000-8000-000000000001')$$, 'plantonista leu a auditoria');
SELECT pg_temp.negado($$SELECT * FROM public.trilha_da_unidade('21000000-0000-4000-8000-000000000001')$$, 'plantonista leu a trilha');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.painel_organizacao(30)) THEN
    RAISE EXCEPTION 'FALHOU: plantonista vê o painel da organização';
  END IF;
  RAISE NOTICE 'OK  plantonista sem painel, auditoria, trilha e organização';
END $$;

-- ── administrador ───────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.negado($$SELECT * FROM public.acessos_prontuario_da_unidade('21000000-0000-4000-8000-000000000001')$$, 'administrador leu acessos com nome de paciente');
SELECT pg_temp.negado($$SELECT public.painel_gestor('21000000-0000-4000-8000-000000000001')$$, 'administrador leu o painel do gestor');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.painel_organizacao(30) WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: administrador não vê a unidade da organização'; END IF;
  -- seed: 3 leitos ocupados de 6 → ocupados some, e a taxa junto
  IF r.leitos_ocupados IS NOT NULL OR r.taxa_ocupacao IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: célula pequena não suprimida (ocupados %, taxa %)', r.leitos_ocupados, r.taxa_ocupacao;
  END IF;
  IF r.leitos <> 6 THEN RAISE EXCEPTION 'FALHOU: total de leitos 6 deveria aparecer (%)', r.leitos; END IF;
  RAISE NOTICE 'OK  administrador vê agregado com supressão de 1 a 4';
END $$;

RESET ROLE;
DO $$ BEGIN
  IF private.suprimir(0) <> 0 OR private.suprimir(1) IS NOT NULL OR private.suprimir(4) IS NOT NULL OR private.suprimir(5) <> 5 THEN
    RAISE EXCEPTION 'FALHOU: suprimir fora da regra 1 a 4';
  END IF;
  RAISE NOTICE 'OK  suprimir: 0 e 5 aparecem, 1 a 4 somem';
END $$;

ROLLBACK;
