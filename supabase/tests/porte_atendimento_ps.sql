-- Testes da migration 20261004000001_atendimento_ps.sql (janela do atendimento
-- do PS). Banco local com o seed. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_atendimento_ps.sql
BEGIN;

-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão AGORA no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Dipirona', 'dipirona', 'solução injetável 500 mg/mL', 'teste-atendimento-ps');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'dipirona', id::text FROM public.medicamento WHERE fonte = 'teste-atendimento-ps';
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
-- A: alta após medicação e exame; B: óbito; C: alta retroativa
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT x, public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  json_build_object('nome', 'Atendimento PS ' || x || ' Teste', 'data_nascimento', '1971-03-03')::jsonb) ->> 'episodio_id'
FROM unnest(ARRAY['a', 'b', 'c']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u(x), 'amarelo',
  '{"frequencia-cardiaca":96,"frequencia-respiratoria":18,"temperatura":36.9,"saturacao-o2":97,"escala-dor":7,"pressao-arterial-sistolica":130,"pressao-arterial-diastolica":84}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face')
FROM unnest(ARRAY['a', 'b', 'c']) x;

-- a enfermagem não escreve no atendimento médico
SELECT pg_temp.falha(format('SELECT public.pedir_exames_atendimento(%L, %L)', pg_temp.u('a'), '{Hemograma completo}'),
  'O atendimento é do médico', 'pedido de exame do atendimento é do médico');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.salvar_rascunho_atendimento(%L, %L)', pg_temp.u('a'), '{"s":"dor"}'),
  'Abra o atendimento', 'rascunho só com o atendimento aberto');
SELECT public.iniciar_atendimento(pg_temp.u(x)) FROM unnest(ARRAY['a', 'b', 'c']) x;
RESET ROLE;
INSERT INTO t SELECT 'pac_a', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('a');

-- ── rascunho contínuo ───────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.salvar_rascunho_atendimento(pg_temp.u('a'), '{"s":"Dor abdominal há 2 dias","o":"","a":"","cid":"","p":""}');
SELECT public.salvar_rascunho_atendimento(pg_temp.u('a'), '{"s":"Dor abdominal há 2 dias, piora","o":"Dor à palpação","a":"","cid":"","p":""}');
DO $$ BEGIN
  IF (SELECT public.painel_atendimento_ps(pg_temp.u('a')) -> 'rascunho' ->> 'o') <> 'Dor à palpação' THEN
    RAISE EXCEPTION 'FALHOU: rascunho não voltou pelo painel';
  END IF;
  RAISE NOTICE 'OK  rascunho do SOAP gravado e relido (um por médico e episódio)';
END $$;

-- ── desfecho sem hipótese diagnóstica ───────────────────────────────────────
SELECT public.registrar_soap(pg_temp.u('a'), 'Dor abdominal há 2 dias', 'Dor à palpação em FID', NULL, 'Analgesia e exames', NULL);
DO $$ BEGIN
  IF (SELECT public.painel_atendimento_ps(pg_temp.u('a')) -> 'rascunho') <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: registrar o SOAP deveria apagar o rascunho';
  END IF;
  RAISE NOTICE 'OK  registrar o SOAP apaga o rascunho';
END $$;
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('a'), 'alta'),
  'Informe a hipótese diagnóstica', 'desfecho exige hipótese diagnóstica');

-- ── aguardar reavaliação exige pendência ────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.aguardar_reavaliacao(%L, %L)', pg_temp.u('a'), now() + interval '1 hour'),
  'Nada pendente para reavaliar', 'sem exame nem medicação pendente, não há reavaliação a aguardar');
SELECT public.pedir_exames_atendimento(pg_temp.u('a'), ARRAY['Hemograma completo', 'PCR']);
SELECT pg_temp.falha(format('SELECT public.pedir_exames_atendimento(%L, %L)', pg_temp.u('a'), '{PCR}'),
  'Esses exames já estão pedidos', 'o mesmo exame sem resultado não é pedido duas vezes');
INSERT INTO t SELECT 'dip', public.prescrever(pg_temp.u('pac_a'), json_build_object('medicamento_id', pg_temp.u('dipirona'),
  'dose', '2 mL diluído em 10 mL AD', 'via', 'EV', 'posologia', 'Agora')::jsonb);
SELECT pg_temp.falha(format('SELECT public.aguardar_reavaliacao(%L, %L)', pg_temp.u('a'), now() + interval '2 days'),
  'Hora da reavaliação fora do plantão', 'hora da reavaliação fora das próximas 24 h é recusada');
SELECT public.aguardar_reavaliacao(pg_temp.u('a'), now() + interval '1 hour');
DO $$
DECLARE p jsonb := public.painel_atendimento_ps(pg_temp.u('a'));
BEGIN
  IF (SELECT reavaliar_em FROM public.episodios WHERE id = pg_temp.u('a')) IS NULL THEN RAISE EXCEPTION 'FALHOU: estado em reavaliação'; END IF;
  RAISE NOTICE 'OK  aguardar reavaliação põe o atendimento em reavaliação (hora prevista no episódio)';
  IF jsonb_array_length(p -> 'pendencias') <> 2 THEN RAISE EXCEPTION 'FALHOU: pendências %', p -> 'pendencias'; END IF;
  RAISE NOTICE 'OK  pendências: exame e medicação';
  IF (SELECT r.pendencia FROM public.atendimento_reavaliacoes r WHERE r.episodio_id = pg_temp.u('a') AND r.tipo = 'aguardar')
     NOT LIKE 'exame: Hemograma completo, PCR%' THEN
    RAISE EXCEPTION 'FALHOU: a pendência não ficou registrada';
  END IF;
  RAISE NOTICE 'OK  a pendência do momento fica registrada com a hora prevista';
  IF jsonb_array_length(p -> 'prescricao') <> 1 OR jsonb_array_length(p -> 'exames') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: painel sem prescrição ou exames';
  END IF;
  RAISE NOTICE 'OK  o painel traz a prescrição do PS e os exames do atendimento';
END $$;

-- alta médica com exame sem resultado (gatilho da fase 4) e alta após medicação sem checagem
SELECT public.registrar_soap(pg_temp.u('a'), NULL, NULL, 'Dor abdominal a esclarecer', NULL, 'R10.4');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('a'), 'alta'),
  'Alta: exames pedidos sem resultado', 'alta médica exige os exames com resultado');
SELECT public.resolver_exame(x.id, 'Sem alterações') FROM public.exames_pedidos x WHERE x.episodio_id = pg_temp.u('a');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('a'), 'alta_apos_medicacao'),
  'Alta após medicação: falta a enfermagem checar', 'alta após medicação exige a medicação administrada');

-- reavaliação: texto de 10 letras ou mais; tira do estado "em reavaliação"
SELECT pg_temp.falha(format('SELECT public.registrar_reavaliacao(%L, %L)', pg_temp.u('a'), 'melhor'),
  'Escreva a reavaliação', 'reavaliação exige texto de 10 letras');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.checar(pg_temp.u('dip'), 'feito');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_reavaliacao(pg_temp.u('a'), 'Dor melhorou após analgesia, exames normais, abdome flácido');
DO $$
DECLARE l jsonb := public.painel_atendimento_ps(pg_temp.u('a')) -> 'linha';
BEGIN
  IF (SELECT reavaliar_em FROM public.episodios WHERE id = pg_temp.u('a')) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: a reavaliação registrada deveria tirar do estado em reavaliação';
  END IF;
  RAISE NOTICE 'OK  registrar a reavaliação tira o atendimento do estado em reavaliação';
  IF NOT (l @> '[{"titulo":"Início do atendimento"}]' AND l @> '[{"titulo":"Prescrito"}]' AND l @> '[{"titulo":"Administrado"}]'
          AND l @> '[{"titulo":"Exame pedido"}]' AND l @> '[{"titulo":"Resultado disponível"}]' AND l @> '[{"titulo":"Reavaliação"}]'
          AND l @> '[{"titulo":"Triagem · Amarelo"}]') THEN
    RAISE EXCEPTION 'FALHOU: linha do atendimento incompleta: %', l;
  END IF;
  RAISE NOTICE 'OK  linha do atendimento: triagem, início, prescrito, administrado, exame, resultado, reavaliação';
END $$;

-- dados da alta: futuro, retroativa sem justificativa, CID inválido, SIGTAP
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, NULL, %L)', pg_temp.u('a'), 'alta_apos_medicacao',
  json_build_object('alta_em', now() + interval '1 hour')), 'Data e hora da alta no futuro', 'alta no futuro é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, NULL, %L)', pg_temp.u('a'), 'alta_apos_medicacao',
  json_build_object('cid_alta', 'dor na barriga')), 'Diagnóstico de alta: CID em formato inválido', 'CID de alta em formato inválido é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, NULL, %L)', pg_temp.u('a'), 'alta_apos_medicacao',
  json_build_object('procedimento', '0301')), 'Procedimento SIGTAP: código de 10 dígitos', 'procedimento SIGTAP com 10 dígitos');
SELECT public.registrar_desfecho(pg_temp.u('a'), 'alta_apos_medicacao', NULL,
  json_build_object('procedimento', '03.01.06.002-9', 'observacoes_alta', 'Retornar se febre')::jsonb);
RESET ROLE;
DO $$
DECLARE e public.episodios;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = pg_temp.u('a');
  IF e.desfecho <> 'alta_apos_medicacao' OR e.desfecho_detalhes ->> 'cid_alta' <> 'R10.4'
     OR e.desfecho_detalhes ->> 'procedimento' <> '0301060029' THEN
    RAISE EXCEPTION 'FALHOU: alta (%)', e.desfecho_detalhes;
  END IF;
  RAISE NOTICE 'OK  sem CID informado, o diagnóstico de alta vem do último SOAP; SIGTAP guardado só com dígitos';
  IF EXISTS (SELECT 1 FROM public.atendimento_rascunhos WHERE episodio_id = e.id) THEN RAISE EXCEPTION 'FALHOU: rascunho ficou'; END IF;
  RAISE NOTICE 'OK  o desfecho apaga os rascunhos do episódio';
  BEGIN
    DELETE FROM public.atendimento_reavaliacoes WHERE episodio_id = e.id;
    RAISE EXCEPTION 'FALHOU: reavaliação apagada';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  reavaliação é registro clínico: não se apaga (guarda de 20 anos)';
  END;
  BEGIN
    UPDATE public.atendimento_reavaliacoes SET texto = 'x' WHERE episodio_id = e.id;
    RAISE EXCEPTION 'FALHOU: reavaliação alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  reavaliação não se altera';
  END;
END $$;

-- ── óbito: setor (padrão), CID do óbito e DO de 6 a 12 dígitos ──────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_soap(pg_temp.u('b'), 'Rebaixamento súbito', 'PCR em AESP', 'Parada cardiorrespiratória', 'RCP', 'I46.9');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L)', pg_temp.u('b'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now() - interval '5 minutes', 'numero_do', '12345678')), 'Óbito: informe o CID do óbito', 'óbito exige CID do óbito');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L)', pg_temp.u('b'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now() - interval '5 minutes', 'numero_do', '12-34', 'cid_obito', 'I46.9')),
  'Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos', 'número da DO com 6 a 12 dígitos');
SELECT public.registrar_desfecho(pg_temp.u('b'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now() - interval '5 minutes', 'numero_do', '12.345.678', 'cid_obito', 'i469')::jsonb);

-- ── alta retroativa ─────────────────────────────────────────────────────────
SELECT public.registrar_soap(pg_temp.u('c'), 'Prurido', 'Placas urticariformes', 'Urticária aguda', 'Anti-histamínico', 'L50.0');
RESET ROLE;
UPDATE public.episodios SET chegada_em = now() - interval '3 hours' WHERE id = pg_temp.u('c');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, NULL, %L)', pg_temp.u('c'), 'alta',
  json_build_object('alta_em', now() - interval '2 hours')), 'Alta retroativa: justifique', 'alta retroativa exige justificativa');
SELECT public.registrar_desfecho(pg_temp.u('c'), 'alta', NULL,
  json_build_object('alta_em', now() - interval '2 hours', 'justificativa_retroativa', 'Sistema fora do ar no momento da alta')::jsonb);
RESET ROLE;
DO $$
DECLARE b public.episodios; c public.episodios;
BEGIN
  SELECT * INTO b FROM public.episodios WHERE id = pg_temp.u('b');
  SELECT * INTO c FROM public.episodios WHERE id = pg_temp.u('c');
  IF b.desfecho_detalhes ->> 'setor_obito' IS NULL OR b.desfecho_detalhes ->> 'cid_obito' <> 'I46.9'
     OR b.desfecho_detalhes ->> 'numero_do' <> '12345678' THEN
    RAISE EXCEPTION 'FALHOU: óbito (%)', b.desfecho_detalhes;
  END IF;
  RAISE NOTICE 'OK  óbito guarda setor (o da porta, sem outro informado), CID normalizado e DO só com dígitos';
  IF (c.desfecho_detalhes ->> 'retroativa')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: alta retroativa não marcada'; END IF;
  RAISE NOTICE 'OK  alta com hora de mais de 30 min atrás fica marcada como retroativa, com justificativa';
END $$;

-- ── receita padrão: mesmo favorito em conjuntos diferentes ──────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO public.preferencias_prescricao (medicamento_id, dose, posologia, receita_padrao)
VALUES (pg_temp.u('dipirona'), '1 comprimido', '6/6h se dor', 'Dor leve'),
       (pg_temp.u('dipirona'), '1 comprimido', '6/6h se dor', 'Cefaleia');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.preferencias_prescricao WHERE medicamento_id = pg_temp.u('dipirona')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: receita padrão';
  END IF;
  RAISE NOTICE 'OK  o mesmo item pode estar em receitas padrão diferentes';
  BEGIN
    INSERT INTO public.preferencias_prescricao (medicamento_id, dose, posologia, receita_padrao)
    VALUES (pg_temp.u('dipirona'), '1 comprimido', '6/6H se dor', 'dor leve');
    RAISE EXCEPTION 'FALHOU: item repetido no mesmo conjunto';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK  dentro da mesma receita padrão o item não se repete';
  END;
END $$;

-- ── acesso ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM public.painel_atendimento_ps(pg_temp.u('a'));
  RAISE NOTICE 'OK  o médico que abriu o prontuário lê o painel';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.painel_atendimento_ps(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.aguardar_reavaliacao(uuid, timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pedir_exames_atendimento(uuid, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anônimo executa função do atendimento';
  END IF;
  RAISE NOTICE 'OK  anônimo não executa as funções do atendimento';
END $$;

ROLLBACK;
