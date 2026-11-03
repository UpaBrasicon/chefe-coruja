-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270214000001_agenda_ubs.sql (5A, tarefa 3, parte 3.1).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui, sem depender do
-- seed; roda também na homologação. Dias futuros: hoje + 7 e hoje + 14.
--
-- 1. só UBS; 2. configuração só do gestor, para médico ou enfermeiro, sem
-- períodos que se cruzam; 3. marcação na grade, no futuro, sem conflito, um
-- por paciente por dia, por quem pode; reserva; 4. fechamento (não fecha com
-- consulta marcada; não marca no dia fechado; reabre); 5. cancelamento só
-- antes do horário; 6. agenda_dia; 7. chegada abre a ficha ligada e a conduta
-- fecha como realizado; 8. evasão = não aguardou; 9. ficha retirada por engano
-- devolve o agendamento; 10. falta só depois do horário e desfeita só no dia.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000056a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000056a2'),
  ('upa',  '00000000-0000-4000-8000-0000000056a3'),
  ('cons', '00000000-0000-4000-8000-0000000056a4'),
  ('ges',  '00000000-0000-4000-8000-0000000056a5'),
  ('rec',  '00000000-0000-4000-8000-0000000056a6'),
  ('med',  '00000000-0000-4000-8000-0000000056a7'),
  ('enf',  '00000000-0000-4000-8000-0000000056a8'),
  ('far',  '00000000-0000-4000-8000-0000000056a9'),
  ('p1',   '00000000-0000-4000-8000-0000000056b1'),
  ('p2',   '00000000-0000-4000-8000-0000000056b2'),
  ('p3',   '00000000-0000-4000-8000-0000000056b3'),
  ('p4',   '00000000-0000-4000-8000-0000000056b4');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
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
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
-- horário local (America/Sao_Paulo) do dia hoje + n
CREATE FUNCTION pg_temp.h(n int, hora text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT ((private.data_atual() + n) + hora::time) AT TIME ZONE 'America/Sao_Paulo' $$;
GRANT EXECUTE ON FUNCTION pg_temp.h(int, text) TO authenticated;
CREATE TEMP TABLE ag (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ag TO authenticated;
CREATE FUNCTION pg_temp.a(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ag WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.a(text) TO authenticated;
-- leitura da tabela no teste (o authenticated não tem acesso direto)
CREATE FUNCTION pg_temp.sit(p text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT situacao FROM public.agendamentos WHERE id = (SELECT id FROM ag WHERE nome = p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.sit(text) TO authenticated;
CREATE FUNCTION pg_temp.ep(p text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT episodio_id FROM public.agendamentos WHERE id = (SELECT id FROM ag WHERE nome = p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ep(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a3.local' FROM ids WHERE nome IN ('ges', 'rec', 'med', 'enf', 'far');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'rec', 'med', 'enf', 'far')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A3', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do 5A3', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('far'), pg_temp.id('ubs'), 'farmaceutico');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
SELECT id, pg_temp.id('ubs'), 'Paciente ' || nome, date '1970-01-01' FROM ids WHERE nome LIKE 'p_';
-- de plantão agora no consultório, com check-in: recepção e médico
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1. só UBS ───────────────────────────────────────────────────────────────
SELECT pg_temp.como('ges');
SELECT pg_temp.falha($$SELECT public.agenda_dia(pg_temp.id('upa'), private.data_atual())$$, 'A agenda de consultas é da UBS', 'agenda só na UBS');

-- ── 2. configuração ─────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'), '[]')$$,
  'A configuração da agenda é do gestor', 'recepção não configura');
SELECT pg_temp.como('ges');
SELECT pg_temp.falha($$SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('rec'), '[]')$$,
  'Este profissional não tem agenda', 'agenda só de médico ou enfermeiro');
SELECT pg_temp.falha($$SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  '[{"dia":1,"periodo":"manha","inicio":"07:00","fim":"12:00","duracao":20},{"dia":1,"periodo":"tarde","inicio":"11:00","fim":"15:00","duracao":20}]')$$,
  'Dois períodos do mesmo dia se cruzam', 'períodos do mesmo dia não se cruzam');
SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  (SELECT jsonb_agg(x) FROM generate_series(0, 6) d,
          LATERAL (VALUES (jsonb_build_object('dia', d, 'periodo', 'manha', 'inicio', '07:00', 'fim', '12:00', 'duracao', 20)),
                          (jsonb_build_object('dia', d, 'periodo', 'tarde', 'inicio', '13:00', 'fim', '17:00', 'duracao', 30))) v(x)));
SELECT pg_temp.ok(jsonb_array_length((SELECT e -> 'horarios' FROM jsonb_array_elements(public.agenda_configuracao(pg_temp.id('ubs'))) e
                                       WHERE e ->> 'perfil_id' = pg_temp.id('med')::text)) = 14, 'grade do médico: 7 dias × 2 períodos');

-- ── 3. marcação e reserva ───────────────────────────────────────────────────
SELECT pg_temp.como('far');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '08:00'), pg_temp.id('p1'))$$,
  'Acesso negado: marca', 'farmacêutico não marca');
SELECT pg_temp.como('rec');
INSERT INTO ag SELECT 'c1', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '08:00'), pg_temp.id('p1'),
  'consulta_programada', 'Retorno com os exames');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '08:00'), pg_temp.id('p2'))$$,
  'Esse horário já está ocupado', 'não marca por cima');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '08:10'), pg_temp.id('p2'))$$,
  'Horário fora da agenda', 'só nos horários da grade');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '12:20'), pg_temp.id('p2'))$$,
  'Horário fora da agenda', 'fora do período');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(-1, '08:00'), pg_temp.id('p2'))$$,
  'Só se marca em horário futuro', 'não marca no passado');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '09:00'), pg_temp.id('p1'))$$,
  'O paciente já tem consulta marcada', 'um horário por paciente por dia com o profissional');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '09:00'), pg_temp.id('p2'), 'retorno')$$,
  'Tipo da consulta', 'tipo da consulta da ficha');
INSERT INTO ag SELECT 'c2', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '13:30'), pg_temp.id('p2'));
SELECT pg_temp.como('med');
INSERT INTO ag SELECT 'c3', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '10:00'), pg_temp.id('p3'));
SELECT pg_temp.como('enf');
INSERT INTO ag SELECT 'r1', public.agenda_reservar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '11:00'), 'atividade_coletiva');
SELECT pg_temp.falha($$SELECT public.agenda_reservar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '11:20'), 'outro')$$,
  'new row for relation "agendamentos" violates check constraint', 'reserva "outro" pede especifique');
RESET ROLE;
SELECT pg_temp.ok((SELECT tipo_atendimento_aps = 'consulta_programada' AND observacao = 'Retorno com os exames' AND fim = pg_temp.h(7, '08:20')
                     FROM public.agendamentos WHERE id = pg_temp.a('c1')), 'consulta marcada com a duração da grade');
SET LOCAL ROLE authenticated;

-- ── 4. fechamento ───────────────────────────────────────────────────────────
SELECT pg_temp.como('ges');
SELECT pg_temp.falha($$SELECT public.agenda_fechar(pg_temp.id('ubs'), pg_temp.id('med'), private.data_atual() + 7, private.data_atual() + 7, 'curso')$$,
  'Há 3 consulta(s) marcada(s)', 'não fecha com consulta marcada');
INSERT INTO ag SELECT 'f1', public.agenda_fechar(pg_temp.id('ubs'), pg_temp.id('med'), private.data_atual() + 14, private.data_atual() + 20, 'ferias');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(14, '08:00'), pg_temp.id('p4'))$$,
  'A agenda está fechada nesse dia (ferias)', 'não marca no dia fechado');
SELECT pg_temp.falha($$SELECT public.agenda_reabrir(pg_temp.a('f1'))$$, 'A configuração da agenda é do gestor', 'só o gestor reabre');
SELECT pg_temp.como('ges');
SELECT public.agenda_reabrir(pg_temp.a('f1'));
SELECT pg_temp.como('rec');
INSERT INTO ag SELECT 'c4', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(14, '08:00'), pg_temp.id('p4'));

-- ── 5. cancelamento ─────────────────────────────────────────────────────────
SELECT public.agenda_cancelar(pg_temp.a('c1'), 'Paciente pediu para remarcar');
SELECT pg_temp.ok(pg_temp.sit('c1') = 'cancelado', 'cancelado antes do horário');
SELECT pg_temp.falha($$SELECT public.agenda_cancelar(pg_temp.a('c1'))$$, 'Só se cancela o que está agendado', 'não cancela duas vezes');
INSERT INTO ag SELECT 'c5', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h(7, '08:00'), pg_temp.id('p4'));

-- ── 6. agenda_dia ───────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT jsonb_array_length(e -> 'horarios') = 23
                          AND (SELECT h -> 'agendamento' ->> 'paciente_id' FROM jsonb_array_elements(e -> 'horarios') h
                                WHERE (h ->> 'inicio')::timestamptz = pg_temp.h(7, '08:00')) = pg_temp.id('p4')::text
                          AND (SELECT h -> 'agendamento' ->> 'motivo_reserva' FROM jsonb_array_elements(e -> 'horarios') h
                                WHERE (h ->> 'inicio')::timestamptz = pg_temp.h(7, '11:00')) = 'atividade_coletiva'
                          AND (SELECT bool_and(NOT (h ->> 'na_escala')::boolean) FROM jsonb_array_elements(e -> 'horarios') h)
                          AND jsonb_array_length(e -> 'fora_da_grade') = 0
                     FROM jsonb_array_elements(public.agenda_dia(pg_temp.id('ubs'), private.data_atual() + 7) -> 'profissionais') e
                    WHERE e ->> 'perfil_id' = pg_temp.id('med')::text),
  'agenda do dia: 23 horários, o marcado no lugar dele (sem o cancelado), a reserva e fora da escala');

-- ── 7 a 10. hoje (direto na tabela: a RPC só marca no futuro) ───────────────
RESET ROLE;
CREATE TEMP TABLE hj ON COMMIT DROP AS
SELECT gen_random_uuid() AS id, n, p, i, s
  FROM (VALUES ('hoje1', 'p1', date_trunc('minute', now()), 'agendado'),
               ('hoje2', 'p2', date_trunc('minute', now()) + interval '1 minute', 'agendado'),
               ('hoje3', 'p3', date_trunc('minute', now()) + interval '2 minutes', 'agendado'),
               ('passado', 'p4', date_trunc('minute', now()) - interval '1 hour', 'agendado'),
               ('ontem', 'p4', now() - interval '1 day', 'nao_compareceu')) v(n, p, i, s);
INSERT INTO public.agendamentos (id, unidade_id, perfil_id, tipo, paciente_id, tipo_atendimento_aps, inicio, fim, marcado_por, situacao)
SELECT id, pg_temp.id('ubs'), pg_temp.id('med'), 'consulta', pg_temp.id(p), 'consulta_agendada', i, i + interval '20 minutes', pg_temp.id('ges'), s
  FROM hj;
INSERT INTO ag SELECT n, id FROM hj;
SET LOCAL ROLE authenticated;

-- 7. chegada e conduta
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.agenda_registrar_chegada(pg_temp.a('c5'), pg_temp.id('cons'), 'Retorno')$$,
  'A chegada se registra no dia da consulta', 'chegada só no dia');
SELECT public.agenda_registrar_chegada(pg_temp.a('hoje1'), pg_temp.id('cons'), 'Retorno da pressão');
SELECT pg_temp.ok(pg_temp.sit('hoje1') = 'presente', 'chegada: presente');
RESET ROLE;
SELECT pg_temp.ok((SELECT e.etapa = 'atendimento' AND e.tipo_atendimento_aps = 'consulta_agendada' AND e.agendamento_id = a.id AND e.paciente_id = pg_temp.id('p1')
                     FROM public.agendamentos a JOIN public.episodios e ON e.id = a.episodio_id WHERE a.id = pg_temp.a('hoje1')),
  'a ficha abre no consultório, ligada ao agendamento, com o tipo dele');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.agenda_registrar_chegada(pg_temp.a('hoje1'), pg_temp.id('cons'), 'Retorno')$$,
  'Só chega quem tem consulta agendada', 'não chega duas vezes');
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.ep('hoje1'));
SELECT public.registrar_soap(pg_temp.ep('hoje1'),
  'Sem queixas', 'PA 130x85', 'Hipertensão controlada', 'Manter', 'I10');
SELECT public.registrar_conduta_aps(pg_temp.ep('hoje1'),
  'consulta_agendada', '{hipertensao_arterial}', '{}', '{retorno_cuidado_continuado}');
SELECT pg_temp.ok(pg_temp.sit('hoje1') = 'realizado', 'conduta registrada: realizado');

-- 8. evasão depois da chegada
SELECT pg_temp.como('rec');
SELECT public.agenda_registrar_chegada(pg_temp.a('hoje2'), pg_temp.id('cons'), 'Dor nas costas');
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.ep('hoje2'));
SELECT public.registrar_desfecho(pg_temp.ep('hoje2'), 'evasao',
  'Chamado duas vezes e não estava', '{"motivo_evasao":"demora"}');
SELECT pg_temp.ok(pg_temp.sit('hoje2') = 'nao_aguardou', 'evasão: não aguardou');

-- 9. ficha retirada por engano: volta a agendado e a chegada pode ser refeita
SELECT pg_temp.como('rec');
SELECT public.agenda_registrar_chegada(pg_temp.a('hoje3'), pg_temp.id('cons'), 'Renovação de receita');
SELECT public.retirar_da_fila(pg_temp.ep('hoje3'), 'engano',
  'Ficha aberta para o paciente errado');
SELECT pg_temp.ok(pg_temp.sit('hoje3') = 'agendado' AND pg_temp.ep('hoje3') IS NULL,
  'ficha retirada por engano: o agendamento volta a agendado');
SELECT public.agenda_registrar_chegada(pg_temp.a('hoje3'), pg_temp.id('cons'), 'Renovação de receita');
SELECT pg_temp.ok(pg_temp.sit('hoje3') = 'presente', 'a chegada se refaz');

-- 10. falta
SELECT pg_temp.falha($$SELECT public.agenda_registrar_falta(pg_temp.a('c5'))$$, 'O horário ainda não chegou', 'falta só depois do horário');
SELECT public.agenda_registrar_falta(pg_temp.a('passado'));
SELECT pg_temp.ok(pg_temp.sit('passado') = 'nao_compareceu', 'falta registrada');
SELECT public.agenda_desfazer_falta(pg_temp.a('passado'));
SELECT pg_temp.ok(pg_temp.sit('passado') = 'agendado', 'falta desfeita no mesmo dia');
SELECT pg_temp.falha($$SELECT public.agenda_cancelar(pg_temp.a('passado'))$$, 'O horário já passou: registre a falta', 'não cancela depois do horário');
SELECT pg_temp.falha($$SELECT public.agenda_desfazer_falta(pg_temp.a('ontem'))$$, 'A falta só se desfaz no dia da consulta', 'falta de outro dia não se desfaz');

RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) >= 5 FROM public.log_auditoria WHERE unidade_id = pg_temp.id('ubs') AND acao = 'agendamento_marcado'),
  'marcações na auditoria');
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.agendamentos', 'SELECT') IS FALSE, 'sem acesso direto à tabela');

ROLLBACK;
