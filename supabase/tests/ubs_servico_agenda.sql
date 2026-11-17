-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000005_ubs_servico_agenda.sql (percurso da UBS,
-- U6, PR 1). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. sem serviço, vale a consulta do profissional (médica ou de enfermagem);
-- 2. cada profissional só tem os seus serviços;
-- 3. a agenda do dia devolve o serviço.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000075a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000075a2'),
  ('cons', '00000000-0000-4000-8000-0000000075a3'),
  ('ges',  '00000000-0000-4000-8000-0000000075b1'),
  ('med',  '00000000-0000-4000-8000-0000000075b2'),
  ('enf',  '00000000-0000-4000-8000-0000000075b3'),
  ('rec',  '00000000-0000-4000-8000-0000000075b4'),
  ('p1',   '00000000-0000-4000-8000-0000000075c1'),
  ('p2',   '00000000-0000-4000-8000-0000000075c2'),
  ('p3',   '00000000-0000-4000-8000-0000000075c3');
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
-- daqui a 7 dias, no horário local
CREATE FUNCTION pg_temp.h(hora text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT ((private.data_atual() + 7) + hora::time) AT TIME ZONE 'America/Sao_Paulo' $$;
GRANT EXECUTE ON FUNCTION pg_temp.h(text) TO authenticated;
CREATE TEMP TABLE ag (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ag TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u6s.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'), (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
SELECT id, pg_temp.id('ubs'), 'Paciente ' || nome, date '1980-01-01' FROM ids WHERE nome IN ('p1', 'p2', 'p3');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ges');
SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id(p),
  (SELECT jsonb_agg(jsonb_build_object('dia', d, 'periodo', 'manha', 'inicio', '07:00', 'fim', '11:00', 'duracao', 30)) FROM generate_series(0, 6) d))
  FROM unnest(ARRAY['med', 'enf']) p;

-- ── 1. serviço padrão ───────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO ag SELECT 'm1', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h('07:00'), pg_temp.id('p1'));
INSERT INTO ag SELECT 'e1', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('enf'), pg_temp.h('07:00'), pg_temp.id('p2'));
INSERT INTO ag SELECT 'e2', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('enf'), pg_temp.h('07:30'), pg_temp.id('p3'),
  p_servico => 'teste_rapido');

-- ── 2. serviços de cada profissional ────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('enf'), pg_temp.h('08:00'), pg_temp.id('p1'), p_servico => 'implante')$$,
  'Este profissional não faz este serviço na agenda', '2. o enfermeiro não tem implante na agenda');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h('08:00'), pg_temp.id('p2'), p_servico => 'curativo')$$,
  'Este profissional não faz este serviço na agenda', '2. o médico não tem curativo na agenda');
SELECT pg_temp.falha($$SELECT public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h('08:00'), pg_temp.id('p2'), p_servico => 'vacina')$$,
  'Este profissional não faz este serviço na agenda', '2. vacina não é serviço da agenda (P3 = B)');
INSERT INTO ag SELECT 'm2', public.agenda_marcar(pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.h('08:00'), pg_temp.id('p2'), p_servico => 'diu');
RESET ROLE;
SELECT pg_temp.ok((SELECT servico FROM public.agendamentos WHERE id = (SELECT id FROM ag WHERE nome = 'm1')) = 'consulta_medica',
  '1. sem serviço, a consulta com o médico é consulta médica');
SELECT pg_temp.ok((SELECT servico FROM public.agendamentos WHERE id = (SELECT id FROM ag WHERE nome = 'e1')) = 'consulta_enfermagem',
  '1. sem serviço, a consulta com o enfermeiro é consulta de enfermagem');
SELECT pg_temp.ok((SELECT servico FROM public.agendamentos WHERE id = (SELECT id FROM ag WHERE nome = 'e2')) = 'teste_rapido',
  '2. o enfermeiro marca teste rápido');
SELECT pg_temp.ok((SELECT servico FROM public.agendamentos WHERE id = (SELECT id FROM ag WHERE nome = 'm2')) = 'diu',
  '2. o médico marca inserção de DIU');
SET LOCAL ROLE authenticated;

-- ── 3. agenda do dia ────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.ok(EXISTS (
  SELECT 1 FROM jsonb_array_elements(public.agenda_dia(pg_temp.id('ubs'), private.data_atual() + 7) -> 'profissionais') pr,
         jsonb_array_elements(pr -> 'horarios') h
   WHERE h -> 'agendamento' ->> 'servico' = 'teste_rapido'),
  '3. a agenda do dia devolve o serviço');

ROLLBACK;
