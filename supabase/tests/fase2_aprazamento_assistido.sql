-- Fase 2, tarefa 2 — migration 20261031000002_aprazamento_assistido.sql: a
-- frequência sai da posologia, a sugestão vem da grade da unidade (padrão:
-- início às 06h), a enfermagem ajusta e cada aprazamento fica registrado.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.configuracoes_unidade WHERE chave = 'aprazamento_grade';
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
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Ceftriaxona', 'ceftriaxona', 'pó para solução injetável 1 g (teste)', 'teste-aprazamento'),
  ('Omeprazol', 'omeprazol', 'pó para solução injetável 40 mg (teste)', 'teste-aprazamento');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-aprazamento';
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

DO $$ BEGIN
  IF private.intervalo_posologia('8/8h') <> 8 OR private.intervalo_posologia('de 6 em 6 horas') <> 6
     OR private.intervalo_posologia('2x ao dia') <> 12 OR private.intervalo_posologia('1x/dia') <> 24
     OR private.intervalo_posologia('a cada 4 h') <> 4
     OR private.intervalo_posologia('Agora') IS NOT NULL OR private.intervalo_posologia('48/48h') IS NOT NULL
     OR private.intervalo_posologia('6/8h') IS NOT NULL OR private.intervalo_posologia('contínuo') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: frequência na posologia';
  END IF;
  RAISE NOTICE 'OK  frequência lida da posologia; 48/48h, "agora" e "contínuo" ficam com o enfermeiro';
  IF private.grade_aprazamento('21000000-0000-4000-8000-000000000001') #> '{grades,8,horarios}' <> '["06:00","14:00","22:00"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: grade padrão (%)', private.grade_aprazamento('21000000-0000-4000-8000-000000000001');
  END IF;
  RAISE NOTICE 'OK  sem configuração, a grade começa às 06:00 (8/8h = 06, 14, 22)';
END $$;

SET LOCAL ROLE authenticated;
-- a grade é do gestor
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.salvar_grade_aprazamento(%L, %L)', '21000000-0000-4000-8000-000000000001', '07:00'),
  'Acesso negado: a grade de aprazamento é do gestor', 'enfermagem não muda a grade');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.salvar_grade_aprazamento(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', '07:00',
  '{"8":["08:00","16:00"]}'), 'A grade de 8/8 h tem 3 horários', 'grade com número errado de horários é recusada');
SELECT pg_temp.falha(format('SELECT public.salvar_grade_aprazamento(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', '07:00',
  '{"5":["08:00"]}'), 'Intervalo 5 não tem grade', 'intervalo que não divide o dia é recusado');
SELECT public.salvar_grade_aprazamento('21000000-0000-4000-8000-000000000001', '07:00', '{"8":["16:00","08:00","00:00"]}');

-- paciente com dois itens: ceftriaxona 8/8h (grade da unidade) e omeprazol 12/12h (início 07:00)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Aprazamento Teste","data_nascimento":"1960-01-01"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.8,"saturacao-o2":98,"escala-dor":4,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'cef', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('ceftriaxona'),
  'dose', '1 g', 'via', 'EV', 'posologia', '8/8h')::jsonb);
INSERT INTO t SELECT 'ome', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('omeprazol'),
  'dose', '40 mg', 'via', 'EV', 'posologia', '12/12h')::jsonb);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'sug', public.sugestoes_aprazamento(ARRAY[pg_temp.u('cef'), pg_temp.u('ome')])::text;
-- aceita a sugestão da ceftriaxona; ajusta o omeprazol, com motivo
SELECT public.aprazar(pg_temp.u('cef'), '{00:00,08:00,16:00}');
SELECT public.aprazar(pg_temp.u('ome'), '{09:00,21:00}', 'Jejum para exame às 07:00');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.aprazar(%L, %L)', pg_temp.u('ome'), '{10:00,22:00}'), 'O aprazamento é do enfermeiro',
  'médico não apraza');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'depois', public.sugestoes_aprazamento(ARRAY[pg_temp.u('ome')])::text;
RESET ROLE;

DO $$
DECLARE s jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'sug'); cef jsonb; ome jsonb; d jsonb;
BEGIN
  SELECT x -> 'sugestao' INTO cef FROM jsonb_array_elements(s) x WHERE x ->> 'item_id' = pg_temp.u('cef')::text;
  SELECT x -> 'sugestao' INTO ome FROM jsonb_array_elements(s) x WHERE x ->> 'item_id' = pg_temp.u('ome')::text;
  IF cef -> 'horarios' <> '["00:00","08:00","16:00"]'::jsonb OR cef ->> 'origem' <> 'grade da unidade' THEN
    RAISE EXCEPTION 'FALHOU: sugestão da grade da unidade (%)', cef;
  END IF;
  IF ome -> 'horarios' <> '["07:00","19:00"]'::jsonb OR ome ->> 'origem' <> 'início da unidade às 07:00' THEN
    RAISE EXCEPTION 'FALHOU: sugestão pelo início da unidade (%)', ome;
  END IF;
  IF NOT (cef -> 'horarios') ? (cef ->> 'primeira') THEN RAISE EXCEPTION 'FALHOU: primeira dose fora da grade (%)', cef; END IF;
  RAISE NOTICE 'OK  sugestão: grade da unidade para 8/8h; início 07:00 para 12/12h; diz a primeira dose depois da prescrição';
  IF (SELECT ajustado FROM public.aprazamentos WHERE item_id = pg_temp.u('cef')) IS NOT FALSE
     OR (SELECT ajustado FROM public.aprazamentos WHERE item_id = pg_temp.u('ome')) IS NOT TRUE
     OR (SELECT por FROM public.aprazamentos WHERE item_id = pg_temp.u('ome')) <> '10000000-0000-4000-8000-000000000004' THEN
    RAISE EXCEPTION 'FALHOU: registro do aprazamento';
  END IF;
  d := (SELECT valor::jsonb FROM t WHERE nome = 'depois') -> 0 -> 'ultimo';
  IF d ->> 'motivo' <> 'Jejum para exame às 07:00' OR NOT (d ->> 'ajustado')::boolean OR d -> 'sugeridos' <> '["07:00","19:00"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: último aprazamento na checagem (%)', d;
  END IF;
  RAISE NOTICE 'OK  aceitar a sugestão e ajustar ficam registrados (quem, sugerido, escolhido, motivo)';
  IF (SELECT horarios FROM public.prescricao_itens WHERE id = pg_temp.u('ome')) <> '{09:00,21:00}' THEN
    RAISE EXCEPTION 'FALHOU: horários do item';
  END IF;
  BEGIN
    UPDATE public.aprazamentos SET motivo = 'outro' WHERE item_id = pg_temp.u('ome');
    RAISE EXCEPTION 'FALHOU: aprazamento alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  aprazamento é só de inserção';
  IF has_table_privilege('authenticated', 'public.aprazamentos', 'INSERT')
     OR has_function_privilege('anon', 'public.aprazar(uuid, text[], text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.salvar_grade_aprazamento(uuid, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
