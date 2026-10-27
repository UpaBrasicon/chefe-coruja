-- Testes da migration 20270109000001_diluicao_da_unidade.sql (telas do
-- farmacêutico, ponto 2, decisão do RT de 27/10/2026: o modelo da rede é só do
-- super admin). Transação com ROLLBACK. O cenário é criado aqui (rede, duas
-- unidades, farmacêutico de cada uma, super admin e um medicamento), sem
-- depender do seed; por isso o teste roda também na homologação.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/diluicao_da_unidade.sql
BEGIN;

UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO auth.users (instance_id, id, aud, role, email)
SELECT '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@diluicao.teste'
FROM unnest(ARRAY['4d000000-0000-4000-8000-000000000001', '4d000000-0000-4000-8000-000000000002',
                  '4d000000-0000-4000-8000-000000000003']::uuid[]) u;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('4d000000-0000-4000-8000-000000000001', 'Farmacêutica da Unidade A'),
  ('4d000000-0000-4000-8000-000000000002', 'Farmacêutico da Unidade B'),
  ('4d000000-0000-4000-8000-000000000003', 'Super admin do teste')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;   -- o gatilho do auth.users já cria o perfil
INSERT INTO public.super_admins (perfil_id) VALUES ('4d000000-0000-4000-8000-000000000003');
INSERT INTO public.organizacoes (id, nome) VALUES ('4d100000-0000-4000-8000-000000000001', 'Rede do Teste da Diluição');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('4d200000-0000-4000-8000-00000000000a', '4d100000-0000-4000-8000-000000000001', 'Unidade A da Diluição', 'hospital'),
  ('4d200000-0000-4000-8000-00000000000b', '4d100000-0000-4000-8000-000000000001', 'Unidade B da Diluição', 'hospital');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('4d000000-0000-4000-8000-000000000001', '4d200000-0000-4000-8000-00000000000a', 'farmaceutico'),
  ('4d000000-0000-4000-8000-000000000002', '4d200000-0000-4000-8000-00000000000b', 'farmaceutico');
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('4d400000-0000-4000-8000-000000000001', 'Diluteste', 'diluteste', 'Frasco-ampola 1 g pó', 'teste');

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. o farmacêutico não cria modelo da rede; cria a diluição da unidade ──
SELECT pg_temp.como('4d000000-0000-4000-8000-000000000001');
DO $$
DECLARE v uuid;
BEGIN
  BEGIN
    PERFORM public.salvar_diluicao(NULL, '{"medicamento_id": "4d400000-0000-4000-8000-000000000001", "via": "EV", "fonte": "manual"}');
    RAISE EXCEPTION 'FALHOU: farmacêutico criou diluição sem unidade (modelo da rede)';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.salvar_diluicao(NULL, '{"medicamento_id": "4d400000-0000-4000-8000-000000000001", "via": "EV",
      "unidade_id": "4d200000-0000-4000-8000-00000000000b"}');
    RAISE EXCEPTION 'FALHOU: farmacêutico criou diluição para outra unidade';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  v := public.salvar_diluicao(NULL, '{"medicamento_id": "4d400000-0000-4000-8000-000000000001", "via": "EV",
    "unidade_id": "4d200000-0000-4000-8000-00000000000a"}');
  PERFORM public.salvar_diluicao(v, '{"diluicao_volume_min_ml": "100", "tempo_infusao_min": "30", "fonte": "Manual da unidade, p. 12",
    "revisor_crf": "CRF-GO 1234"}');
  PERFORM public.publicar_diluicao_versao(v);
  IF (SELECT unidade_id FROM public.diluicao WHERE id = v) IS DISTINCT FROM '4d200000-0000-4000-8000-00000000000a'::uuid
     OR (SELECT status FROM public.diluicao WHERE id = v) <> 'publicado' THEN
    RAISE EXCEPTION 'FALHOU: a diluição nova não ficou publicada como da unidade A';
  END IF;
  PERFORM set_config('teste.da_a', v::text, true);
  RAISE NOTICE 'OK  farmacêutico cria e publica só a diluição da própria unidade';
END $$;

-- ── 2. a diluição da unidade A não chega à unidade B ────────────────────────
SELECT pg_temp.como('4d000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.diluicao_vigente('4d400000-0000-4000-8000-000000000001', 'EV', now(), '4d200000-0000-4000-8000-00000000000b')) THEN
    RAISE EXCEPTION 'FALHOU: a prescrição da unidade B recebe a diluição da unidade A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.diluicao_vigente('4d400000-0000-4000-8000-000000000001', 'EV', now(), '4d200000-0000-4000-8000-00000000000a')) THEN
    RAISE EXCEPTION 'FALHOU: a prescrição da unidade A não recebe a própria diluição';
  END IF;
  BEGIN
    PERFORM public.salvar_diluicao(current_setting('teste.da_a')::uuid, '{}');
    RAISE EXCEPTION 'FALHOU: farmacêutico da unidade B mexeu na diluição da unidade A';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  unidade B não recebe nem mexe na diluição da unidade A';
END $$;

-- ── 3. o modelo da rede: só o super admin cria, muda e publica ─────────────
SELECT pg_temp.como('4d000000-0000-4000-8000-000000000003');
DO $$
DECLARE v uuid;
BEGIN
  v := public.salvar_diluicao(NULL, '{"medicamento_id": "4d400000-0000-4000-8000-000000000001", "via": "IM"}');
  IF (SELECT unidade_id FROM public.diluicao WHERE id = v) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: diluição do super admin sem unidade não ficou como modelo da rede';
  END IF;
  PERFORM public.salvar_diluicao(v, '{"fonte": "HU-UFGD v3, p. 40", "revisor_crf": "CRF-GO 9999"}');
  PERFORM set_config('teste.rede', v::text, true);
  RAISE NOTICE 'OK  super admin cria o rascunho do modelo da rede';
END $$;
SELECT pg_temp.como('4d000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  BEGIN
    PERFORM public.salvar_diluicao(current_setting('teste.rede')::uuid, '{"observacoes": "mudança da unidade"}');
    RAISE EXCEPTION 'FALHOU: farmacêutico mudou o rascunho do modelo da rede';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.publicar_diluicao_versao(current_setting('teste.rede')::uuid);
    RAISE EXCEPTION 'FALHOU: farmacêutico publicou o modelo da rede';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  farmacêutico não muda nem publica o modelo da rede';
END $$;
SELECT pg_temp.como('4d000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  PERFORM public.publicar_diluicao_versao(current_setting('teste.rede')::uuid);
  RAISE NOTICE 'OK  super admin publica o modelo da rede';
END $$;

-- ── 4. a unidade ajusta o modelo da rede na própria unidade ────────────────
SELECT pg_temp.como('4d000000-0000-4000-8000-000000000002');
DO $$
DECLARE v uuid;
BEGIN
  BEGIN
    PERFORM public.salvar_diluicao(current_setting('teste.rede')::uuid, '{}');   -- nova versão da linha da rede
    RAISE EXCEPTION 'FALHOU: farmacêutico criou nova versão do modelo da rede';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  v := public.ajustar_diluicao_unidade(current_setting('teste.rede')::uuid, '4d200000-0000-4000-8000-00000000000b');
  IF (SELECT unidade_id FROM public.diluicao WHERE id = v) IS DISTINCT FROM '4d200000-0000-4000-8000-00000000000b'::uuid THEN
    RAISE EXCEPTION 'FALHOU: "Ajustar esta linha" não criou o rascunho da unidade B';
  END IF;
  RAISE NOTICE 'OK  o ajuste da unidade continua pelo "Ajustar esta linha"';
END $$;

RESET ROLE;
CREATE TEMP TABLE resultado_teste ON COMMIT DROP AS SELECT 'todos os passos passaram'::text AS r;
SELECT * FROM resultado_teste;
ROLLBACK;
