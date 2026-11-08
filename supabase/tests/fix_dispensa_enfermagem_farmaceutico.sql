-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270307000004_dispensa_enfermagem_farmaceutico.sql
-- (achado A P2-3 do teste da rede; decisão do RT em 07/11/2026: A). Tudo em
-- transação com ROLLBACK. O cenário é criado aqui.
--
-- A retirada pela enfermagem (sem farmacêutico) só vale com a farmácia
-- fechada: com farmacêutico em check-in na unidade, é recusada.
-- 1. farmacêutico com check-in agora: a enfermeira é recusada, mesmo com
--    justificativa; nada é gravado;
-- 2. o farmacêutico dispensa normalmente;
-- 3. farmacêutico escalado, mas sem check-in: a enfermeira retira com
--    justificativa (sem_farmaceutico);
-- 4. depois do check-out do farmacêutico: idem; sem justificativa continua
--    recusado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a3c01'),
  ('upa',   '00000000-0000-4000-8000-0000000a3c02'),
  ('porta', '00000000-0000-4000-8000-0000000a3c11'),
  ('farmc', '00000000-0000-4000-8000-0000000a3c12'),
  ('med',   '00000000-0000-4000-8000-0000000a3c21'),
  ('enf',   '00000000-0000-4000-8000-0000000a3c22'),
  ('farm',  '00000000-0000-4000-8000-0000000a3c23'),
  ('pac',   '00000000-0000-4000-8000-0000000a3c31'),
  ('ep',    '00000000-0000-4000-8000-0000000a3c32'),
  ('dipi',  '00000000-0000-4000-8000-0000000a3c41'),
  ('cefa',  '00000000-0000-4000-8000-0000000a3c42'),
  ('ondan', '00000000-0000-4000-8000-0000000a3c43');
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
CREATE FUNCTION pg_temp.disp_sql(p_item text, p_just text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.dispensar_item(%L, 1, %L)', pg_temp.v(p_item), p_just) $$;
GRANT EXECUTE ON FUNCTION pg_temp.disp_sql(text, text) TO authenticated;
CREATE FUNCTION pg_temp.dispensacoes(p_item text) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.dispensacoes WHERE item_id = pg_temp.v(p_item) $$;
GRANT EXECUTE ON FUNCTION pg_temp.dispensacoes(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@dispensa.local' FROM ids WHERE nome IN ('med', 'enf', 'farm');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'farm')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da retirada sem farmacêutico');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da retirada sem farmacêutico', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('farmc'), pg_temp.id('upa'), 'Farmácia', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro'),
  (pg_temp.id('farm'), pg_temp.id('upa'), 'farmaceutico');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('upa'), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('porta', 'med'), ('porta', 'enf'), ('farmc', 'farm')) x(s, p);
-- médico e enfermeira com check-in; o farmacêutico também (caso 1)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('upa') ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  (pg_temp.id('dipi'), 'Dipirona retirada', 'dipirona retirada', 'ampola (teste retirada)', 'teste-retirada'),
  (pg_temp.id('cefa'), 'Cefalexina retirada', 'cefalexina retirada', 'cápsula (teste retirada)', 'teste-retirada'),
  (pg_temp.id('ondan'), 'Ondansetrona retirada', 'ondansetrona retirada', 'ampola (teste retirada)', 'teste-retirada');

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, setor_id)
VALUES (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente Retirada', '1985-01-01', 'F', pg_temp.id('porta'));
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_medico_id, atendimento_iniciado_em)
VALUES (pg_temp.id('ep'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('porta'), 'atendimento', 'Queixa de teste', pg_temp.id('med'),
        now() - interval '2 hours', pg_temp.id('med'), now() - interval '2 hours');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('upa'), pg_temp.id('pac'), c.id, now(), 70, 'manual' FROM public.conceito c WHERE c.nome = 'peso' AND c.unidade_id IS NULL;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
INSERT INTO v SELECT x.k, public.prescrever(pg_temp.id('pac'), json_build_object('medicamento_id', pg_temp.id(x.k),
  'dose', 'dose de teste', 'via', x.via, 'posologia', '8/8h')::jsonb)
  FROM (VALUES ('dipi', 'EV'), ('cefa', 'VO'), ('ondan', 'EV')) x(k, via);
RESET ROLE;
SELECT pg_temp.ok(private.farmaceutico_de_plantao(pg_temp.id('upa')), 'cenário: farmacêutico com check-in conta como de plantão');
SET LOCAL ROLE authenticated;

-- ── 1. farmacêutico com check-in: a enfermeira não retira ───────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(pg_temp.disp_sql('dipi', 'Paciente com dor intensa no box'),
  'Há farmacêutico de plantão na unidade', 'com farmacêutico em check-in, a enfermeira é recusada mesmo com justificativa');
SELECT pg_temp.ok(pg_temp.dispensacoes('dipi') = 0, 'nada gravado');

-- ── 2. o farmacêutico dispensa ──────────────────────────────────────────────
SELECT pg_temp.como('farm');
INSERT INTO v SELECT 'disp_farm', (public.dispensar_item(pg_temp.v('dipi'), 1) ->> 'id')::uuid;
RESET ROLE;
SELECT pg_temp.ok((SELECT NOT sem_farmaceutico FROM public.dispensacoes WHERE id = pg_temp.v('disp_farm')), 'o farmacêutico dispensa');

-- ── 3. escalado, mas sem check-in: farmácia fechada ─────────────────────────
DELETE FROM public.presenca_plantonista WHERE perfil_id = pg_temp.id('farm');
SELECT pg_temp.ok(NOT private.farmaceutico_de_plantao(pg_temp.id('upa')), 'sem check-in, o farmacêutico escalado não conta');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'disp_enf1', (public.dispensar_item(pg_temp.v('cefa'), 1, 'Farmacêutico ainda não chegou ao plantão') ->> 'id')::uuid;
RESET ROLE;
SELECT pg_temp.ok((SELECT sem_farmaceutico FROM public.dispensacoes WHERE id = pg_temp.v('disp_enf1')),
  'sem check-in do farmacêutico, a enfermeira retira com justificativa (sem farmacêutico)');

-- ── 4. depois do check-out ──────────────────────────────────────────────────
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkout_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, now() - interval '5 minutes'
  FROM public.escala_plantao e WHERE e.perfil_id = pg_temp.id('farm');
SELECT pg_temp.ok(NOT private.farmaceutico_de_plantao(pg_temp.id('upa')), 'depois do check-out, o farmacêutico não conta');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(pg_temp.disp_sql('ondan', NULL), 'Retirada sem farmacêutico: escreva a justificativa', 'sem justificativa continua recusado');
INSERT INTO v SELECT 'disp_enf2', (public.dispensar_item(pg_temp.v('ondan'), 1, 'Farmacêutico saiu do plantão') ->> 'id')::uuid;
SELECT pg_temp.ok(pg_temp.v('disp_enf2') IS NOT NULL, 'depois do check-out do farmacêutico, a enfermeira retira com justificativa');
ROLLBACK;
