-- Fase 2, tarefa 3 — migration 20261031000005_interacoes_criticas.sql: lista
-- curada da unidade (modelo ONC como proposta), só ativa alerta; prescrição
-- trava sem justificativa; justificativa gravada; alteração carrega a
-- justificativa.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- parte de uma lista sem par ativo (o banco local pode ter sobras de verificação)
UPDATE public.interacoes_criticas SET situacao = 'proposta' WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
DELETE FROM public.grupos_interacao_membros mb USING public.grupos_interacao g
 WHERE g.id = mb.grupo_id AND g.unidade_id = '21000000-0000-4000-8000-000000000001'
   AND g.nome IN ('Inibidores seletivos da recaptação de serotonina', 'Inibidores da MAO');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico');
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
  ('Fluoxetina', 'fluoxetina', 'cápsula 20 mg (teste inter)', 'teste-interacao'),
  ('Selegilina', 'selegilina', 'comprimido 5 mg (teste inter)', 'teste-interacao'),
  ('Paracetamol', 'paracetamol', 'comprimido 500 mg (teste inter)', 'teste-interacao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-interacao';
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
CREATE FUNCTION pg_temp.par(p_modelo text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.interacoes_criticas WHERE unidade_id = '21000000-0000-4000-8000-000000000001' AND modelo = p_modelo $$;
GRANT EXECUTE ON FUNCTION pg_temp.par(text) TO authenticated;

SET LOCAL ROLE authenticated;
-- paciente em atendimento
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Ansiedade', NULL,
  '{"nome":"Interação Teste","data_nascimento":"1975-05-05"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'verde',
  '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":0,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;

-- a farmácia abre a lista: o modelo ONC entra como proposta
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'lista', public.lista_interacoes('21000000-0000-4000-8000-000000000001')::text;
-- proposta não alerta: médico prescreve os dois sem justificar
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'flu', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('fluoxetina'),
  'dose', '20 mg', 'via', 'VO', 'posologia', '1x/dia')::jsonb);
INSERT INTO t SELECT 'sel0', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('selegilina'),
  'dose', '5 mg', 'via', 'VO', 'posologia', '1x/dia')::jsonb);
SELECT public.suspender_item(pg_temp.u('sel0'), 'teste: refazer depois de ativar');
-- enfermagem não mexe na lista
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.salvar_grupo_interacao(%L, %L, %L)', '21000000-0000-4000-8000-000000000001', 'Teste', '{fluoxetina}'),
  'Só o farmacêutico ou o gestor', 'enfermagem não mexe na lista de interações');
-- farmacêutico: ativar sem membros é recusado; preenche os grupos e ativa ISRS × IMAO
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.salvar_interacao(%L, %L, %L, %L, %L, %L, NULL, %L, %L, %L)', '21000000-0000-4000-8000-000000000001',
  pg_temp.par('onc-04'), (SELECT grupo_a FROM public.interacoes_criticas WHERE id = pg_temp.par('onc-04')),
  (SELECT grupo_b FROM public.interacoes_criticas WHERE id = pg_temp.par('onc-04')),
  'contraindicada', 'Risco de síndrome serotoninérgica.', 'Lista ONC', 'ativa', 'Conferido pela farmácia'),
  'Para ativar, os dois grupos precisam', 'par sem fármaco nos grupos não ativa');
SELECT public.salvar_grupo_interacao('21000000-0000-4000-8000-000000000001', 'Inibidores seletivos da recaptação de serotonina', '{Fluoxetina,Sertralina}');
SELECT public.salvar_grupo_interacao('21000000-0000-4000-8000-000000000001', 'Inibidores da MAO', '{Selegilina}');
SELECT public.salvar_interacao('21000000-0000-4000-8000-000000000001', pg_temp.par('onc-04'),
  (SELECT grupo_a FROM public.interacoes_criticas WHERE id = pg_temp.par('onc-04')),
  (SELECT grupo_b FROM public.interacoes_criticas WHERE id = pg_temp.par('onc-04')),
  'contraindicada', 'Risco de síndrome serotoninérgica.', 'Suspender um dos dois; respeitar o intervalo de troca.',
  'Lista ONC (Phansalkar 2012) e bula ANVISA', 'ativa', 'Conferido pela farmácia em 09/10');
-- médico: selegilina com fluoxetina vigente trava; com justificativa passa
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('selegilina'), 'dose', '5 mg', 'via', 'VO', 'posologia', '1x/dia')),
  'INTERAÇÃO CRÍTICA com Fluoxetina', 'interação ativa trava o item sem justificativa');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('selegilina'), 'dose', '5 mg', 'via', 'VO', 'posologia', '1x/dia', 'justificativa_interacao', 'curta')),
  'INTERAÇÃO CRÍTICA', 'justificativa curta não basta');
INSERT INTO t SELECT 'sel', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('selegilina'),
  'dose', '5 mg', 'via', 'VO', 'posologia', '1x/dia', 'justificativa_interacao', 'Troca supervisionada pelo psiquiatra, fluoxetina suspensa amanhã')::jsonb);
-- item sem interação segue normal
INSERT INTO t SELECT 'par', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('paracetamol'),
  'dose', '500 mg', 'via', 'VO', 'posologia', '6/6h')::jsonb);
-- alteração da selegilina: a justificativa segue
INSERT INTO t SELECT 'sel2', public.alterar_item_prescricao(pg_temp.u('sel'), '{"dose":"10 mg"}', 'Ajuste de dose');
INSERT INTO t SELECT 'just', public.interacoes_justificadas(ARRAY[pg_temp.u('sel'), pg_temp.u('sel2')])::text;
RESET ROLE;

DO $$
DECLARE l jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'lista'); j jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'just');
BEGIN
  IF jsonb_array_length(l -> 'pares') <> 15 OR EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'pares') x WHERE x ->> 'situacao' <> 'proposta')
     OR NOT (l ->> 'pode_editar')::boolean THEN
    RAISE EXCEPTION 'FALHOU: modelo ONC como proposta (%)', l -> 'pares';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'grupos') g WHERE g ->> 'nome' = 'Atazanavir' AND g -> 'membros' = '["atazanavir"]')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'grupos') g WHERE g ->> 'nome' = 'Inibidores da MAO' AND g -> 'membros' = '[]') THEN
    RAISE EXCEPTION 'FALHOU: grupos semeados (um fármaco preenchido; classe vazia)';
  END IF;
  RAISE NOTICE 'OK  modelo ONC: 15 pares em proposta; grupos de um fármaco já preenchidos, de classe vazios';
  RAISE NOTICE 'OK  proposta não alerta (fluoxetina + selegilina prescritas antes da ativação)';
  IF (SELECT count(*) FROM public.alertas_interacao WHERE item_id = pg_temp.u('sel')) <> 1
     OR (SELECT justificativa FROM public.alertas_interacao WHERE item_id = pg_temp.u('sel')) NOT LIKE 'Troca supervisionada%' THEN
    RAISE EXCEPTION 'FALHOU: justificativa gravada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'prescrever_com_interacao' AND entidade_id = pg_temp.u('sel')) THEN
    RAISE EXCEPTION 'FALHOU: auditoria da justificativa';
  END IF;
  RAISE NOTICE 'OK  com justificativa o item entra; justificativa no item e na auditoria';
  IF EXISTS (SELECT 1 FROM public.alertas_interacao WHERE item_id = pg_temp.u('par')) THEN RAISE EXCEPTION 'FALHOU: alerta indevido'; END IF;
  RAISE NOTICE 'OK  item sem interação não alerta';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'item_id' = pg_temp.u('sel2')::text AND x ->> 'justificativa' LIKE 'Mantida da versão anterior: Troca%') THEN
    RAISE EXCEPTION 'FALHOU: justificativa na alteração (%)', j;
  END IF;
  RAISE NOTICE 'OK  alterar o item mantém a justificativa da versão anterior';
  IF has_table_privilege('authenticated', 'public.interacoes_criticas', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.alertas_interacao', 'INSERT')
     OR has_function_privilege('anon', 'public.salvar_interacao(uuid, uuid, uuid, uuid, text, text, text, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
