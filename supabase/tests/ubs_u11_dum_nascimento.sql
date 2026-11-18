-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000014_ubs_u11_dum_nascimento.sql (percurso da
-- UBS, U11, PR 1). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. na UBS a ficha exige a data de nascimento (cadastro novo e cadastro sem a
--    data);
-- 2. a DUM antes de parto ou aborto registrado da mesma mulher é recusada na
--    inclusão no pré-natal, na correção da DUM e na escuta inicial.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000091a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000091a2'),
  ('cons', '00000000-0000-4000-8000-0000000091a3'),
  ('rec',  '00000000-0000-4000-8000-0000000091b1'),
  ('enf',  '00000000-0000-4000-8000-0000000091b2'),
  ('med',  '00000000-0000-4000-8000-0000000091b3');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u11a.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U11 PR1');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U11 PR1', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

-- cadastros: gestante com RN de 90 dias; mulher com parto há 30 dias; cadastro sem nascimento
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento) VALUES
  ('00000000-0000-4000-8000-0000000091c1', pg_temp.id('ubs'), 'Mae Com Bebe', 'U11-1', 'F', '1995-01-01'),
  ('00000000-0000-4000-8000-0000000091c2', pg_temp.id('ubs'), 'Mae Parto Recente', 'U11-2', 'F', '1993-02-02'),
  ('00000000-0000-4000-8000-0000000091c3', pg_temp.id('ubs'), 'Cadastro Sem Data', 'U11-3', 'F', NULL);
INSERT INTO public.pacientes (unidade_id, nome, prontuario, sexo, data_nascimento, mae_id)
VALUES (pg_temp.id('ubs'), 'RN de Mae Com Bebe', 'U11-4', 'F', private.data_atual() - 90, '00000000-0000-4000-8000-0000000091c1');
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum, entrada_por, desfecho, desfecho_em, desfecho_por, desfecho_registrado_em)
VALUES (pg_temp.id('ubs'), '00000000-0000-4000-8000-0000000091c2', 'manual', private.data_atual() - 300, pg_temp.id('enf'),
        'parto', private.data_atual() - 30, pg_temp.id('enf'), now());

SET LOCAL ROLE authenticated;
-- ── 1. data de nascimento na UBS ────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Consulta', NULL,
  '{"nome":"Sem Data Nova","tipo_atendimento":"consulta_no_dia"}')$$,
  'Na UBS, informe a data de nascimento', '1. cadastro novo sem a data, recusa');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Consulta', '00000000-0000-4000-8000-0000000091c3',
  '{"tipo_atendimento":"consulta_no_dia"}')$$,
  'Na UBS, informe a data de nascimento', '1. cadastro antigo sem a data, recusa');
SELECT pg_temp.ok((public.registrar_ficha(pg_temp.id('cons'), 'Consulta', '00000000-0000-4000-8000-0000000091c3',
  '{"tipo_atendimento":"consulta_no_dia","data_nascimento":"1988-03-03"}') ->> 'episodio_id') IS NOT NULL,
  '1. com a data informada, a ficha abre');

-- ── 2. DUM contra parto ─────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.pre_natal_incluir(%L, %L)', '00000000-0000-4000-8000-0000000091c1', private.data_atual() - 147),
  'A DUM (', '2. bebê de 3 meses e DUM de 21 semanas, recusa (achado E4)');
INSERT INTO v SELECT 'g1', public.pre_natal_incluir('00000000-0000-4000-8000-0000000091c1', private.data_atual() - 60);
SELECT pg_temp.ok(pg_temp.v('g1') IS NOT NULL, '2. DUM depois do nascimento do RN, aceita');
SELECT pg_temp.falha(format('SELECT public.pre_natal_definir_dum(%L, %L)', pg_temp.v('g1'), private.data_atual() - 120),
  'A DUM (', '2. corrigir a DUM para antes do RN, recusa');

-- escuta inicial de quem teve parto há 30 dias
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'esc', (public.registrar_ficha(pg_temp.id('cons'), 'Atraso menstrual', '00000000-0000-4000-8000-0000000091c2',
  '{"tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.registrar_escuta_aps(%L, %L, %L, p_dum => %L)', pg_temp.v('esc'), 'verde', 'consulta', private.data_atual() - 100),
  'A DUM (', '2. na escuta, DUM antes do parto de 30 dias, recusa');
RESET ROLE;
SELECT pg_temp.ok(private.parto_depois_da_dum('00000000-0000-4000-8000-0000000091c2', private.data_atual() - 10) IS NULL,
  '2. DUM depois do parto, sem conflito');

ROLLBACK;
