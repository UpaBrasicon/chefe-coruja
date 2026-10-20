-- Testes da migration 20261208000001_imagem_no_sistema.sql (Fase 5C, tarefa 2,
-- etapa 2.1): catálogo com imagem e ECG; realizado pela enfermagem; link da
-- imagem; leitura do ECG pelo médico com foto; realizado segue pendente; a
-- porta do laboratório ignora imagem. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão agora no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
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

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Paciente Imagem Teste', 'data_nascimento', '1980-04-04')::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('a'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":38.1,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('a'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('a');
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp) VALUES
  ('0202990021', 'HEMOGRAMA TESTE IMAGEM', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 4.11, 0, 0),
  ('0204990021', 'RADIOGRAFIA DE TORAX TESTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 9.50, 0, 0),
  ('0211990021', 'ELETROCARDIOGRAMA TESTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 5.15, 0, 0),
  ('0301990021', 'CONSULTA TESTE NAO EXAME', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'), 10, 0, 0)
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em) VALUES
  ('LIS de teste', 'test', 'cc_test_abababab', private.api_hash('cc_test_' || repeat('ab', 24)), ARRAY['21000000-0000-4000-8000-000000000001']::uuid[],
   ARRAY['laboratorio'], '10000000-0000-4000-8000-000000000001', now() + interval '1 month');
-- desde a 2.2, o link só vale de domínio cadastrado pela unidade
INSERT INTO public.imagem_dominios (unidade_id, dominio) VALUES ('21000000-0000-4000-8000-000000000001', 'pacs.exemplo');
CREATE FUNCTION pg_temp.ex(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.exames_pedidos WHERE episodio_id = (SELECT valor::uuid FROM t WHERE nome = 'a') AND exame = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.ex(text) TO authenticated;

-- 2a. a lista aceita imagem e métodos gráficos; o tipo sai do código
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0301990021', 'Consulta')$$,
  'Procedimento 0301990021 não é de laboratório', 'procedimento que não é exame fica fora');
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0202990021', 'Hemograma', NULL, true, 1);
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0204990021', 'RX de tórax', NULL, true, 2);
SELECT public.definir_exame_unidade('21000000-0000-4000-8000-000000000001', '0211990021', 'ECG', NULL, true, 3);
DO $$
DECLARE l jsonb := public.exames_da_unidade('21000000-0000-4000-8000-000000000001') -> 'exames';
BEGIN
  IF (SELECT x ->> 'tipo' FROM jsonb_array_elements(l) x WHERE x ->> 'procedimento' = '0204990021') <> 'imagem'
     OR (SELECT x ->> 'tipo' FROM jsonb_array_elements(l) x WHERE x ->> 'procedimento' = '0202990021') <> 'laboratorio'
     OR public.buscar_exames('21000000-0000-4000-8000-000000000001', 'eletrocardiograma teste', true) -> 0 ->> 'tipo' <> 'imagem' THEN
    RAISE EXCEPTION 'FALHOU: catálogo com imagem: %', l;
  END IF;
  RAISE NOTICE 'OK  2a: lista com laboratório, imagem e ECG; o tipo sai do código';
END $$;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.pedir_exames(pg_temp.u('a'), '[{"procedimento":"0202990021"},{"procedimento":"0204990021"},{"procedimento":"0211990021"}]');

-- 5a. realizado pela enfermagem, só para imagem; coleta só para laboratório
SELECT pg_temp.falha(format('SELECT public.marcar_exame_realizado(%L)', pg_temp.ex('RX de tórax')),
  'Acesso negado: "realizado" é marcado pela enfermagem', 'médico não marca realizado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.marcar_exame_coletado(%L)', pg_temp.ex('RX de tórax')),
  'Exame de imagem não tem coleta', 'imagem não tem coleta');
SELECT pg_temp.falha(format('SELECT public.marcar_exame_realizado(%L)', pg_temp.ex('Hemograma')),
  'Só exame de imagem ou método gráfico', 'laboratório não é realizado');
SELECT pg_temp.falha(format('SELECT public.marcar_exame_realizado(%L, %L)', pg_temp.ex('RX de tórax'), 'http://pacs.local/x'),
  'O link da imagem precisa ser https://', 'link só https');
SELECT public.marcar_exame_realizado(pg_temp.ex('RX de tórax'), 'https://pacs.exemplo/estudo/123');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE r jsonb; d jsonb := public.exame_detalhe(pg_temp.ex('ECG'));
BEGIN
  SELECT x INTO r FROM jsonb_array_elements(public.painel_atendimento_ps(pg_temp.u('a')) -> 'exames') x WHERE x ->> 'exame' = 'RX de tórax';
  IF r ->> 'situacao' <> 'realizado' OR r ->> 'tipo' <> 'imagem' OR r ->> 'imagem_url' <> 'https://pacs.exemplo/estudo/123' OR r ->> 'realizado_em' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: realizado no painel: %', r;
  END IF;
  IF (d ->> 'pode_coletar')::boolean THEN RAISE EXCEPTION 'FALHOU: detalhe oferece coleta para imagem'; END IF;
  RAISE NOTICE 'OK  3a/5a: enfermagem marca realizado com o link da imagem; aparece no painel';
END $$;
SELECT pg_temp.falha(format('SELECT public.pedir_exames(%L, %L)', pg_temp.u('a'), '[{"procedimento":"0204990021"}]'),
  'Esses exames já estão pedidos', 'realizado conta como pendente no "já pedido"');
RESET ROLE;
DO $$ BEGIN
  IF array_to_string(private.pendencias_atendimento(pg_temp.u('a')), ' ') NOT LIKE '%RX de tórax%' THEN
    RAISE EXCEPTION 'FALHOU: realizado deveria impedir a alta';
  END IF;
  RAISE NOTICE 'OK  4a: imagem realizada sem laudo continua pendente para a alta';
END $$;

-- 6a. ECG: o médico registra a própria leitura com foto do traçado; link do PACS
INSERT INTO storage.objects (bucket_id, name) VALUES ('exames', pg_temp.ex('ECG') || '/tracado.jpg');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF NOT private.exame_pode_subir_laudo(pg_temp.ex('ECG') || '/tracado.jpg') OR private.exame_pode_subir_laudo(pg_temp.ex('Hemograma') || '/foto.jpg')
     OR NOT private.exame_pode_subir_laudo(pg_temp.ex('Hemograma') || '/laudo.pdf') THEN
    RAISE EXCEPTION 'FALHOU: foto só para imagem';
  END IF;
  RAISE NOTICE 'OK  6a: foto (JPG/PNG) só em exame de imagem; PDF em todos';
END $$;
SELECT public.registrar_resultado_exame(pg_temp.ex('ECG'), 'Ritmo sinusal, FC 78 bpm, sem alterações agudas (leitura do plantonista)',
  pg_temp.ex('ECG') || '/tracado.jpg', 'tracado.jpg');
SELECT pg_temp.falha(format('SELECT public.definir_link_imagem(%L, %L)', pg_temp.ex('Hemograma'), 'https://x'),
  'O link de imagem é só para exame de imagem', 'link só em exame de imagem');
SELECT public.definir_link_imagem(pg_temp.ex('ECG'), 'https://pacs.exemplo/estudo/456');
-- laudo à mão do RX realizado
SELECT public.registrar_resultado_exame(pg_temp.ex('RX de tórax'), 'Sem consolidações. Seios costofrênicos livres.');
DO $$
DECLARE e jsonb := public.exame_detalhe(pg_temp.ex('ECG')); r jsonb := public.exame_detalhe(pg_temp.ex('RX de tórax'));
BEGIN
  IF e ->> 'situacao' <> 'resultado' OR NOT (e -> 'versoes' -> 0 ->> 'tem_pdf')::boolean OR e ->> 'imagem_url' <> 'https://pacs.exemplo/estudo/456'
     OR r ->> 'situacao' <> 'resultado' OR r ->> 'realizado_em' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: leitura do ECG / laudo do RX: % / %', e, r;
  END IF;
  RAISE NOTICE 'OK  3a/6a: leitura do ECG pelo médico com o traçado; laudo do RX depois de realizado; link guardado';
END $$;
RESET ROLE;

-- a porta do laboratório só vê o grupo 02.02
DO $$
DECLARE r jsonb := public.api_v1_fhir('cc_test_' || repeat('ab', 24), NULL, 'r', 'pedidos', '{}');
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE x -> 'code' -> 'coding' -> 0 ->> 'code' NOT LIKE '0202%')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'corpo' -> 'pedidos') x WHERE x -> 'code' -> 'coding' -> 0 ->> 'code' = '0202990021') THEN
    RAISE EXCEPTION 'FALHOU: porta do laboratório com imagem: %', r;
  END IF;
  r := public.api_v1_fhir('cc_test_' || repeat('ab', 24), NULL, 'r', 'coleta', jsonb_build_object('exame_id', pg_temp.ex('RX de tórax')));
  IF (r ->> 'status')::int <> 403 OR public.api_fhir_pode_anexar('cc_test_' || repeat('ab', 24), pg_temp.ex('RX de tórax')) THEN
    RAISE EXCEPTION 'FALHOU: laboratório mexendo em exame de imagem: %', r;
  END IF;
  IF has_function_privilege('anon', 'public.marcar_exame_realizado(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.definir_link_imagem(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios';
  END IF;
  RAISE NOTICE 'OK  a porta do laboratório só vê e só mexe no grupo 02.02';
END $$;
ROLLBACK;
