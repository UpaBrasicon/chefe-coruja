-- Testes da migration 20260929000006_fase4_checagem.sql. ROLLBACK no fim.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Dipirona', 'dipirona', 'comprimido 500 mg', 'teste-checagem'),
  ('Ceftriaxona', 'ceftriaxona', 'pó 1 g', 'teste-checagem'),
  ('Noradrenalina (norepinefrina)', 'noradrenalina norepinefrina', 'solução 1 mg/mL', 'teste-checagem');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-checagem';
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
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Checagem Teste","data_nascimento":"1966-06-06"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.8,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
SELECT public.registrar_soap(pg_temp.u('ep'), 'dor', 'exame', 'avaliação', 'medicar e liberar', 'R52');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('ep'), 'alta_apos_medicacao'),
  'Alta após medicação: não há medicação prescrita', 'alta após medicação sem medicação prescrita não passa');
INSERT INTO t SELECT 'dip', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('dipirona'),
  'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')::jsonb);
INSERT INTO t SELECT 'cef', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('ceftriaxona'),
  'dose', '1 g', 'via', 'EV', 'posologia', '24/24h')::jsonb);
INSERT INTO t SELECT 'sos', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('noradrenalina norepinefrina'),
  'dose', '0,05 mcg/kg/min', 'via', 'EV', 'posologia', 'contínuo', 'se_necessario', true)::jsonb);
SELECT pg_temp.falha(format('SELECT public.aprazar(%L, %L)', pg_temp.u('cef'), '{08:00}'), 'O aprazamento é do enfermeiro',
  'aprazar é do enfermeiro');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('dip'), 'feito'), 'A checagem é da enfermagem',
  'recepção não checa');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.aprazar(%L, %L)', pg_temp.u('cef'), '{25:00}'), 'Horário inválido', 'horário fora de HH:MM é recusado');
SELECT public.aprazar(pg_temp.u('cef'), '{20:00,08:00}');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('dip'), 'recusado'), 'Diga o motivo', 'recusado exige motivo');
SELECT public.checar(pg_temp.u('dip'), 'recusado', NULL, 'paciente recusou por náusea');
SELECT public.checar(pg_temp.u('cef'), 'feito', '08:00');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('ep'), 'alta_apos_medicacao'),
  'Alta após medicação: falta a enfermagem checar como administrado: Dipirona', 'recusado não conta como administrado: a alta após medicação espera');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT private.vasoativos_prescritos(pg_temp.u('pac'))) <> 0 THEN RAISE EXCEPTION 'FALHOU: vasoativo antes de administrar'; END IF;
  RAISE NOTICE 'OK  vasoativo prescrito mas não administrado não conta no Phoenix';
  IF (SELECT horarios FROM public.prescricao_itens WHERE id = pg_temp.u('cef')) <> '{08:00,20:00}' THEN RAISE EXCEPTION 'FALHOU: aprazamento'; END IF;
  RAISE NOTICE 'OK  o aprazamento guarda os horários em ordem';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.checar(pg_temp.u('dip'), 'feito', NULL, NULL);
SELECT public.checar(pg_temp.u('sos'), 'feito');
INSERT INTO t SELECT 'fila', (SELECT count(*) FROM public.fila_checagem() WHERE paciente_id = pg_temp.u('pac'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'alta_apos_medicacao');
RESET ROLE;
DO $$
DECLARE ph jsonb;
BEGIN
  IF (SELECT desfecho FROM public.episodios WHERE id = pg_temp.u('ep')) <> 'alta_apos_medicacao' THEN RAISE EXCEPTION 'FALHOU: alta após medicação'; END IF;
  RAISE NOTICE 'OK  medicação checada como feita libera a alta após medicação (o "se necessário" não é exigido)';
  IF (SELECT valor FROM t WHERE nome = 'fila')::int <> 3 THEN RAISE EXCEPTION 'FALHOU: fila da enfermagem'; END IF;
  RAISE NOTICE 'OK  a fila da enfermagem mostra os itens ativos do paciente';
  BEGIN
    UPDATE public.administracoes SET situacao = 'feito' WHERE item_id = pg_temp.u('dip');
    RAISE EXCEPTION 'FALHOU: checagem alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%só de inserção%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  checagem é só de inserção: corrigir é checar de novo';
  ph := private.calcular_phoenix(pg_temp.u('pac'), 100, '{"motivo":"teste"}');
  IF private.vasoativos_prescritos(pg_temp.u('pac')) <> 1
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ph -> 'itens') x WHERE x ->> 'detalhe' LIKE '1 vasoativa(s) na prescrição checada%')
     OR (ph -> 'faltando') ? 'Drogas vasoativas (número)' THEN
    RAISE EXCEPTION 'FALHOU: Phoenix com vasoativo da prescrição (%)', ph;
  END IF;
  RAISE NOTICE 'OK  Phoenix conta o vasoativo administrado a partir da prescrição checada';
END $$;
ROLLBACK;
