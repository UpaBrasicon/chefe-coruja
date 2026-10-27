-- Testes da migration 20270106000001_cadastro_medicamentos.sql (telas do
-- farmacêutico, ponto 4, decisões do RT de 27/10/2026). Transação com ROLLBACK.
-- O cenário é criado aqui (rede, duas unidades, farmacêutico de cada uma e um
-- plantonista), sem depender do seed; por isso o teste roda também na
-- homologação, dentro da transação:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/cadastro_medicamentos.sql
BEGIN;

UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO auth.users (instance_id, id, aud, role, email)
SELECT '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@cadastro.teste'
FROM unnest(ARRAY['4f000000-0000-4000-8000-000000000001', '4f000000-0000-4000-8000-000000000002',
                  '4f000000-0000-4000-8000-000000000003']::uuid[]) u;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('4f000000-0000-4000-8000-000000000001', 'Farmacêutica da Unidade A'),
  ('4f000000-0000-4000-8000-000000000002', 'Farmacêutico da Unidade B'),
  ('4f000000-0000-4000-8000-000000000003', 'Plantonista da Unidade A')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;   -- o gatilho do auth.users já cria o perfil
INSERT INTO public.organizacoes (id, nome) VALUES ('4f100000-0000-4000-8000-000000000001', 'Rede do Teste do Cadastro');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('4f200000-0000-4000-8000-00000000000a', '4f100000-0000-4000-8000-000000000001', 'Unidade A do Teste', 'hospital'),
  ('4f200000-0000-4000-8000-00000000000b', '4f100000-0000-4000-8000-000000000001', 'Unidade B do Teste', 'hospital');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('4f000000-0000-4000-8000-000000000001', '4f200000-0000-4000-8000-00000000000a', 'farmaceutico'),
  ('4f000000-0000-4000-8000-000000000002', '4f200000-0000-4000-8000-00000000000b', 'farmaceutico'),
  ('4f000000-0000-4000-8000-000000000003', '4f200000-0000-4000-8000-00000000000a', 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome) VALUES
  ('4f300000-0000-4000-8000-000000000001', '4f200000-0000-4000-8000-00000000000a', 'Paciente do Teste do Cadastro');

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. só farmacêutico ou gestor da unidade cadastra ────────────────────────
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  BEGIN
    PERFORM public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000a', jsonb_build_object(
      'principio_ativo', 'Tetracaína teste', 'apresentacao', 'Frasco 10 mL', 'forma_farmaceutica', 'colirio', 'unidade_consumo', 'frasco'));
    RAISE EXCEPTION 'FALHOU: plantonista cadastrou medicamento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  plantonista não cadastra';
END $$;
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN
    PERFORM public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000a', jsonb_build_object(
      'principio_ativo', 'Tetracaína teste', 'apresentacao', 'Frasco 10 mL', 'forma_farmaceutica', 'colirio', 'unidade_consumo', 'frasco'));
    RAISE EXCEPTION 'FALHOU: farmacêutico de outra unidade cadastrou na unidade A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  farmacêutico de outra unidade não cadastra';
END $$;

-- ── 2. cadastro na unidade A: forma obrigatória; regra do ISMP no item novo ─
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000001');
DO $$
DECLARE r jsonb; m public.medicamento;
BEGIN
  BEGIN
    PERFORM public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000a', jsonb_build_object(
      'principio_ativo', 'Tetracaína teste', 'apresentacao', 'Frasco 10 mL', 'unidade_consumo', 'frasco'));
    RAISE EXCEPTION 'FALHOU: cadastro sem forma farmacêutica';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  r := public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000a', jsonb_build_object(
    'principio_ativo', 'Tetracaína teste', 'apresentacao', 'Frasco 10 mL', 'concentracao', '1%',
    'forma_farmaceutica', 'colirio', 'unidade_consumo', 'frasco'));
  PERFORM set_config('teste.colirio', r ->> 'id', true);
  SELECT * INTO m FROM public.medicamento WHERE id = (r ->> 'id')::uuid;
  IF m.unidades_locais <> ARRAY['4f200000-0000-4000-8000-00000000000a']::uuid[] OR m.principio_ativo_norm <> 'tetracaina teste'
     OR m.unidade_consumo_conferida_em IS NULL OR m.fonte <> 'farmacia' THEN
    RAISE EXCEPTION 'FALHOU: item novo sem unidade, sem nome comparável ou sem unidade de consumo conferida';
  END IF;
  r := public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000a', jsonb_build_object(
    'principio_ativo', 'Remifentanil teste', 'apresentacao', 'Frasco-ampola 2 mg pó', 'forma_farmaceutica', 'po_para_solucao_injetavel',
    'unidade_consumo', 'frasco_ampola'));
  IF (r ->> 'alta_vigilancia')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: opioide cadastrado pela farmácia sem a marca de alta vigilância';
  END IF;
  BEGIN
    PERFORM public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000a', jsonb_build_object(
      'principio_ativo', 'TETRACAINA  teste', 'apresentacao', 'frasco 10 ml', 'forma_farmaceutica', 'colirio', 'unidade_consumo', 'frasco'));
    RAISE EXCEPTION 'FALHOU: cadastrou o mesmo item duas vezes';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  cadastro com forma, unidade, nome comparável, alta vigilância e sem duplicata';
END $$;

-- ── 3. a unidade B não vê nem grava o item da unidade A ─────────────────────
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000002');
DO $$
DECLARE p jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.farmacia_estoque('4f200000-0000-4000-8000-00000000000b')
              WHERE medicamento_id = current_setting('teste.colirio')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: estoque da unidade B mostra o item da unidade A';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.medicamentos_unidade_consumo('tetracaina', false) -> 'itens') i
              WHERE i ->> 'id' = current_setting('teste.colirio')) THEN
    RAISE EXCEPTION 'FALHOU: lista da unidade de consumo mostra item de unidade que não é minha';
  END IF;
  p := public.medicamentos_parecidos('4f200000-0000-4000-8000-00000000000b', 'tetracaina');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p) i WHERE i ->> 'id' = current_setting('teste.colirio')
                   AND (i ->> 'na_unidade')::boolean IS FALSE AND i ->> 'origem' = 'Unidade A do Teste') THEN
    RAISE EXCEPTION 'FALHOU: parecidos não mostram o item da unidade A com a origem';
  END IF;
  BEGIN
    PERFORM public.atualizar_estoque('4f200000-0000-4000-8000-00000000000b', current_setting('teste.colirio')::uuid, 5);
    RAISE EXCEPTION 'FALHOU: unidade B gravou estoque do item da unidade A';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000b', jsonb_build_object(
      'principio_ativo', 'Tetracaína teste', 'apresentacao', 'Frasco 10 mL', 'forma_farmaceutica', 'colirio', 'unidade_consumo', 'frasco'));
    RAISE EXCEPTION 'FALHOU: unidade B cadastrou de novo o item da unidade A';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Usar nesta unidade%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.corrigir_medicamento(current_setting('teste.colirio')::uuid, '{"concentracao": "0,5%"}', 'Correção pela unidade B');
    RAISE EXCEPTION 'FALHOU: unidade B corrigiu o item da unidade A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  unidade B não vê, não grava, não duplica e não corrige o item da unidade A';
END $$;

-- ── 4. "usar nesta unidade": a unidade B passa a usar o item ───────────────
DO $$ BEGIN
  PERFORM public.usar_medicamento_na_unidade(current_setting('teste.colirio')::uuid, '4f200000-0000-4000-8000-00000000000b');
  PERFORM public.atualizar_estoque('4f200000-0000-4000-8000-00000000000b', current_setting('teste.colirio')::uuid, 5);
  IF NOT EXISTS (SELECT 1 FROM public.farmacia_estoque('4f200000-0000-4000-8000-00000000000b')
                  WHERE medicamento_id = current_setting('teste.colirio')::uuid AND quantidade = 5) THEN
    RAISE EXCEPTION 'FALHOU: depois de "usar nesta unidade" o estoque da unidade B não tem o item';
  END IF;
  RAISE NOTICE 'OK  usar nesta unidade libera o item na unidade B';
END $$;

-- ── 5. prescrição na unidade A de item que só a unidade B usa ──────────────
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000002');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.cadastrar_medicamento('4f200000-0000-4000-8000-00000000000b', jsonb_build_object(
    'principio_ativo', 'Fenazopiridina teste', 'apresentacao', 'Comprimido 100 mg', 'forma_farmaceutica', 'comprimido_revestido',
    'unidade_consumo', 'comprimido'));
  PERFORM set_config('teste.so_b', r ->> 'id', true);
END $$;
RESET ROLE;
DO $$
DECLARE v_presc uuid;
BEGIN
  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id)
  VALUES ('4f200000-0000-4000-8000-00000000000a', '4f300000-0000-4000-8000-000000000001', '4f000000-0000-4000-8000-000000000003')
  RETURNING id INTO v_presc;
  BEGIN
    INSERT INTO public.prescricao_itens (prescricao_id, medicamento_id, descricao)
    VALUES (v_presc, current_setting('teste.so_b')::uuid, 'Fenazopiridina teste');
    RAISE EXCEPTION 'FALHOU: prescrição da unidade A com item que só a unidade B usa';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, fonte)
    VALUES (current_setting('teste.so_b')::uuid, 'Fenazopiridina teste', 'Comprimido 100 mg', 'VO', 'teste');
    RAISE EXCEPTION 'FALHOU: diluição modelo da rede para item da unidade';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK  prescrição e diluição da rede recusam item de outra unidade';
END $$;
SET LOCAL ROLE authenticated;

-- ── 6. corrigir e inativar pela unidade de origem, com o registro ───────────
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  BEGIN
    PERFORM public.corrigir_medicamento(current_setting('teste.colirio')::uuid, '{"concentracao": "0,5%"}', 'curto');
    RAISE EXCEPTION 'FALHOU: correção sem motivo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  PERFORM public.corrigir_medicamento(current_setting('teste.colirio')::uuid, '{"concentracao": "0,5%"}', 'A concentração do frasco é 0,5%');
  PERFORM public.inativar_medicamento(current_setting('teste.colirio')::uuid, 'Fornecedor deixou de fabricar');
  RAISE NOTICE 'OK  correção e inativação pela unidade de origem';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.revisoes_cadastro WHERE registro_id = current_setting('teste.colirio')::uuid AND lote = 'tela'
        AND campo IN ('unidades_locais', 'concentracao', 'ativo')) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: revisoes_cadastro sem as três mudanças (usar, corrigir, inativar)';
  END IF;
  IF (SELECT concentracao FROM public.medicamento WHERE id = current_setting('teste.colirio')::uuid) <> '0,5%'
     OR (SELECT ativo FROM public.medicamento WHERE id = current_setting('teste.colirio')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: correção ou inativação não gravou';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade = 'medicamento' AND entidade_id = current_setting('teste.colirio')::uuid) < 4 THEN
    RAISE EXCEPTION 'FALHOU: auditoria sem cadastrar, usar, corrigir e inativar';
  END IF;
  RAISE NOTICE 'OK  revisões e auditoria registradas';
END $$;

-- ── 7. item da rede: forma pela farmácia; correção não é pela tela ──────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('4f000000-0000-4000-8000-000000000001');
DO $$
DECLARE v_rede uuid;
BEGIN
  SELECT id INTO v_rede FROM public.medicamento WHERE unidades_locais IS NULL AND ativo LIMIT 1;
  IF v_rede IS NULL THEN RAISE NOTICE 'OK  (sem item da rede neste banco: passo 7 pulado)'; RETURN; END IF;
  PERFORM public.definir_forma_farmaceutica(v_rede, 'outra', 'Forma de teste');
  IF (SELECT forma_farmaceutica_outra FROM public.medicamento WHERE id = v_rede) <> 'Forma de teste' THEN
    RAISE EXCEPTION 'FALHOU: forma do item da rede não gravou';
  END IF;
  BEGIN
    PERFORM public.corrigir_medicamento(v_rede, '{"concentracao": "1%"}', 'Tentando corrigir item da rede');
    RAISE EXCEPTION 'FALHOU: corrigiu item da rede pela tela';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  forma do item da rede pela farmácia; correção do item da rede recusada';
END $$;

ROLLBACK;
