-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000035_ubs_rf2_demanda_espontanea.sql
-- (refinamento da UBS, RF2). Tudo em transação com ROLLBACK; o cenário é
-- criado aqui.
--
-- 1. azul com "atender hoje" não pede texto e vai à fila do médico;
-- 2. azul com orientação continua pedindo o texto e encerra na escuta;
-- 3. verde segue para a fila do médico; "atender hoje" fora do azul é recusado;
-- 4. a agenda de hoje traz a demanda espontânea (quem aguarda a escuta ou a
--    consulta e não veio da agenda); a ficha encerrada e a que veio da agenda,
--    não; outro dia não traz o campo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-00000000f2a1'),
  ('ubs',  '00000000-0000-4000-8000-00000000f2a2'),
  ('cons', '00000000-0000-4000-8000-00000000f2a3'),
  ('rec',  '00000000-0000-4000-8000-00000000f2b1'),
  ('enf',  '00000000-0000-4000-8000-00000000f2b2'),
  ('med',  '00000000-0000-4000-8000-00000000f2b3');
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
CREATE TEMP TABLE epi (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON epi TO authenticated;
CREATE FUNCTION pg_temp.e(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM epi WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.e(text) TO authenticated;
-- os episódios da demanda espontânea na agenda de hoje
CREATE FUNCTION pg_temp.espontanea(p_data date) RETURNS uuid[] LANGUAGE sql AS $$
  SELECT array_agg((x ->> 'episodio_id')::uuid)
    FROM jsonb_array_elements(public.agenda_dia(pg_temp.id('ubs'), p_data) -> 'demanda_espontanea') x $$;
GRANT EXECUTE ON FUNCTION pg_temp.espontanea(date) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@rf2.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do RF2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do RF2', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
INSERT INTO epi SELECT 'hoje', (public.registrar_ficha(pg_temp.id('cons'), 'Dor nas costas há 1 mês', NULL,
  '{"nome":"Paciente Atender Hoje","data_nascimento":"1980-02-02","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'orient', (public.registrar_ficha(pg_temp.id('cons'), 'Quer saber da vacina', NULL,
  '{"nome":"Paciente Orientacao","data_nascimento":"1985-08-08","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'verde', (public.registrar_ficha(pg_temp.id('cons'), 'Tosse há 3 dias', NULL,
  '{"nome":"Paciente Verde","data_nascimento":"1975-03-03","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'espera', (public.registrar_ficha(pg_temp.id('cons'), 'Dor de garganta', NULL,
  '{"nome":"Paciente Aguarda Escuta","data_nascimento":"1995-05-05","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'agenda', (public.registrar_ficha(pg_temp.id('cons'), 'Consulta marcada', NULL,
  '{"nome":"Paciente Da Agenda","data_nascimento":"1960-06-06","tipo_atendimento":"consulta_agendada"}') ->> 'episodio_id')::uuid;
RESET ROLE;
-- a ficha "agenda" veio de um agendamento de hoje
INSERT INTO public.agendamentos (unidade_id, perfil_id, tipo, paciente_id, tipo_atendimento_aps, inicio, fim, situacao, episodio_id, marcado_por)
SELECT e.unidade_id, pg_temp.id('med'), 'consulta', e.paciente_id, 'consulta_agendada', now(), now() + interval '20 minutes', 'presente', e.id,
       pg_temp.id('rec')
  FROM public.episodios e WHERE e.id = pg_temp.e('agenda');
SET LOCAL ROLE authenticated;

-- ── 1. azul com "atender hoje" ──────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT public.registrar_escuta_aps(pg_temp.e('hoje'), 'azul', 'atender_hoje');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'atendimento' AND cor_atual = 'azul' AND encerrado_em IS NULL
                     FROM public.episodios WHERE id = pg_temp.e('hoje')),
  '1. azul "atender hoje" vai à fila do médico, sem texto de orientação');
SELECT pg_temp.ok((SELECT saida_escuta = 'atender_hoje' FROM public.classificacoes_risco WHERE episodio_id = pg_temp.e('hoje')),
  '1. a saída fica registrada na classificação');
SET LOCAL ROLE authenticated;

-- ── 2. azul com orientação ──────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('orient'), 'azul', 'orientacao')$$,
  'Escreva a orientação dada ou o agendamento', '2. azul com orientação ainda pede o texto');
SELECT public.registrar_escuta_aps(pg_temp.e('orient'), 'azul', 'orientacao', p_obs => 'Orientada sobre o calendário de vacinas');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' FROM public.episodios WHERE id = pg_temp.e('orient')), '2. azul com orientação encerra na escuta');
SET LOCAL ROLE authenticated;

-- ── 3. verde; "atender hoje" fora do azul ───────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('verde'), 'verde', 'atender_hoje')$$,
  'Situação aguda (vermelho, amarelo ou verde) vai para a consulta', '3. "atender hoje" só no azul');
SELECT public.registrar_escuta_aps(pg_temp.e('verde'), 'verde', 'consulta');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'atendimento' FROM public.episodios WHERE id = pg_temp.e('verde')), '3. verde vai à fila do médico');
SET LOCAL ROLE authenticated;

-- ── 4. a agenda de hoje ─────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.espontanea(private.data_atual()) @> ARRAY[pg_temp.e('hoje'), pg_temp.e('verde'), pg_temp.e('espera')],
  '4. a agenda de hoje traz o azul "atender hoje", o verde e quem aguarda a escuta');
SELECT pg_temp.ok(NOT (pg_temp.e('orient') = ANY (pg_temp.espontanea(private.data_atual())))
                  AND NOT (pg_temp.e('agenda') = ANY (pg_temp.espontanea(private.data_atual()))),
  '4. a ficha encerrada e a que veio da agenda ficam fora');
SELECT pg_temp.ok(NOT (public.agenda_dia(pg_temp.id('ubs'), private.data_atual() + 1) ? 'demanda_espontanea'),
  '4. outro dia não traz a demanda espontânea');
RESET ROLE;

ROLLBACK;
