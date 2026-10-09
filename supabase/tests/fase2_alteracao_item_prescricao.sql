-- Fase 2, tarefa 6 — migration 20261031000004_alteracao_item_prescricao.sql:
-- só o médico altera, com motivo; a versão anterior fica guardada (suspensa,
-- com as checagens dela); a nova passa pelas travas da prescrição; a
-- enfermagem vê o aviso.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
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
  ('Ceftriaxona', 'ceftriaxona', 'pó para solução injetável 1 g (teste alt)', 'teste-alteracao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-alteracao';
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
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Alteração Teste","data_nascimento":"1970-07-07"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'verde',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":16,"temperatura":38.2,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'v1', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('ceftriaxona'),
  'dose', '1 g', 'via', 'EV', 'posologia', '12/12h')::jsonb);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.aprazar(pg_temp.u('v1'), '{08:00,20:00}');
SELECT public.checar(pg_temp.u('v1'), 'feito', '08:00');
-- enfermagem não altera
SELECT pg_temp.falha(format('SELECT public.alterar_item_prescricao(%L, %L, %L)', pg_temp.u('v1'), '{"dose":"2 g"}', 'Ajuste de dose'),
  'Alterar a prescrição é do médico', 'enfermagem não altera a prescrição');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.alterar_item_prescricao(%L, %L, %L)', pg_temp.u('v1'), '{"dose":"2 g"}', 'x'),
  'Diga por que altera', 'alteração sem motivo é recusada');
SELECT pg_temp.falha(format('SELECT public.alterar_item_prescricao(%L, %L, %L)', pg_temp.u('v1'), '{"dose":"1 g"}', 'Sem mudança real'),
  'Nada mudou', 'alteração sem mudança é recusada');
-- dose muda, frequência não: herda o aprazamento
INSERT INTO t SELECT 'v2', public.alterar_item_prescricao(pg_temp.u('v1'), '{"dose":"2 g"}', 'Meningite: dose de SNC');
-- frequência muda: volta a pedir aprazamento
INSERT INTO t SELECT 'v3', public.alterar_item_prescricao(pg_temp.u('v2'), '{"posologia":"24/24h"}', 'Simplificar para dose diária');
SELECT pg_temp.falha(format('SELECT public.alterar_item_prescricao(%L, %L, %L)', pg_temp.u('v1'), '{"dose":"3 g"}', 'Versão antiga'),
  'Item não encontrado ou já suspenso', 'versão anterior não se altera de novo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'alt', public.alteracoes_de_itens(ARRAY[pg_temp.u('v3')])::text;
INSERT INTO t SELECT 'fila', (SELECT count(*) FROM public.fila_checagem() WHERE paciente_id = pg_temp.u('pac'))::text;
RESET ROLE;

DO $$
DECLARE a jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'alt') -> 0;
BEGIN
  IF (SELECT motivo_suspensao FROM public.prescricao_itens WHERE id = pg_temp.u('v1')) <> 'Alterado: Meningite: dose de SNC'
     OR (SELECT suspenso_em FROM public.prescricao_itens WHERE id = pg_temp.u('v2')) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: versões anteriores suspensas com o motivo';
  END IF;
  IF (SELECT count(*) FROM public.administracoes WHERE item_id = pg_temp.u('v1')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: checagem da versão anterior';
  END IF;
  RAISE NOTICE 'OK  a versão anterior fica guardada, suspensa com o motivo, com as checagens dela';
  IF (SELECT versao FROM public.prescricao_itens WHERE id = pg_temp.u('v3')) <> 3
     OR (SELECT substitui_item_id FROM public.prescricao_itens WHERE id = pg_temp.u('v3')) <> pg_temp.u('v2')
     OR (SELECT dose FROM public.prescricao_itens WHERE id = pg_temp.u('v3')) <> '2 g' THEN
    RAISE EXCEPTION 'FALHOU: cadeia de versões';
  END IF;
  RAISE NOTICE 'OK  cada versão aponta a anterior e leva o número (v3 = 2 g 24/24h)';
  IF (SELECT horarios FROM public.prescricao_itens WHERE id = pg_temp.u('v2')) <> '{08:00,20:00}'
     OR (SELECT horarios FROM public.prescricao_itens WHERE id = pg_temp.u('v3')) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: aprazamento herdado só sem mudança de frequência';
  END IF;
  RAISE NOTICE 'OK  mesma frequência herda o aprazamento; frequência nova pede aprazamento';
  IF a ->> 'motivo' <> 'Simplificar para dose diária' OR a #>> '{anterior,posologia}' <> '12/12h' OR (a ->> 'versao')::int <> 3 THEN
    RAISE EXCEPTION 'FALHOU: aviso para a enfermagem (%)', a;
  END IF;
  IF (SELECT valor FROM t WHERE nome = 'fila')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: fila só com a versão vigente'; END IF;
  RAISE NOTICE 'OK  a checagem mostra só a versão vigente e o que mudou (antes 12/12h), com o motivo';
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'alterar_item_prescricao' AND entidade_id = pg_temp.u('v3')) THEN
    RAISE EXCEPTION 'FALHOU: auditoria';
  END IF;
  RAISE NOTICE 'OK  alteração na auditoria, com antes e depois';
  IF has_function_privilege('anon', 'public.alterar_item_prescricao(uuid, jsonb, text)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
