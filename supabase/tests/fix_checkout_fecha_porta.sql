-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000003_checkout_fecha_porta.sql (achado D P2-1
-- do teste da rede; A em C1 e C2). Tudo em transação com ROLLBACK. O cenário
-- é criado aqui.
--
-- 1. em curso: com check-in, a porta está aberta; o check-out da pessoa
--    fecha (plantoes_agora e setores_na_escala_agora); o check-in de novo
--    reabre (C2);
-- 2. 20 min depois do fim: com check-in, aberta; com o check-out da pessoa,
--    fechada (C1); com o check-out automático do fim, segue aberta.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a8c01'),
  ('upa',   '00000000-0000-4000-8000-0000000a8c02'),
  ('porta', '00000000-0000-4000-8000-0000000a8c11'),
  ('med1',  '00000000-0000-4000-8000-0000000a8c21'),  -- em curso
  ('med2',  '00000000-0000-4000-8000-0000000a8c22'),  -- terminou há 5 min, check-out manual
  ('med3',  '00000000-0000-4000-8000-0000000a8c23'),  -- terminou há 5 min, check-out automático
  ('e1',    '00000000-0000-4000-8000-0000000a8c31'),
  ('e2',    '00000000-0000-4000-8000-0000000a8c32'),
  ('e3',    '00000000-0000-4000-8000-0000000a8c33');
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
-- a porta aberta para quem está logado
CREATE FUNCTION pg_temp.aberta(p text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.como(p);
  RETURN EXISTS (SELECT 1 FROM private.plantoes_agora() x WHERE x.id = pg_temp.id('e' || right(p, 1)))
     AND pg_temp.id('porta') IN (SELECT private.setores_na_escala_agora());
END $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@checkout.local' FROM ids WHERE nome LIKE 'med%';
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome LIKE 'med%'
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do check-out');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do check-out', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) SELECT id, pg_temp.id('upa'), 'plantonista' FROM ids WHERE nome LIKE 'med%';
-- med1: das 2 h atrás a 4 h à frente; med2 e med3: terminaram há 5 min
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  (pg_temp.id('e1'), pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med1'), private.data_atual(), 'manha', now() - interval '2 hours', 360),
  (pg_temp.id('e2'), pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med2'), private.data_atual(), 'tarde', now() - interval '365 minutes', 360),
  (pg_temp.id('e3'), pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med3'), private.data_atual(), 'noite', now() - interval '365 minutes', 360);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio + interval '5 minutes' FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('upa');

-- ── 1. em curso ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok(pg_temp.aberta('med1'), 'com check-in, a porta está aberta no plantão');
UPDATE public.presenca_plantonista SET checkout_em = now() - interval '1 second' WHERE perfil_id = pg_temp.id('med1');
SELECT pg_temp.ok(NOT pg_temp.aberta('med1'), 'C1: o check-out da pessoa fecha a porta na hora');
-- C2: o check-in de novo (registrar_checkin apaga o check-out)
UPDATE public.presenca_plantonista SET checkout_em = NULL, checkout_automatico = false, checkin_em = now() - interval '1 second'
 WHERE perfil_id = pg_temp.id('med1');
SELECT pg_temp.ok(pg_temp.aberta('med1'), 'C2: o check-in de novo reabre');

-- ── 2. nos 20 min depois do fim ─────────────────────────────────────────────
SELECT pg_temp.ok(pg_temp.aberta('med2') AND pg_temp.aberta('med3'), 'com check-in, a tolerância de 20 min segue');
UPDATE public.presenca_plantonista SET checkout_em = now() - interval '2 minutes' WHERE perfil_id = pg_temp.id('med2');
SELECT pg_temp.ok(NOT pg_temp.aberta('med2'), 'C1: com o check-out da pessoa, a tolerância fecha');
UPDATE public.presenca_plantonista SET checkout_em = now() - interval '5 minutes', checkout_automatico = true WHERE perfil_id = pg_temp.id('med3');
SELECT pg_temp.ok(pg_temp.aberta('med3'), 'C1: o check-out automático do fim não fecha a tolerância');
ROLLBACK;
