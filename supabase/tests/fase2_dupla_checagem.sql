-- Fase 2, tarefa 1 — migration 20261031000001_dupla_checagem.sql: medicamento de
-- alta vigilância (regras ISMP Brasil 2019 + ajuste da farmácia) só é checado
-- como "feito" depois de duas conferências por profissionais diferentes.
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
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico');
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
  ('Morfina', 'morfina', 'solução injetável, ampola 1 mL (teste)', '10 mg/mL', 'teste-dupla'),
  ('Dipirona', 'dipirona', 'comprimido (teste)', '500 mg', 'teste-dupla'),
  ('Glicose', 'glicose', 'solução injetável, ampola 10 mL (teste)', '50%', 'teste-dupla'),
  ('Glicose', 'glicose', 'solução injetável, frasco 500 mL (teste)', '5%', 'teste-dupla'),
  ('Cloreto de sódio', 'cloreto de sodio', 'solução injetável, ampola 10 mL (teste)', '20%', 'teste-dupla'),
  ('Cloreto de sódio', 'cloreto de sodio', 'solução injetável, frasco 500 mL (teste)', '0,9%', 'teste-dupla');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento
 WHERE fonte = 'teste-dupla' AND principio_ativo_norm IN ('morfina', 'dipirona');
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
  IF (SELECT array_agg(concentracao ORDER BY concentracao) FROM public.medicamento WHERE fonte = 'teste-dupla' AND alta_vigilancia)
     <> '{10 mg/mL,20%,50%}' THEN
    RAISE EXCEPTION 'FALHOU: marcação pelas regras (%)',
      (SELECT array_agg(concentracao || ' ' || coalesce(alta_vigilancia_regra, '-')) FROM public.medicamento WHERE fonte = 'teste-dupla');
  END IF;
  RAISE NOTICE 'OK  regras ISMP: morfina injetável, glicose 50%% e NaCl 20%% marcados; glicose 5%%, NaCl 0,9%% e dipirona não';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Dupla Checagem Teste","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
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

-- sem dupla checagem, a morfina não é "feito"
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('mor'), 'feito'),
  'Medicamento de alta vigilância: faça a dupla checagem', 'alta vigilância sem dupla checagem não é registrada como feita');
SELECT pg_temp.falha(format('SELECT public.conferir_alta_vigilancia(%L)', pg_temp.u('dip')),
  'Este item não exige dupla checagem', 'item comum não tem dupla checagem');
-- 1ª conferência é da enfermagem; a mesma pessoa não faz a 2ª
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.conferir_alta_vigilancia(%L)', pg_temp.u('mor')),
  'A primeira conferência é da enfermagem', 'médico não faz a primeira conferência');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'c1', public.conferir_alta_vigilancia(pg_temp.u('mor'));
SELECT pg_temp.falha(format('SELECT public.conferir_alta_vigilancia(%L)', pg_temp.u('mor')),
  'A segunda conferência é de outro profissional', 'o mesmo usuário não faz as duas conferências');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('mor'), 'feito'),
  'Medicamento de alta vigilância', 'uma conferência só não basta');
INSERT INTO t SELECT 'estado', public.estado_dupla_checagem(ARRAY[pg_temp.u('mor'), pg_temp.u('dip')])::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'pendentes', public.duplas_pendentes('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.duplas_pendentes(%L)', '21000000-0000-4000-8000-000000000001'),
  'A segunda conferência é de enfermeiro ou farmacêutico', 'recepção não vê a fila do segundo checador');
-- médico de plantão não é segundo checador
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.conferir_alta_vigilancia(%L)', pg_temp.u('mor')),
  'A segunda conferência é de enfermeiro de plantão ou farmacêutico', 'médico não é segundo checador');
-- farmacêutico faz a 2ª
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'c2', public.conferir_alta_vigilancia(pg_temp.u('mor'));
SELECT pg_temp.falha(format('SELECT public.conferir_alta_vigilancia(%L)', pg_temp.u('mor')),
  'As duas conferências já foram feitas', 'não há terceira conferência');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.checar(pg_temp.u('mor'), 'feito');
-- a dupla checagem vale para uma administração: a próxima pede outra
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('mor'), 'feito'),
  'Medicamento de alta vigilância', 'a dupla checagem é consumida pela administração');
SELECT public.checar(pg_temp.u('mor'), 'nao_feito', NULL, 'paciente dormindo, sem dor');

-- ajuste da unidade: só farmacêutico ou gestor, com motivo
SELECT pg_temp.falha(format('SELECT public.definir_alta_vigilancia(%L, %L, false, %L)', '21000000-0000-4000-8000-000000000001',
  pg_temp.u('morfina'), 'tentativa da enfermagem'), 'Só o farmacêutico ou o gestor', 'enfermagem não muda a lista');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.definir_alta_vigilancia(%L, %L, true, %L)', '21000000-0000-4000-8000-000000000001',
  pg_temp.u('dipirona'), 'curto'), 'Escreva o motivo', 'ajuste sem motivo é recusado');
SELECT public.definir_alta_vigilancia('21000000-0000-4000-8000-000000000001', pg_temp.u('dipirona'), true, 'Protocolo local da unidade, teste');
SELECT public.definir_alta_vigilancia('21000000-0000-4000-8000-000000000001', pg_temp.u('morfina'), false, 'Decisão da comissão de farmácia, teste');
INSERT INTO t SELECT 'lista', public.alta_vigilancia_da_unidade('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.checar(pg_temp.u('mor'), 'feito');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.u('dip'), 'feito'),
  'Medicamento de alta vigilância', 'item marcado pela farmácia passa a exigir a dupla checagem');
RESET ROLE;

DO $$
DECLARE l jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'lista');
BEGIN
  IF (SELECT valor FROM t WHERE nome = 'c1') <> 'primeira' OR (SELECT valor FROM t WHERE nome = 'c2') <> 'segunda' THEN
    RAISE EXCEPTION 'FALHOU: retorno das conferências';
  END IF;
  IF (SELECT count(*) FROM public.duplas_checagens WHERE item_id = pg_temp.u('mor')
       AND segundo_por = '10000000-0000-4000-8000-000000000006' AND usada_em IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: registro da dupla checagem';
  END IF;
  IF jsonb_array_length((SELECT valor::jsonb FROM t WHERE nome = 'estado')) <> 1
     OR jsonb_array_length((SELECT valor::jsonb FROM t WHERE nome = 'estado') -> 0 -> 'abertas') <> 1
     OR jsonb_array_length((SELECT valor::jsonb FROM t WHERE nome = 'pendentes')) <> 1
     OR ((SELECT valor::jsonb FROM t WHERE nome = 'pendentes') -> 0 ->> 'sou_o_primeiro')::boolean THEN
    RAISE EXCEPTION 'FALHOU: estado e fila do segundo checador';
  END IF;
  RAISE NOTICE 'OK  a checagem mostra a conferência aberta; o farmacêutico a vê na fila dele';
  RAISE NOTICE 'OK  enfermeira confere, farmacêutico confere, administração registrada; a dupla fica gravada e usada';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'id' = pg_temp.u('dipirona')::text AND (x ->> 'exige')::boolean)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'id' = pg_temp.u('morfina')::text AND NOT (x ->> 'exige')::boolean
                    AND x #>> '{ajuste,motivo}' LIKE 'Decisão da comissão%') THEN
    RAISE EXCEPTION 'FALHOU: lista da unidade (%)', l;
  END IF;
  RAISE NOTICE 'OK  farmacêutico marca e desmarca com motivo; a lista mostra o ajuste e a regra';
  BEGIN
    UPDATE public.duplas_checagens SET segundo_por = '10000000-0000-4000-8000-000000000001' WHERE item_id = pg_temp.u('mor');
    RAISE EXCEPTION 'FALHOU: dupla checagem reescrita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.duplas_checagens WHERE item_id = pg_temp.u('mor');
    RAISE EXCEPTION 'FALHOU: dupla checagem apagada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  dupla checagem não se reescreve nem se apaga';
  IF has_table_privilege('authenticated', 'public.duplas_checagens', 'INSERT')
     OR has_table_privilege('authenticated', 'public.alta_vigilancia_unidade', 'INSERT')
     OR has_function_privilege('anon', 'public.conferir_alta_vigilancia(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.definir_alta_vigilancia(uuid, uuid, boolean, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
