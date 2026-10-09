-- Fase 2, tarefa 4 — migration 20261031000003_intercorrencia.sql: médico,
-- enfermeiro e técnico de plantão registram intercorrência com tipo,
-- gravidade, conduta e vínculo ao atendimento; só inserção (retificar);
-- relatório do gestor.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- o perfil …06 passa a ser técnico de enfermagem de plantão (sem o vínculo de
-- telemedicina, que tira o setor da escala)
UPDATE public.vinculos SET ativo = false WHERE perfil_id = '10000000-0000-4000-8000-000000000006' AND papel = 'telemedicina';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'tecnico_enfermagem');
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
                  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006']::uuid[]) p;
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
-- chamada da RPC com os parâmetros que mudam no teste
CREATE FUNCTION pg_temp.reg(p_tipo text, p_outro text, p_grav text, p_desc text, p_conduta text, p_retifica uuid DEFAULT NULL) RETURNS uuid
LANGUAGE sql AS $$
  SELECT public.registrar_intercorrencia(pg_temp.u('pac'), pg_temp.u('ep'), NULL, p_tipo, p_outro, p_grav,
    now() - interval '10 minutes', p_desc, p_conduta, p_retifica) $$;
GRANT EXECUTE ON FUNCTION pg_temp.reg(text, text, text, text, text, uuid) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dispneia', NULL,
  '{"nome":"Intercorrência Teste","data_nascimento":"1955-05-05"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":104,"frequencia-respiratoria":24,"temperatura":37.2,"saturacao-o2":92,"escala-dor":2,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":86}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;

-- recepção não registra
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($q$SELECT pg_temp.reg('queda', NULL, 'leve', 'Paciente escorregou no banheiro', 'Avaliado, sem lesão')$q$,
  'A intercorrência é registrada por médico, enfermeiro ou técnico', 'recepção não registra intercorrência');
-- técnico, enfermeiro e médico registram
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'tec', pg_temp.reg('queda', NULL, 'leve', 'Paciente escorregou ao ir ao banheiro', 'Avaliado, sem lesão; grade elevada');
SELECT pg_temp.falha($q$SELECT pg_temp.reg('outra', '', 'leve', 'Algo diferente aconteceu aqui', 'Observação')$q$,
  'Diga qual é a intercorrência', '"Outra" pede o nome');
SELECT pg_temp.falha($q$SELECT pg_temp.reg('queda', NULL, 'gravissima', 'Paciente escorregou de novo', 'Avaliado')$q$,
  'Escolha a gravidade', 'gravidade fora da escala é recusada');
SELECT pg_temp.falha($q$SELECT pg_temp.reg('queda', NULL, 'leve', 'curta', 'Avaliado')$q$,
  'Descreva o que aconteceu', 'descrição curta é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_intercorrencia(%L, %L, NULL, %L, NULL, %L, now() + interval ''1 hour'', %L, %L)',
  pg_temp.u('pac'), pg_temp.u('ep'), 'queda', 'leve', 'Hora no futuro para teste', 'Avaliado'),
  'Hora da intercorrência entre as últimas 72 horas e agora', 'hora no futuro é recusada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'enf', pg_temp.reg('insuficiencia_respiratoria', NULL, 'moderada', 'Saturação caiu para 86% em ar ambiente', 'O2 por cateter 3 L/min; médico avisado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'med', pg_temp.reg('insuficiencia_respiratoria', NULL, 'grave', 'Saturação 84% com O2, esforço respiratório', 'Máscara não reinalante; sala vermelha',
  pg_temp.u('enf'));
SELECT pg_temp.falha(format('SELECT pg_temp.reg(%L, NULL, %L, %L, %L, %L)', 'febre', 'leve', 'Retificando de novo a mesma', 'Antitérmico', pg_temp.u('enf')),
  'Esta intercorrência já foi retificada', 'não se retifica duas vezes a mesma versão');
INSERT INTO t SELECT 'lista', public.intercorrencias_do_paciente(pg_temp.u('pac'))::text;
SELECT pg_temp.falha(format('SELECT public.relatorio_intercorrencias(%L, current_date, current_date)', '21000000-0000-4000-8000-000000000001'),
  'Acesso negado: relatório do gestor', 'só o gestor vê o relatório');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'rel', public.relatorio_intercorrencias('21000000-0000-4000-8000-000000000001', private.data_atual() - 1, private.data_atual())::text;
RESET ROLE;

DO $$
DECLARE l jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'lista'); r jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'rel');
BEGIN
  IF jsonb_array_length(l) <> 3 THEN RAISE EXCEPTION 'FALHOU: lista do paciente (%)', l; END IF;
  IF (SELECT array_agg(papel ORDER BY papel) FROM public.intercorrencias WHERE paciente_id = pg_temp.u('pac'))
     <> '{enfermeiro,plantonista,tecnico_enfermagem}' THEN
    RAISE EXCEPTION 'FALHOU: papel de quem registrou';
  END IF;
  RAISE NOTICE 'OK  técnico, enfermeiro e médico registram; o papel fica gravado com o usuário do login';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'id' = pg_temp.u('enf')::text AND (x ->> 'retificada')::boolean)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'id' = pg_temp.u('med')::text AND x ->> 'retifica_id' = pg_temp.u('enf')::text) THEN
    RAISE EXCEPTION 'FALHOU: retificação';
  END IF;
  RAISE NOTICE 'OK  retificar guarda a anterior, marcada como retificada';
  IF (r ->> 'total')::int <> 2 OR (r -> 'por_gravidade' ->> 'grave')::int <> 1 OR (r -> 'por_gravidade' ->> 'leve')::int <> 1
     OR (r -> 'por_gravidade') ? 'moderada' OR jsonb_array_length(r -> 'casos') <> 2
     OR (r -> 'casos' -> 0 ->> 'paciente') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: relatório (%)', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'ver_intercorrencias' AND ator_id = '10000000-0000-4000-8000-000000000001'
                   AND created_at > now() - interval '1 minute') THEN
    RAISE EXCEPTION 'FALHOU: nome no relatório sem trilha';
  END IF;
  RAISE NOTICE 'OK  relatório conta a versão vigente (2: 1 leve, 1 grave); nomes na trilha de auditoria';
  BEGIN
    UPDATE public.intercorrencias SET gravidade = 'leve' WHERE id = pg_temp.u('med');
    RAISE EXCEPTION 'FALHOU: intercorrência alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  intercorrência é só de inserção';
  IF has_table_privilege('authenticated', 'public.intercorrencias', 'SELECT')
     OR has_table_privilege('authenticated', 'public.intercorrencias', 'INSERT')
     OR has_function_privilege('anon', 'public.registrar_intercorrencia(uuid, uuid, uuid, text, text, text, timestamptz, text, text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.relatorio_intercorrencias(uuid, date, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  leitura e escrita só por RPC; fora do anon';
END $$;
ROLLBACK;
