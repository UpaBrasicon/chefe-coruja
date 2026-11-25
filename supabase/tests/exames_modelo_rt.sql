-- Testes das migrations 20270425000010 a 012 (aba Exames do leito no modelo do
-- RT, 25/11/2026): pedido com observação por item, indicação e CID (e o pedido
-- do jeito antigo), combos do gestor, laudo em imagem, "alterado" do médico,
-- lançamento manual estruturado e a leitura dos resultados da internação.
-- O preparo é o de laudo_por_grupo.sql. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990041', 'HEMOGRAMA TESTE MODELO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0202990042', 'POTASSIO TESTE MODELO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 1.85, 0, 0),
  ('0211990041', 'ELETROCARDIOGRAMA TESTE MODELO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 5.15, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;

-- CID do pedido
DO $$ BEGIN
  IF private.cid_do_pedido('a419') <> 'A41.9' OR private.cid_do_pedido('A41.9 — Sepse') <> 'A41.9'
     OR private.cid_do_pedido('I10') <> 'I10' OR private.cid_do_pedido('  ') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: CID do pedido';
  END IF;
  RAISE NOTICE 'OK  CID do pedido no formato A41.9';
END $$;

-- paciente cadastrado no PS e internado na Observação
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Paciente Do Modelo","data_nascimento":"1971-04-04"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, setor_atual_id, status)
SELECT u.organizacao_id, u.id, pg_temp.u('pac'), pg_temp.u('ep'), '22000000-0000-4000-8000-000000000002', 'internado'
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'int', id::text FROM public.internacoes WHERE paciente_id = pg_temp.u('pac') AND data_alta IS NULL;

-- EXM3/EXM4: o médico pede com observação por item, indicação e CID; o jeito antigo continua
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($$SELECT public.pedir_exames_internacao(%L, '[{"procedimento":"0202990041","cid":"sepse"}]', 'laboratorio')$$, pg_temp.u('int')),
  'CID-10 no formato', 'CID fora do formato é recusado');
SELECT pg_temp.falha(format($$SELECT public.pedir_exames_internacao(%L, %L, 'laboratorio')$$, pg_temp.u('int'),
  jsonb_build_array(jsonb_build_object('procedimento', '0202990041', 'obs', repeat('x', 301)))), 'Observação de', 'observação do item longa é recusada');
DO $$
DECLARE x jsonb;
BEGIN
  x := public.pedir_exames_internacao(pg_temp.u('int'),
    '[{"procedimento":"0202990041","obs":"jejum","indicacao":"Febre sem foco","cid":"a419"},{"nome":"Lactato teste modelo","indicacao":"Febre sem foco","cid":"A41.9"}]',
    'laboratorio', 'urgente', 'observação geral');
  IF (x ->> 'pedidos')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: pedido com campos novos — %', x; END IF;
  -- do jeito antigo: sem os campos novos
  x := public.pedir_exames_internacao(pg_temp.u('int'), '[{"procedimento":"0211990041"}]', 'grafico');
  IF (x ->> 'pedidos')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: pedido do jeito antigo — %', x; END IF;
  x := public.pedir_exames_internacao(pg_temp.u('int'), '[{"procedimento":"0202990042"}]', 'laboratorio');
  IF (x ->> 'pedidos')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: segundo pedido de laboratório — %', x; END IF;
  RAISE NOTICE 'OK  pedido com observação, indicação e CID; e do jeito antigo';
END $$;
RESET ROLE;
INSERT INTO t SELECT 'hemo', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND procedimento = '0202990041';
INSERT INTO t SELECT 'lact', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND exame = 'Lactato teste modelo';
INSERT INTO t SELECT 'ecg', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND procedimento = '0211990041';
INSERT INTO t SELECT 'k', id::text FROM public.exames_pedidos WHERE internacao_id = pg_temp.u('int') AND procedimento = '0202990042';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.exames_pedidos WHERE id = pg_temp.u('hemo') AND observacao = 'jejum' AND indicacao = 'Febre sem foco' AND cid = 'A41.9' AND urgencia = 'urgente')
     OR NOT EXISTS (SELECT 1 FROM public.exames_pedidos WHERE id = pg_temp.u('lact') AND observacao = 'observação geral' AND cid = 'A41.9')
     OR NOT EXISTS (SELECT 1 FROM public.exames_pedidos WHERE id = pg_temp.u('ecg') AND observacao IS NULL AND indicacao IS NULL AND cid IS NULL) THEN
    RAISE EXCEPTION 'FALHOU: colunas do pedido';
  END IF;
  RAISE NOTICE 'OK  observação do item (ou a geral), indicação e CID gravados; o pedido antigo fica sem eles';
END $$;

-- 1. laudo em imagem (WEBP) num exame de laboratório
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF NOT private.exame_pode_subir_laudo(pg_temp.u('ecg') || '/123-laudo.webp')
     OR NOT private.exame_pode_subir_laudo(pg_temp.u('ecg') || '/123-laudo.pdf')
     OR private.exame_pode_subir_laudo(pg_temp.u('ecg') || '/123-laudo.gif') THEN
    RAISE EXCEPTION 'FALHOU: tipos do laudo';
  END IF;
  RAISE NOTICE 'OK  laudo em PDF, JPG, PNG ou WEBP; GIF não';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT ('image/webp' = ANY ((SELECT allowed_mime_types FROM storage.buckets WHERE id = 'exames'))) THEN
    RAISE EXCEPTION 'FALHOU: bucket sem WEBP';
  END IF;
  RAISE NOTICE 'OK  bucket exames aceita WEBP';
END $$;
INSERT INTO storage.objects (bucket_id, name) VALUES ('exames', pg_temp.u('ecg') || '/123-tracado.webp');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_resultado_exame(pg_temp.u('ecg'), NULL, pg_temp.u('ecg') || '/123-tracado.webp', 'tracado.webp');

-- 3. lançamento manual estruturado
SELECT pg_temp.falha(format($$SELECT public.registrar_resultado_estruturado(%L, now() + interval '1 hour', '[{"analito":"Hb","valor":"10"}]')$$, pg_temp.u('hemo')),
  'A coleta não pode ser no futuro', 'coleta no futuro é recusada');
SELECT pg_temp.falha(format($$SELECT public.registrar_resultado_estruturado(%L, now(), '[{"analito":"Hb","valor":""}]')$$, pg_temp.u('hemo')),
  'Informe o valor de Hb', 'valor vazio é recusado');
SELECT pg_temp.falha(format($$SELECT public.registrar_resultado_estruturado(%L, now(), '[]')$$, pg_temp.u('hemo')),
  'Informe ao menos um valor', 'sem valores é recusado');
SELECT pg_temp.falha(format($$SELECT public.registrar_resultado_estruturado(%L, now(), '[{"analito":"X","valor":"1"}]')$$, pg_temp.u('ecg')),
  'Este exame já tem resultado', 'exame com resultado não recebe lançamento');
DO $$
DECLARE d jsonb;
BEGIN
  d := public.registrar_resultado_estruturado(pg_temp.u('hemo'), now() - interval '30 minutes',
    '[{"analito":"Hemoglobina","valor":"10,4","unidade":"g/dL","referencia":"12-16","marca":"L","critico":true},{"analito":"Leucócitos","valor":"14.200"},{"analito":"","valor":""}]');
  IF d ->> 'situacao' <> 'resultado' OR (d ->> 'critico')::boolean OR d -> 'versoes' -> 0 ->> 'origem' <> 'manual'
     OR jsonb_array_length(d -> 'versoes' -> 0 -> 'itens') <> 2 OR d -> 'versoes' -> 0 ->> 'coleta_em' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: lançamento estruturado — %', d;
  END IF;
  RAISE NOTICE 'OK  lançamento à mão com dois valores e a hora da coleta, sem crítico';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.exame_resultado_itens i JOIN public.exame_resultados r ON r.id = i.resultado_id
              WHERE r.exame_id = pg_temp.u('hemo') AND (i.unidade IS NOT NULL OR i.referencia IS NOT NULL OR i.marca IS NOT NULL OR i.critico)) THEN
    RAISE EXCEPTION 'FALHOU: item manual com unidade, faixa, marca ou crítico';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exame_resultado_itens i JOIN public.exame_resultados r ON r.id = i.resultado_id
                  WHERE r.exame_id = pg_temp.u('hemo') AND i.analito = 'Hemoglobina' AND i.valor_texto = '10,4' AND i.valor_num = 10.4) THEN
    RAISE EXCEPTION 'FALHOU: valor do item manual';
  END IF;
  RAISE NOTICE 'OK  item à mão só com nome e valor (unidade, faixa, marca e crítico não entram)';
END $$;

-- 2. "alterado": só o médico, com autor e hora; o crítico não muda
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.marcar_resultado_alterado(%L, true)', pg_temp.u('hemo')),
  'Acesso negado: quem marca o resultado como alterado', 'enfermagem não marca alterado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.marcar_resultado_alterado(%L, true)', pg_temp.u('k')),
  'Este exame ainda não tem resultado', 'sem resultado não há o que marcar');
DO $$
DECLARE d jsonb;
BEGIN
  d := public.marcar_resultado_alterado(pg_temp.u('hemo'), true);
  IF d -> 'versoes' -> 0 ->> 'alterado_em' IS NULL OR d -> 'versoes' -> 0 ->> 'alterado_por' IS NULL
     OR (d ->> 'critico')::boolean OR NOT (d ->> 'pode_marcar_alterado')::boolean THEN
    RAISE EXCEPTION 'FALHOU: marcar alterado — %', d;
  END IF;
  d := public.marcar_resultado_alterado(pg_temp.u('ecg'), true);
  d := public.marcar_resultado_alterado(pg_temp.u('ecg'), false);
  IF d -> 'versoes' -> 0 ->> 'alterado_em' IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: desmarcar alterado — %', d; END IF;
  RAISE NOTICE 'OK  o médico marca e desmarca "alterado", com autor; o crítico segue falso';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.log_auditoria a WHERE a.entidade_id = pg_temp.u('ecg') AND a.acao IN ('exame_resultado_alterado', 'exame_resultado_alterado_desfeito')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: auditoria do alterado';
  END IF;
  RAISE NOTICE 'OK  marcar e desmarcar ficam na auditoria';
END $$;

-- 4. resultados da internação: arquivo, alterado e analitos; a recepção não vê
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE r jsonb := public.resultados_da_internacao(pg_temp.u('int'));
BEGIN
  IF jsonb_array_length(r) <> 2
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r) x WHERE (x ->> 'exame_id')::uuid = pg_temp.u('ecg') AND (x ->> 'tem_arquivo')::boolean AND x ->> 'arquivo_nome' = 'tracado.webp')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r) x WHERE (x ->> 'exame_id')::uuid = pg_temp.u('hemo') AND jsonb_array_length(x -> 'itens') = 2
                     AND x ->> 'alterado_em' IS NOT NULL AND x ->> 'coleta_em' IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: resultados da internação — %', r;
  END IF;
  RAISE NOTICE 'OK  resultados da internação com arquivo, alterado, coleta e analitos';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF jsonb_array_length(public.resultados_da_internacao(pg_temp.u('int'))) <> 0 THEN RAISE EXCEPTION 'FALHOU: recepção vê resultado'; END IF;
  RAISE NOTICE 'OK  a recepção não vê resultado';
END $$;

-- EXM2: combos do gestor, só com exames da lista da unidade
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990041', 'Hemograma modelo', NULL, true, 1);
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990042', 'Potássio modelo', NULL, true, 2);
SELECT pg_temp.falha($$SELECT public.definir_combo_exames('21000000-0000-4000-8000-000000000001', 'Admissão teste', ARRAY['0202990041', '0211990041'])$$,
  'Exame fora da lista da unidade', 'combo só com exames da lista');
SELECT pg_temp.falha($$SELECT public.definir_combo_exames('21000000-0000-4000-8000-000000000001', 'A', ARRAY['0202990041'])$$,
  'Nome do combo entre 2 e 60 letras', 'nome curto demais é recusado');
DO $$
DECLARE l jsonb; v_id uuid;
BEGIN
  l := public.definir_combo_exames('21000000-0000-4000-8000-000000000001', 'Admissão teste', ARRAY['02.02.99.004-2', '0202990041', '0202990041']);
  IF jsonb_array_length(l -> 'combos') <> 1 OR jsonb_array_length(l -> 'combos' -> 0 -> 'itens') <> 2
     OR l -> 'combos' -> 0 -> 'itens' -> 0 ->> 'nome_curto' <> 'Potássio modelo' OR NOT (l ->> 'pode_definir')::boolean THEN
    RAISE EXCEPTION 'FALHOU: combo incluído — %', l;
  END IF;
  v_id := (l -> 'combos' -> 0 ->> 'id')::uuid;
  l := public.definir_combo_exames('21000000-0000-4000-8000-000000000001', 'Admissão teste', ARRAY['0202990041'], v_id, 3);
  IF jsonb_array_length(l -> 'combos') <> 1 OR jsonb_array_length(l -> 'combos' -> 0 -> 'itens') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: combo alterado — %', l;
  END IF;
  INSERT INTO t VALUES ('combo', l -> 'combos' -> 0 ->> 'id');
  RAISE NOTICE 'OK  o gestor inclui e muda o combo (sem repetir exame, na ordem dada)';
END $$;
SELECT pg_temp.falha($$SELECT public.definir_combo_exames('21000000-0000-4000-8000-000000000001', 'admissão TESTE', ARRAY['0202990042'])$$,
  'Já há um combo com o nome', 'nome repetido é recusado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.definir_combo_exames('21000000-0000-4000-8000-000000000001', 'Do médico', ARRAY['0202990041'])$$,
  'Acesso negado: os combos de exames são do gestor', 'médico não monta combo');
DO $$
DECLARE l jsonb := public.combos_exames_unidade('21000000-0000-4000-8000-000000000001');
BEGIN
  IF jsonb_array_length(l -> 'combos') <> 1 OR (l ->> 'pode_definir')::boolean THEN RAISE EXCEPTION 'FALHOU: médico lê os combos — %', l; END IF;
  RAISE NOTICE 'OK  o médico lê os combos, sem poder mudar';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.retirar_combo_exames(%L, %L)', pg_temp.u('combo'), 'curto'), 'Diga por que o combo sai', 'retirar pede motivo');
DO $$ BEGIN
  IF jsonb_array_length(public.retirar_combo_exames(pg_temp.u('combo'), 'não se usa mais aqui') -> 'combos') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: retirar combo';
  END IF;
  RAISE NOTICE 'OK  o gestor retira o combo com motivo';
END $$;
SELECT pg_temp.falha('SELECT count(*) FROM public.exames_combos', 'permission denied', 'a tabela de combos não tem acesso direto');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.exames_combos WHERE unidade_id = '21000000-0000-4000-8000-000000000001' AND nome = 'Admissão teste') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: versões do combo';
  END IF;
  RAISE NOTICE 'OK  as versões do combo ficam guardadas';
END $$;
ROLLBACK;
