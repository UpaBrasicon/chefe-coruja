-- Testes do porte da observação (migration 20261004000007). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_observacao.sql
-- Estados derivados do banco (não atendido, em atendimento, em reavaliação,
-- encaminhado, finalizado), relógios (prazo de 6h e primeiro registro médico),
-- reavaliação com hora, protocolo com fonte (só dengue) e etapas com autor,
-- desfecho no card sobre dar_alta/registrar_evento_adt, passagem com aceite.
BEGIN;
-- médico (…0002) no PS, na Observação e na Clínica Médica; enfermeira (…0004)
-- na Observação agora; recepção (…0005) só no PS.
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES
  ('22000000-0000-4000-8000-000000000002', 'Box 2', 'observacao'),
  ('22000000-0000-4000-8000-000000000002', 'Box 1', 'observacao'),
  ('22000000-0000-4000-8000-000000000002', 'Box 3', 'observacao'),
  ('22000000-0000-4000-8000-000000000002', 'Box 4', 'observacao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
-- o painel como o usuário da vez vê
CREATE FUNCTION pg_temp.linha(p_int text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT to_jsonb(x) FROM public.painel_observacao('21000000-0000-4000-8000-000000000001') x WHERE x.internacao_id = pg_temp.u(p_int) $$;
GRANT EXECUTE ON FUNCTION pg_temp.linha(text) TO authenticated;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- ── porta: quatro adultos chegam, são triados, atendidos e vão à observação ─
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'e' || x, public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL,
  json_build_object('nome', 'Obs Porte ' || upper(x), 'data_nascimento', '1970-01-01')::jsonb) ->> 'episodio_id'
  FROM unnest(ARRAY['a', 'b', 'c', 'd']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('e' || x), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Edema de face')
  FROM unnest(ARRAY['a', 'b', 'c', 'd']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('e' || x)), public.registrar_soap(pg_temp.u('e' || x), 'queixa', 'exame', 'avaliacao', 'plano', 'R60'),
       public.registrar_desfecho(pg_temp.u('e' || x), 'observacao')
  FROM unnest(ARRAY['a', 'b', 'c', 'd']) x;
RESET ROLE;
INSERT INTO t SELECT 'i' || x, (SELECT id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('e' || x)) FROM unnest(ARRAY['a', 'b', 'c', 'd']) x;

-- ── lista: quem vê e o estado inicial ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'n_recepcao', count(x.*)::text FROM public.painel_observacao('21000000-0000-4000-8000-000000000001') x WHERE x.internacao_id IN (pg_temp.u('ia'), pg_temp.u('ib'), pg_temp.u('ic'), pg_temp.u('id'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'n_gestor', count(x.*)::text FROM public.painel_observacao('21000000-0000-4000-8000-000000000001') x WHERE x.internacao_id IN (pg_temp.u('ia'), pg_temp.u('ib'), pg_temp.u('ic'), pg_temp.u('id'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'la0', pg_temp.linha('ia')::text;
INSERT INTO t SELECT 'n_medico', count(x.*)::text FROM public.painel_observacao('21000000-0000-4000-8000-000000000001') x WHERE x.internacao_id IN (pg_temp.u('ia'), pg_temp.u('ib'), pg_temp.u('ic'), pg_temp.u('id'));
RESET ROLE;
DO $$
DECLARE a jsonb := pg_temp.v('la0')::jsonb;
BEGIN
  IF pg_temp.v('n_recepcao') <> '0' THEN RAISE EXCEPTION 'FALHOU: quem não está na Observação vê a lista (%)', pg_temp.v('n_recepcao'); END IF;
  RAISE NOTICE 'OK  fora da escala da Observação a lista vem vazia';
  IF pg_temp.v('n_medico') <> '4' OR pg_temp.v('n_gestor') <> '4' THEN
    RAISE EXCEPTION 'FALHOU: médico/gestor veem os 4 boxes (% / %)', pg_temp.v('n_medico'), pg_temp.v('n_gestor');
  END IF;
  RAISE NOTICE 'OK  médico da escala e gestor veem os boxes da Observação';
  IF a ->> 'estado' <> 'nao' OR a ->> 'box' <> 'Box 1' OR a ->> 'primeiro_atendimento_em' IS NOT NULL
     OR abs(extract(epoch FROM (a ->> 'prazo')::timestamptz - ((a ->> 'entrada')::timestamptz + interval '6 hours'))) > 5
     OR a ->> 'queixa' <> 'Edema' OR a ->> 'setor_nome' <> 'Observação' THEN
    RAISE EXCEPTION 'FALHOU: linha inicial (%)', a;
  END IF;
  RAISE NOTICE 'OK  entra como "não atendido", com box, queixa e prazo de 6h contado da entrada';
END $$;

-- ── atender: primeiro registro médico ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.observacao_atender(%L)', pg_temp.v('ia')), 'Esta ação é do médico', 'atender é do médico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.observacao_atender(%L)', pg_temp.v('ia')), 'Acesso negado', 'fora da escala do setor não atende');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.observacao_atender(pg_temp.u('ia'));
SELECT pg_temp.falha(format('SELECT public.observacao_atender(%L)', pg_temp.v('ia')), 'O primeiro atendimento desta observação já foi registrado', 'o primeiro atendimento é um só');
SELECT pg_temp.falha(format('SELECT public.observacao_reavaliar(%L, %L)', pg_temp.v('ib'), now() + interval '30 minutes'),
  'Registre o atendimento antes', 'reavaliar pede o atendimento antes');
-- a evolução escrita pelo médico também conta como primeiro registro
SELECT public.registrar_evolucao(pg_temp.u('ib'), 'evolucao', 'Evolução na observação: edema estável.');
INSERT INTO t SELECT 'la1', pg_temp.linha('ia')::text;
INSERT INTO t SELECT 'lb1', pg_temp.linha('ib')::text;
RESET ROLE;
DO $$
DECLARE a jsonb := pg_temp.v('la1')::jsonb; b jsonb := pg_temp.v('lb1')::jsonb;
BEGIN
  IF a ->> 'estado' <> 'atendimento' OR a ->> 'primeiro_atendimento_em' IS NULL OR a ->> 'primeiro_atendimento_por' <> 'Plantonista de Teste' THEN
    RAISE EXCEPTION 'FALHOU: atender (%)', a;
  END IF;
  RAISE NOTICE 'OK  "Atender" leva a "em atendimento" e marca o primeiro registro médico (hora e quem)';
  IF b ->> 'estado' <> 'atendimento' OR b ->> 'primeiro_atendimento_em' IS NULL THEN RAISE EXCEPTION 'FALHOU: evolução como 1º registro (%)', b; END IF;
  RAISE NOTICE 'OK  a primeira evolução do médico também conta como primeiro registro';
END $$;

-- ── reavaliação com hora ────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.observacao_reavaliar(%L, %L)', pg_temp.v('ia'), now() - interval '1 minute'),
  'A hora da reavaliação já passou', 'reavaliação no passado é recusada');
INSERT INTO t SELECT 'reav', public.observacao_reavaliar(pg_temp.u('ia'), now() + interval '30 minutes');
SELECT pg_temp.falha(format('SELECT public.observacao_reavaliar(%L, %L)', pg_temp.v('ia'), now() + interval '40 minutes'),
  'Já há reavaliação marcada', 'uma reavaliação marcada por vez');
INSERT INTO t SELECT 'la2', pg_temp.linha('ia')::text;
SELECT public.observacao_reavaliado(pg_temp.u('ia'));
SELECT pg_temp.falha(format('SELECT public.observacao_reavaliado(%L)', pg_temp.v('ia')), 'Não há reavaliação marcada', 'reavaliado sem marcação é recusado');
INSERT INTO t SELECT 'la3', pg_temp.linha('ia')::text;
RESET ROLE;
DO $$
DECLARE a2 jsonb := pg_temp.v('la2')::jsonb; a3 jsonb := pg_temp.v('la3')::jsonb; pe public.pendencias;
BEGIN
  SELECT * INTO pe FROM public.pendencias WHERE id = pg_temp.u('reav');
  IF a2 ->> 'estado' <> 'reavaliacao' OR abs(extract(epoch FROM (a2 ->> 'reavaliar_em')::timestamptz - (now() + interval '30 minutes'))) > 5
     OR pe.tipo <> 'reavaliacao' OR pe.descricao NOT LIKE 'Reavaliar às %' THEN
    RAISE EXCEPTION 'FALHOU: em reavaliação (% / %)', a2, pe;
  END IF;
  RAISE NOTICE 'OK  "Reavaliar às" vira "em reavaliação" com a hora, como pendência de reavaliação do leito';
  IF a3 ->> 'estado' <> 'atendimento' OR pe.situacao = 'aberta'
     OR (SELECT situacao FROM public.pendencias WHERE id = pg_temp.u('reav')) <> 'concluida'
     OR (SELECT count(*) FROM public.observacao_eventos WHERE internacao_id = pg_temp.u('ia')) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: reavaliado (%)', a3;
  END IF;
  RAISE NOTICE 'OK  "Reavaliado" conclui a pendência e volta a "em atendimento"; os marcos ficam registrados';
END $$;

-- ── encaminhado: regulação aberta ───────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_pendencia(pg_temp.u('ic'), 'regulacao', 'Aguarda vaga de UTI na central de regulação', 'sem_prazo');
INSERT INTO t SELECT 'lc', pg_temp.linha('ic')::text;
SELECT public.observacao_atender(pg_temp.u('id'));
SELECT public.encaminhar_interno((SELECT paciente_id FROM public.internacoes WHERE id = pg_temp.u('id')), 'Cirurgia geral',
  'Avaliar edema com dor abdominal', NULL, NULL, NULL, pg_temp.u('id'));
INSERT INTO t SELECT 'ld', pg_temp.linha('id')::text;
RESET ROLE;
DO $$ BEGIN
  IF pg_temp.v('lc')::jsonb ->> 'estado' <> 'encaminhado' THEN RAISE EXCEPTION 'FALHOU: encaminhado (%)', pg_temp.v('lc'); END IF;
  RAISE NOTICE 'OK  regulação aberta aparece como "encaminhado"';
  IF pg_temp.v('ld')::jsonb ->> 'estado' <> 'encaminhado' THEN RAISE EXCEPTION 'FALHOU: encaminhamento interno (%)', pg_temp.v('ld'); END IF;
  RAISE NOTICE 'OK  encaminhamento interno aguardando o colega aparece como "encaminhado"';
END $$;

-- ── protocolo: só com fonte; etapas com autor ───────────────────────────────
DO $$ BEGIN
  IF (SELECT count(*) FROM public.protocolos_observacao WHERE ativo) <> 1
     OR (SELECT fonte FROM public.protocolos_observacao WHERE sigla = 'DEN') NOT LIKE 'Ministério da Saúde. Dengue%2024%' THEN
    RAISE EXCEPTION 'FALHOU: catálogo de protocolos';
  END IF;
  RAISE NOTICE 'OK  catálogo só com a dengue (manual do MS 2024); os sem fonte ficaram de fora';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.observacao_iniciar_protocolo(%L, %L)', pg_temp.v('ia'), 'DT'), 'Protocolo desconhecido', 'protocolo sem fonte não se abre');
INSERT INTO t SELECT 'proto', public.observacao_iniciar_protocolo(pg_temp.u('ia'), 'DEN');
SELECT pg_temp.falha(format('SELECT public.observacao_iniciar_protocolo(%L, %L)', pg_temp.v('ia'), 'DEN'), 'Já há protocolo aberto', 'um protocolo aberto por paciente');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.observacao_encerrar_protocolo(%L, %L)', pg_temp.v('proto'), 'Encerrado pela enfermagem sem médico'),
  'Esta ação é do médico', 'encerrar protocolo é do médico');
SELECT public.observacao_avancar_protocolo(pg_temp.u('proto'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.observacao_avancar_protocolo(pg_temp.u('proto'));
SELECT public.observacao_avancar_protocolo(pg_temp.u('proto'));
SELECT pg_temp.falha(format('SELECT public.observacao_avancar_protocolo(%L)', pg_temp.v('proto')), 'Esta é a última etapa', 'a última etapa não avança');
SELECT pg_temp.falha(format('SELECT public.observacao_encerrar_protocolo(%L, %L)', pg_temp.v('proto'), 'curto'), 'Para encerrar o protocolo', 'encerrar pede motivo de 15 letras');
INSERT INTO t SELECT 'la4', pg_temp.linha('ia')::text;
RESET ROLE;
DO $$
DECLARE pr jsonb := (pg_temp.v('la4')::jsonb) -> 'protocolo';
BEGIN
  IF pr ->> 'sigla' <> 'DEN' OR (pr ->> 'etapa_atual')::int <> 3 OR jsonb_array_length(pr -> 'historico') <> 3
     OR pr -> 'historico' -> 0 ->> 'por' <> 'Enfermeira de Teste' OR pr -> 'historico' -> 1 ->> 'por' <> 'Plantonista de Teste'
     OR pr -> 'etapas' -> 0 ->> 'referencia' IS NULL OR pr ->> 'fonte' NOT LIKE 'Ministério da Saúde%' THEN
    RAISE EXCEPTION 'FALHOU: protocolo no card (%)', pr;
  END IF;
  RAISE NOTICE 'OK  cada etapa cumprida registra quem e quando; o card traz etapas, página e fonte';
END $$;

-- ── passagem com aceite, vista no card ──────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'pp', public.enviar_passagem(pg_temp.u('ia'), '10000000-0000-4000-8000-000000000004', 'Dengue grupo B, aguardando hemograma.');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L)', pg_temp.v('ia'), 'alta_medica', 'A90'),
  'Há passagem de plantão aguardando aceite', 'passagem aguardando impede o desfecho');
INSERT INTO t SELECT 'la5', pg_temp.linha('ia')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.responder_passagem(%L, false, %L)', pg_temp.v('pp'), 'não quero'), 'Diga por que recusa', 'recusa pede 15 letras');
SELECT public.responder_passagem(pg_temp.u('pp'), true);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'la6', pg_temp.linha('ia')::text;
RESET ROLE;
DO $$ BEGIN
  IF (pg_temp.v('la5')::jsonb) -> 'passagem' ->> 'situacao' <> 'aguardando'
     OR (pg_temp.v('la5')::jsonb) -> 'passagem' ->> 'para_nome' <> 'Enfermeira de Teste'
     OR (pg_temp.v('la6')::jsonb) -> 'passagem' ->> 'situacao' <> 'aceita' THEN
    RAISE EXCEPTION 'FALHOU: passagem no card (% / %)', pg_temp.v('la5'), pg_temp.v('la6');
  END IF;
  RAISE NOTICE 'OK  o card mostra a passagem aguardando e depois aceita, com quem recebe';
END $$;

-- ── desfecho da observação ──────────────────────────────────────────────────
UPDATE public.internacoes SET data_admissao = now() - interval '3 hours' WHERE id = pg_temp.u('ia');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L)', pg_temp.v('id'), 'alta_medica', 'R60'), 'Esta ação é do médico', 'desfecho é do médico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L, %L)', pg_temp.v('ia'), 'evasao', 'A90', 'saiu'),
  'Como e quando foi percebida a evasão', 'evasão pede relato de 15 letras');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L, %L)', pg_temp.v('ia'), 'alta_a_pedido', 'A90', 'quis ir'),
  'Riscos explicados e termo assinado', 'alta a pedido pede relato de 15 letras');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L, %L, %L)', pg_temp.v('ia'), 'obito', 'A90', 'Parada cardiorrespiratória sem resposta à RCP', '{"numero_do":"1234567"}'),
  'Informe a hora do óbito', 'óbito pede a hora do óbito');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L, %L, %L)', pg_temp.v('ia'), 'obito', 'A90', 'Parada cardiorrespiratória sem resposta à RCP',
  json_build_object('numero_do', '1234567', 'hora_obito', now() + interval '1 hour')), 'Hora do óbito no futuro', 'hora do óbito no futuro é recusada');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L, %L, %L)', pg_temp.v('ia'), 'obito', 'A90', 'Parada cardiorrespiratória sem resposta à RCP',
  json_build_object('hora_obito', now() - interval '10 minutes')), 'Informe o número da Declaração de Óbito', 'óbito pede a DO (regra do dar_alta)');
SELECT public.finalizar_observacao(pg_temp.u('ia'), 'obito', 'A90', 'Parada cardiorrespiratória sem resposta à RCP',
  json_build_object('numero_do', '1234567', 'hora_obito', now() - interval '10 minutes')::jsonb);
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L)', pg_temp.v('ic'), 'transferencia', 'R60'), 'Informe o serviço de destino', 'transferência pede o destino');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L)', pg_temp.v('ib'), 'internacao'), 'Escolha o setor de internação', 'internação pede o setor');
SELECT public.finalizar_observacao(pg_temp.u('ib'), 'internacao', NULL, NULL, '{"setor_id":"22000000-0000-4000-8000-000000000001"}');
SELECT public.finalizar_observacao(pg_temp.u('id'), 'alta_apos_medicacao', 'R60');
INSERT INTO t SELECT 'la7', pg_temp.linha('ia')::text;
INSERT INTO t SELECT 'lb7', pg_temp.linha('ib')::text;
INSERT INTO t SELECT 'ld7', pg_temp.linha('id')::text;
RESET ROLE;
DO $$
DECLARE a public.internacoes; b public.internacoes; la jsonb := pg_temp.v('la7')::jsonb; lb jsonb := pg_temp.v('lb7')::jsonb; ld jsonb := pg_temp.v('ld7')::jsonb;
BEGIN
  SELECT * INTO a FROM public.internacoes WHERE id = pg_temp.u('ia');
  SELECT * INTO b FROM public.internacoes WHERE id = pg_temp.u('ib');
  IF a.status <> 'obito' OR a.alta_detalhes ->> 'desfecho_observacao' <> 'obito' OR a.alta_detalhes ->> 'hora_obito' IS NULL
     OR a.alta_observacoes NOT LIKE 'Parada%'
     OR (SELECT situacao FROM public.pendencias WHERE internacao_id = a.id AND tipo = 'observacao') <> 'concluida' THEN
    RAISE EXCEPTION 'FALHOU: óbito (%)', a;
  END IF;
  RAISE NOTICE 'OK  óbito sai pelo dar_alta com hora do óbito, DO e relato; a observação se resolve';
  IF (SELECT encerrado_em FROM public.observacao_protocolos WHERE id = pg_temp.u('proto')) IS NULL
     OR (SELECT motivo_encerramento FROM public.observacao_protocolos WHERE id = pg_temp.u('proto')) <> 'Encerrado com o desfecho da observação' THEN
    RAISE EXCEPTION 'FALHOU: protocolo não encerrou com o desfecho';
  END IF;
  RAISE NOTICE 'OK  o protocolo aberto se encerra junto com o desfecho';
  IF la ->> 'estado' <> 'finalizado' OR la ->> 'desfecho' <> 'obito' OR la ->> 'box' <> 'Box 1' OR la ->> 'finalizado_em' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: finalizado na lista (%)', la;
  END IF;
  RAISE NOTICE 'OK  finalizado segue na lista do plantão com desfecho, hora e o box em que estava';
  IF b.status <> 'internado' OR b.setor_atual_id <> '22000000-0000-4000-8000-000000000001'
     OR (SELECT setor_id FROM public.pacientes WHERE id = b.paciente_id) <> b.setor_atual_id
     OR lb ->> 'desfecho' <> 'internacao' OR lb ->> 'estado' <> 'finalizado' THEN
    RAISE EXCEPTION 'FALHOU: internação (% / %)', b, lb;
  END IF;
  RAISE NOTICE 'OK  internação leva o paciente ao setor escolhido e sai da observação';
  IF ld ->> 'desfecho' <> 'alta_apos_medicacao' THEN RAISE EXCEPTION 'FALHOU: alta após medicação (%)', ld; END IF;
  RAISE NOTICE 'OK  alta após medicação guarda o desfecho da observação';
END $$;

-- ── segurança ───────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('INSERT INTO public.observacao_eventos (unidade_id, paciente_id, internacao_id, tipo, autor_id) VALUES (%L, %L, %L, %L, %L)',
  '21000000-0000-4000-8000-000000000001', (SELECT paciente_id FROM public.internacoes WHERE id = pg_temp.u('ic')), pg_temp.v('ic'), 'atendimento',
  '10000000-0000-4000-8000-000000000002'), 'permission denied', 'escrita direta nas tabelas é negada');
RESET ROLE;
SELECT pg_temp.falha('DELETE FROM public.observacao_eventos', 'Registro clínico não se apaga', 'guarda de 20 anos: marcos não se apagam');
SELECT pg_temp.falha('DELETE FROM public.observacao_protocolo_etapas', 'Registro clínico não se apaga', 'guarda de 20 anos: etapas não se apagam');
SELECT pg_temp.falha('UPDATE public.observacao_eventos SET tipo = tipo', 'observacao_eventos é só de inserção', 'marcos são só de inserção');
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.painel_observacao(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.finalizar_observacao(uuid, text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.observacao_para_mim(uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: permissões das funções';
  END IF;
  RAISE NOTICE 'OK  anon não executa as RPCs; auxiliares privadas fechadas';
END $$;
-- segundo fator ligado: escrita sem aal2 é recusada
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
SELECT pg_temp.falha(format('SELECT public.observacao_atender(%L)', pg_temp.v('ic')), 'SEGUNDO_FATOR', 'escrita pede o segundo fator');
RESET ROLE;
ROLLBACK;
