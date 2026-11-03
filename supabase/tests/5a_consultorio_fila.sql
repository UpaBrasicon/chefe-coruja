-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270212000001_consultorio_fila_salas.sql (5A, tarefa 2,
-- parte 2.2). Tudo em transação com ROLLBACK; cenário criado aqui.
--
-- 1. o consultório novo ganha a sala dele; a porta nova segue com as seis;
-- 2. a recepção de plantão no consultório vê a fila (fila_da_porta);
-- 3. o médico marca o consultório do plantão e chama o paciente.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000053a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000053a2'),
  ('cons', '00000000-0000-4000-8000-0000000053a3'),
  ('eme',  '00000000-0000-4000-8000-0000000053a4'),
  ('rec',  '00000000-0000-4000-8000-0000000053a5'),
  ('med',  '00000000-0000-4000-8000-0000000053a6');
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
CREATE TEMP TABLE epi (id uuid) ON COMMIT DROP;
GRANT ALL ON epi TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a22.local' FROM ids WHERE nome IN ('rec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A22');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A22', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 2', 'consultorio'),
  (pg_temp.id('eme'), pg_temp.id('ubs'), 'Sala de urgência', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY[pg_temp.id('rec'), pg_temp.id('med')]) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs')
ON CONFLICT DO NOTHING;

-- ── 1. salas ────────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 1 AND bool_and(nome = 'Consultório 2' AND tipo = 'consultorio')
                     FROM public.salas WHERE setor_id = pg_temp.id('cons')), 'o consultório novo ganha a sala dele');
SELECT pg_temp.ok((SELECT count(*) = 6 FROM public.salas WHERE setor_id = pg_temp.id('eme')), 'a porta nova segue com as seis salas');

SET LOCAL ROLE authenticated;

-- ── 2. fila da recepção ─────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO epi SELECT (public.registrar_ficha(pg_temp.id('cons'), 'Dor de garganta', NULL,
  '{"nome":"Paciente Fila UBS","data_nascimento":"1991-07-07","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.ok((SELECT count(*) = 1 AND bool_and(etapa = 'atendimento') FROM public.fila_da_porta(pg_temp.id('cons'))),
  'a recepção vê a fila do consultório');

-- ── 3. consultório do plantão e chamada ─────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.definir_sala_do_plantao(pg_temp.id('cons'), (SELECT id FROM public.salas WHERE setor_id = pg_temp.id('cons')));
SELECT pg_temp.ok((SELECT (public.chamar_paciente((SELECT id FROM epi), (SELECT id FROM public.salas WHERE setor_id = pg_temp.id('cons'))) ->> 'numero') = '1'),
  'o médico chama o paciente para o consultório');
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((SELECT chamadas = 1 AND ultima_sala = 'Consultório 2' FROM public.fila_da_porta(pg_temp.id('cons'))),
  'a fila mostra a chamada');

RESET ROLE;
SELECT '5a_consultorio_fila ok' AS resultado;
ROLLBACK;
