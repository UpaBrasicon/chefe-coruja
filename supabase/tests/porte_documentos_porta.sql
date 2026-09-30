-- Testes da migration 20261005000002_documentos_porta.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_documentos_porta.sql
--
-- Gestor (…0001) e plantonista (…0002) da unidade do seed. O plantonista está
-- escalado agora na Clínica Médica (…22…0001), onde fica o paciente internado
-- criado aqui (…0096), com uma classificação de risco na porta.
BEGIN;

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
VALUES ('23000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000001', 'Paciente do Teste de Documentos',
        '1970-05-05', 'T-096', '22000000-0000-4000-8000-000000000001', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000096',
        '22000000-0000-4000-8000-000000000001', 'atendimento', 'Febre e dispneia', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours');
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, avaliacao, autor_id, autor_papel, queixa, criado_em)
VALUES ('25000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000096',
        'amarelo', 'adulto', '{"comorbidades":"HAS","medicacoes":"Losartana","glasgow":15}', '10000000-0000-4000-8000-000000000004',
        'enfermeiro', 'Febre há 3 dias', now() - interval '2 hours');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
SELECT '24000000-0000-4000-8000-000000000096', u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000096',
       'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 hour', '25000000-0000-4000-8000-000000000096'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN raise_exception OR check_violation OR insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. triagem recente: só com o prontuário aberto ──────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.triagem_recente_do_paciente('23000000-0000-4000-8000-000000000096')$$,
  'triagem lida sem abrir o prontuário');
SELECT public.abrir_prontuario('23000000-0000-4000-8000-000000000096');
DO $$
DECLARE t jsonb := public.triagem_recente_do_paciente('23000000-0000-4000-8000-000000000096');
BEGIN
  IF t ->> 'cor' <> 'amarelo' OR t #>> '{avaliacao,comorbidades}' <> 'HAS' OR t #>> '{avaliacao,medicacoes}' <> 'Losartana' THEN
    RAISE EXCEPTION 'FALHOU: triagem recente não trouxe cor e avaliação (%)', t;
  END IF;
  RAISE NOTICE 'OK  triagem recente (prontuário aberto; cor, comorbidades e medicações)';
END $$;

-- ── 2. detalhes da admissão: só o gestor configura ──────────────────────────
SELECT pg_temp.negado($$SELECT public.salvar_admissao_esquema('21000000-0000-4000-8000-000000000001', 'Via de chegada', ARRAY['SAMU'])$$,
  'plantonista configurou esquema');
SELECT pg_temp.negado($$SELECT public.definir_admissao_detalhes_obrigatorio('22000000-0000-4000-8000-000000000001', true)$$,
  'plantonista tornou obrigatório');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.negado($$SELECT public.salvar_admissao_esquema('21000000-0000-4000-8000-000000000001', 'Vazio', ARRAY['  '])$$,
  'esquema sem item');
SELECT public.salvar_admissao_esquema('21000000-0000-4000-8000-000000000001', 'Via de chegada', ARRAY['SAMU', 'Demanda espontânea', 'SAMU']);
SELECT public.definir_admissao_detalhes_obrigatorio('22000000-0000-4000-8000-000000000001', true);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE c jsonb := public.admissao_detalhes_config('21000000-0000-4000-8000-000000000001');
BEGIN
  IF jsonb_array_length(c -> 'esquemas') <> 1 OR jsonb_array_length(c #> '{esquemas,0,itens}') <> 2
     OR NOT (c -> 'obrigatorios') ? '22000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'FALHOU: configuração lida pelo plantonista (%)', c;
  END IF;
  RAISE NOTICE 'OK  detalhes da admissão (gestor escreve, itens sem repetir, plantonista lê)';
END $$;

-- ── 3. ficha de admissão: pendências conferidas no servidor ─────────────────
SELECT pg_temp.negado($$SELECT public.registrar_admissao('24000000-0000-4000-8000-000000000096', 'Admissão de teste com texto suficiente',
  '{"subjetivo":"Febre","objetivo":"BEG","cid":"A90 — Dengue","plano":"Hidratação"}')$$, 'admissão sem detalhes em setor obrigatório');
SELECT pg_temp.negado($$SELECT public.registrar_admissao('24000000-0000-4000-8000-000000000096', 'Admissão de teste com texto suficiente',
  '{"subjetivo":"Febre","objetivo":"BEG","cid":"A90","plano":"Hidratação","detalhes":[{"esquema":"Via de chegada","item":"Helicóptero"}]}')$$,
  'detalhe fora da configuração');
SELECT pg_temp.negado($$SELECT public.registrar_admissao('24000000-0000-4000-8000-000000000096', 'Admissão de teste com texto suficiente',
  '{"objetivo":"BEG","cid":"A90","plano":"Hidratação","detalhes":[{"esquema":"Via de chegada","item":"SAMU"}]}')$$, 'admissão sem subjetivo');
DO $$
DECLARE v uuid; f jsonb;
BEGIN
  v := public.registrar_admissao('24000000-0000-4000-8000-000000000096', 'FICHA DE ADMISSÃO MÉDICA — texto do teste',
    '{"procedencia":"SAMU 192","subjetivo":"Febre há 3 dias","objetivo":"BEG, corado","pa":"120/80","cid":"A90 — Dengue","plano":"Hidratação venosa e reavaliação","detalhes":[{"esquema":"Via de chegada","item":"SAMU"}]}');
  IF (SELECT tipo_documento FROM public.documentos_clinicos WHERE id = v) <> 'admissao_anamnese' THEN
    RAISE EXCEPTION 'FALHOU: admissão não virou documento do prontuário';
  END IF;
  f := public.admissao_ficha('24000000-0000-4000-8000-000000000096');
  IF f ->> 'procedencia' <> 'SAMU 192' OR f ->> 'cid' <> 'A90 — Dengue' OR jsonb_array_length(f -> 'detalhes') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: ficha estruturada não voltou (%)', f;
  END IF;
  RAISE NOTICE 'OK  ficha de admissão (pendências, detalhes da configuração, texto no prontuário, campos do protótipo)';
END $$;
SELECT pg_temp.negado($$SELECT public.registrar_admissao('24000000-0000-4000-8000-000000000096', 'Segunda admissão com texto suficiente',
  '{"subjetivo":"x","objetivo":"y","cid":"A90","plano":"z","detalhes":[{"esquema":"Via de chegada","item":"SAMU"}]}')$$, 'segunda admissão da internação');

-- ── 4. laudos de AIH do plantão ─────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  PERFORM public.emitir_documento('23000000-0000-4000-8000-000000000096', 'laudo_aih',
    '{"aih":{"cid":"A91","procCod":"03.03.01.002-9","procDesc":"Tratamento de dengue hemorrágica"}}');
  SELECT * INTO r FROM public.meus_laudos_aih_do_plantao() LIMIT 1;
  IF r.cid IS DISTINCT FROM 'A91' OR r.procedimento NOT LIKE '03.03.01.002-9%' OR r.numero IS NULL THEN
    RAISE EXCEPTION 'FALHOU: laudo emitido não aparece na lista do plantão (%)', r;
  END IF;
  RAISE NOTICE 'OK  laudos de AIH emitidos no plantão';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.meus_laudos_aih_do_plantao()) THEN
    RAISE EXCEPTION 'FALHOU: gestor vê laudo que não emitiu';
  END IF;
  RAISE NOTICE 'OK  cada um vê só os próprios laudos';
END $$;

-- ── 5. protocolos de receita: gestor escreve, médico lê ─────────────────────
SELECT pg_temp.negado($$SELECT public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'Sem posologia', 'Teste',
  '[{"medicamento":"Dipirona 500 mg","posologia":""}]', NULL, true, '1', 'Protocolo da unidade, teste')$$, 'protocolo sem posologia');
SELECT public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'Dor leve', 'Analgesia de alta',
  '[{"medicamento":"Paracetamol 500 mg comprimido","posologia":"Texto escrito pela unidade","quantidade":"10 comprimidos"}]',
  NULL, true, '1', 'Protocolo da unidade, teste');  -- publicar exige versão e fonte (migration 20261007000002)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.negado($$SELECT public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'Do médico', 'x',
  '[{"medicamento":"Paracetamol","posologia":"Texto"}]')$$, 'plantonista escreveu protocolo da instituição');
DO $$
DECLARE p jsonb := public.receita_protocolos_da_unidade('21000000-0000-4000-8000-000000000001');
BEGIN
  IF jsonb_array_length(p) <> 1 OR p #>> '{0,itens,0,medicamento}' <> 'Paracetamol 500 mg comprimido' THEN
    RAISE EXCEPTION 'FALHOU: protocolos lidos pelo plantonista (%)', p;
  END IF;
  RAISE NOTICE 'OK  protocolos de receita (gestor escreve, posologia obrigatória, médico lê)';
END $$;

-- ── 6. tabelas novas fechadas para leitura direta ───────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admissao_fichas) OR EXISTS (SELECT 1 FROM public.receita_protocolos)
     OR EXISTS (SELECT 1 FROM public.admissao_detalhes_esquemas) THEN
    RAISE EXCEPTION 'FALHOU: tabela nova legível sem RPC';
  END IF;
  RAISE NOTICE 'OK  tabelas novas só pelas RPCs';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  tabelas novas só pelas RPCs';
END $$;

ROLLBACK;
