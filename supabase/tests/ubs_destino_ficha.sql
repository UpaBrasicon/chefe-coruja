-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000006_ubs_destino_ficha.sql (percurso da UBS,
-- U6, PR 2). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. a recepção escolhe o destino; sem destino, médico; sem enfermeiro de
--    plantão, a ficha da enfermagem vai ao médico;
-- 2. a consulta marcada com o enfermeiro chega para a enfermagem; com o
--    médico, para o médico;
-- 3. fora da UBS não há destino.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000076a1'),
  ('ubs',   '00000000-0000-4000-8000-0000000076a2'),
  ('cons',  '00000000-0000-4000-8000-0000000076a3'),
  ('cons2', '00000000-0000-4000-8000-0000000076a4'),
  ('upa',   '00000000-0000-4000-8000-0000000076a5'),
  ('porta', '00000000-0000-4000-8000-0000000076a6'),
  ('rec',   '00000000-0000-4000-8000-0000000076b1'),
  ('enf',   '00000000-0000-4000-8000-0000000076b2'),
  ('med',   '00000000-0000-4000-8000-0000000076b3'),
  ('recu',  '00000000-0000-4000-8000-0000000076b4'),
  ('pa',    '00000000-0000-4000-8000-0000000076c1'),
  ('pb',    '00000000-0000-4000-8000-0000000076c2'),
  ('ag_e',  '00000000-0000-4000-8000-0000000076d1'),
  ('ag_m',  '00000000-0000-4000-8000-0000000076d2');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, r jsonb) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.d(p text) RETURNS text LANGUAGE sql AS $$ SELECT r ->> 'destino' FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.d(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u62.local' FROM ids WHERE nome IN ('rec', 'enf', 'med', 'recu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med', 'recu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6 PR2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6 PR2', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U6 PR2', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('cons2'), pg_temp.id('ubs'), 'Consultório 2', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('recu'), pg_temp.id('upa'), 'recepcao');
-- enfermeiro só no consultório 1
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), 'enf'), (pg_temp.id('ubs'), pg_temp.id('cons'), 'rec'),
               (pg_temp.id('ubs'), pg_temp.id('cons'), 'med'), (pg_temp.id('ubs'), pg_temp.id('cons2'), 'rec'),
               (pg_temp.id('upa'), pg_temp.id('porta'), 'recu')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('ubs'), pg_temp.id('upa')) ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento) VALUES
  (pg_temp.id('pa'), pg_temp.id('ubs'), 'Paciente PR2 A', date '1980-01-01'),
  (pg_temp.id('pb'), pg_temp.id('ubs'), 'Paciente PR2 B', date '1981-01-01');
-- consultas marcadas para agora: uma com o enfermeiro, outra com o médico
INSERT INTO public.agendamentos (id, unidade_id, perfil_id, tipo, paciente_id, tipo_atendimento_aps, inicio, fim, marcado_por, servico) VALUES
  (pg_temp.id('ag_e'), pg_temp.id('ubs'), pg_temp.id('enf'), 'consulta', pg_temp.id('pa'), 'consulta_agendada', now(), now() + interval '30 minutes', pg_temp.id('rec'), 'consulta_enfermagem'),
  (pg_temp.id('ag_m'), pg_temp.id('ubs'), pg_temp.id('med'), 'consulta', pg_temp.id('pb'), 'consulta_agendada', now(), now() + interval '30 minutes', pg_temp.id('rec'), 'consulta_medica');

SET LOCAL ROLE authenticated;

-- ── 1. recepção ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'enf', public.registrar_ficha(pg_temp.id('cons'), 'Curativo', NULL,
  '{"nome":"Paciente PR2 Um","data_nascimento":"1970-01-01","tipo_atendimento":"consulta_no_dia","destino":"enfermagem"}');
INSERT INTO v SELECT 'sem', public.registrar_ficha(pg_temp.id('cons'), 'Tosse', NULL,
  '{"nome":"Paciente PR2 Dois","data_nascimento":"1971-01-01","tipo_atendimento":"consulta_no_dia"}');
INSERT INTO v SELECT 'cons2', public.registrar_ficha(pg_temp.id('cons2'), 'Curativo', NULL,
  '{"nome":"Paciente PR2 Tres","data_nascimento":"1972-01-01","tipo_atendimento":"consulta_no_dia","destino":"enfermagem"}');
SELECT pg_temp.ok(pg_temp.d('enf') = 'enfermagem', '1. a recepção manda para a enfermagem');
SELECT pg_temp.ok(pg_temp.d('sem') = 'medico', '1. sem destino, vai ao médico');
SELECT pg_temp.ok(pg_temp.d('cons2') = 'medico', '1. sem enfermeiro de plantão, vai ao médico');

-- ── 2. chegada da consulta marcada ──────────────────────────────────────────
INSERT INTO v SELECT 'ag_e', public.agenda_registrar_chegada(pg_temp.id('ag_e'), pg_temp.id('cons'), 'Consulta de enfermagem');
INSERT INTO v SELECT 'ag_m', public.agenda_registrar_chegada(pg_temp.id('ag_m'), pg_temp.id('cons'), 'Consulta médica');
SELECT pg_temp.ok(pg_temp.d('ag_e') = 'enfermagem', '2. a consulta com o enfermeiro chega para a enfermagem');
SELECT pg_temp.ok(pg_temp.d('ag_m') = 'medico', '2. a consulta com o médico chega para o médico');

-- ── 3. fora da UBS ──────────────────────────────────────────────────────────
SELECT pg_temp.como('recu');
INSERT INTO v SELECT 'upa', public.registrar_ficha(pg_temp.id('porta'), 'Dor', NULL,
  '{"nome":"Paciente PR2 UPA","data_nascimento":"1973-01-01","destino":"enfermagem"}');
SELECT pg_temp.ok(pg_temp.d('upa') IS NULL, '3. fora da UBS não há destino');

ROLLBACK;
