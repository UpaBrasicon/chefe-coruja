-- Fase 2, tarefa 1 revista (decisão do RT de 09/10/2026) — migration
-- 20261101000002_liberacao_farmacia_alta_vigilancia.sql: alta vigilância é
-- liberada pela farmácia (validação do item); sem liberação, a enfermagem
-- administra com justificativa e a administração entra na lista da farmácia.
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
-- o perfil …06 passa a ser também farmacêutico da unidade
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico')
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
  ('Morfina', 'morfina', 'solução injetável, ampola 1 mL (teste)', '10 mg/mL', 'teste-liberacao'),
  ('Dipirona', 'dipirona', 'comprimido (teste)', '500 mg', 'teste-liberacao'),
  ('Glicose', 'glicose', 'solução injetável, ampola 10 mL (teste)', '50%', 'teste-liberacao'),
  ('Glicose', 'glicose', 'solução injetável, frasco 500 mL (teste)', '5%', 'teste-liberacao'),
  ('Cloreto de sódio', 'cloreto de sodio', 'solução injetável, ampola 10 mL (teste)', '20%', 'teste-liberacao'),
  ('Cloreto de sódio', 'cloreto de sodio', 'solução injetável, frasco 500 mL (teste)', '0,9%', 'teste-liberacao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento
 WHERE fonte = 'teste-liberacao' AND principio_ativo_norm IN ('morfina', 'dipirona');
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
  IF (SELECT array_agg(concentracao ORDER BY concentracao) FROM public.medicamento WHERE fonte = 'teste-liberacao' AND alta_vigilancia)
     <> '{10 mg/mL,20%,50%}' THEN
    RAISE EXCEPTION 'FALHOU: marcação pelas regras (%)',
      (SELECT array_agg(concentracao || ' ' || coalesce(alta_vigilancia_regra, '-')) FROM public.medicamento WHERE fonte = 'teste-liberacao');
  END IF;
  RAISE NOTICE 'OK  regras ISMP: morfina injetável, glicose 50%% e NaCl 20%% marcados; glicose 5%%, NaCl 0,9%% e dipirona não';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Liberacao Farmacia Teste","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":98,"frequencia-respiratoria":18,"temperatura":36.8,"saturacao-o2":97,"escala-dor":9,"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":84}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'mor', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('morfina'),
  'dose', '2 mg', 'via', 'EV', 'posologia', 'agora')::jsonb);
INSERT INTO t SELECT 'dip', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('dipirona'),
  'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')::jsonb);


-- sem liberação e sem justificativa, a morfina não é "feito"
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('mor'), 'feito'),
  'Alta vigilância sem liberação da farmácia', 'sem liberação, alta vigilância pede justificativa');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, NULL, %L)', pg_temp.u('mor'), 'feito', 'curta'),
  'Alta vigilância sem liberação da farmácia', 'justificativa curta é recusada');
-- item comum não muda
SELECT public.checar(pg_temp.u('dip'), 'feito');
-- a Checagem sabe o que exige liberação e se já foi liberado
INSERT INTO t SELECT 'lib0', public.liberacao_farmacia(ARRAY[pg_temp.u('mor'), pg_temp.u('dip')])::text;
-- com justificativa: administra e fica marcado para a farmácia conferir
INSERT INTO t SELECT 'adm1', public.checar(pg_temp.u('mor'), 'feito', NULL, 'Sem farmacêutico de plantão à noite')::text;
SELECT pg_temp.falha(format('SELECT public.administracoes_sem_liberacao(%L)', '21000000-0000-4000-8000-000000000001'),
  'Lista da farmácia', 'enfermagem não lê a lista da farmácia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'pend1', public.administracoes_sem_liberacao('21000000-0000-4000-8000-000000000001')::text;
INSERT INTO t SELECT 'fila_av', (SELECT string_agg(descricao || '=' || alta_vigilancia, ';' ORDER BY descricao)
  FROM public.fila_validacao('21000000-0000-4000-8000-000000000001') WHERE item_id IN (pg_temp.u('mor'), pg_temp.u('dip')));
-- o farmacêutico libera o item: sai da lista e a enfermagem checa sem justificativa
SELECT public.validar_item(pg_temp.u('mor'), true);
INSERT INTO t SELECT 'pend2', public.administracoes_sem_liberacao('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'lib1', public.liberacao_farmacia(ARRAY[pg_temp.u('mor')])::text;
INSERT INTO t SELECT 'adm2', public.checar(pg_temp.u('mor'), 'feito')::text;
-- devolvido para correção: volta a pedir justificativa
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.validar_item(pg_temp.u('mor'), false, 'Dose acima do protocolo da unidade');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('mor'), 'feito'),
  'Alta vigilância sem liberação da farmácia', 'item devolvido deixa de estar liberado');
RESET ROLE;

DO $$
DECLARE v jsonb;
BEGIN
  v := (SELECT valor FROM t WHERE nome = 'lib0')::jsonb;
  IF jsonb_array_length(v) <> 1 OR v->0->>'item_id' <> pg_temp.u('mor')::text OR v->0->>'situacao' IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: liberacao_farmacia antes da validação (%)', v;
  END IF;
  RAISE NOTICE 'OK  liberação: só a morfina exige, ainda sem liberação';
  IF NOT (SELECT sem_liberacao FROM public.administracoes WHERE id = (SELECT valor FROM t WHERE nome = 'adm1')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: administração com justificativa não ficou marcada';
  END IF;
  IF (SELECT sem_liberacao FROM public.administracoes WHERE id = (SELECT valor FROM t WHERE nome = 'adm2')::uuid) THEN
    RAISE EXCEPTION 'FALHOU: administração liberada ficou marcada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.administracoes a JOIN public.prescricao_itens i ON i.id = a.item_id
              WHERE i.id = pg_temp.u('dip') AND a.sem_liberacao) THEN
    RAISE EXCEPTION 'FALHOU: item comum marcado como sem liberação';
  END IF;
  RAISE NOTICE 'OK  marca sem_liberacao só na administração com justificativa';
  v := (SELECT valor FROM t WHERE nome = 'pend1')::jsonb;
  IF jsonb_array_length(v) <> 1 OR v->0->>'justificativa' <> 'Sem farmacêutico de plantão à noite' THEN
    RAISE EXCEPTION 'FALHOU: lista da farmácia (%)', v;
  END IF;
  IF jsonb_array_length((SELECT valor FROM t WHERE nome = 'pend2')::jsonb) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: validação do farmacêutico não tirou da lista';
  END IF;
  RAISE NOTICE 'OK  administrada sem liberação entra na lista da farmácia e sai com a validação';
  v := (SELECT valor FROM t WHERE nome = 'lib1')::jsonb;
  IF v->0->>'situacao' <> 'confere' OR v->0->>'por' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: liberacao_farmacia depois da validação (%)', v;
  END IF;
  RAISE NOTICE 'OK  liberação mostra quem liberou';
  IF (SELECT valor FROM t WHERE nome = 'fila_av') NOT LIKE '%Dipirona%=false%' OR (SELECT valor FROM t WHERE nome = 'fila_av') NOT LIKE '%Morfina%=true%' THEN
    RAISE EXCEPTION 'FALHOU: fila_validacao alta vigilância (%)', (SELECT valor FROM t WHERE nome = 'fila_av');
  END IF;
  RAISE NOTICE 'OK  fila de validação marca a alta vigilância pela lista da unidade';
  IF has_function_privilege('anon', 'public.liberacao_farmacia(uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.administracoes_sem_liberacao(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto ao anon';
  END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
