-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000009_escala_passagem_conferencia.sql (bug
-- médio M3 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_passagem_conferencia.sql
--
-- O pedido de passagem confere na hora de pedir:
--  * o destino com plantão no mesmo horário em outro setor (antes só o mesmo
--    setor e a mesma faixa);
--  * pedido repetido do mesmo plantão ainda pendente;
--  * plantão que já terminou;
--  * o pedido certo continua passando.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000ca01'),
  ('uni',   '00000000-0000-4000-8000-00000000ca0a'),
  ('ps',    '00000000-0000-4000-8000-00000000caa1'),
  ('sv',    '00000000-0000-4000-8000-00000000caa2'),
  ('med',   '00000000-0000-4000-8000-00000000ca12'),
  ('med2',  '00000000-0000-4000-8000-00000000ca13'),
  ('med3',  '00000000-0000-4000-8000-00000000ca14'),
  ('pPS',   '00000000-0000-4000-8000-00000000ca21'),
  ('pSV',   '00000000-0000-4000-8000-00000000ca22'),
  ('pOk',   '00000000-0000-4000-8000-00000000ca23'),
  ('pVelho','00000000-0000-4000-8000-00000000ca24');
GRANT SELECT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok); RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@passagem-conferencia.local' FROM ids WHERE nome IN ('med', 'med2', 'med3');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('med', 'med2', 'med3')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da conferência');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da conferência', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('ps'), pg_temp.id('uni'), 'Pronto Socorro', 'outro'),
  (pg_temp.id('sv'), pg_temp.id('uni'), 'Sala Vermelha', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med3'), pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pPS'),   pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'),  private.data_atual() + 3, 'manha'),
  (pg_temp.id('pSV'),   pg_temp.id('uni'), pg_temp.id('sv'), pg_temp.id('med2'), private.data_atual() + 3, 'manha'),
  (pg_temp.id('pOk'),   pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'),  private.data_atual() + 4, 'tarde'),
  (pg_temp.id('pVelho'),pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'),  private.data_atual() - 2, 'manha');
DELETE FROM public.configuracoes_unidade WHERE unidade_id = pg_temp.id('uni') AND chave = 'escala_passagem_exige_aprovacao';

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');

-- ── 1. destino escalado no mesmo horário em outro setor ───────────────────
SELECT pg_temp.falha(format('SELECT public.passar_plantao(%L, %L, NULL)', pg_temp.id('pPS'), pg_temp.id('med2')),
  'Conflito de horário', 'M3: o destino escalado na Sala Vermelha no mesmo horário não recebe a passagem');

-- ── 2. pedido repetido ─────────────────────────────────────────────────────
SELECT pg_temp.ok(public.passar_plantao(pg_temp.id('pOk'), pg_temp.id('med3'), NULL) IS NOT NULL, 'o pedido certo continua passando');
SELECT pg_temp.falha(format('SELECT public.passar_plantao(%L, %L, NULL)', pg_temp.id('pOk'), pg_temp.id('med2')),
  'Já existe um pedido de passagem pendente', 'M3: segundo pedido do mesmo plantão, com o primeiro pendente, é barrado');

-- ── 3. plantão que já terminou ─────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.passar_plantao(%L, %L, NULL)', pg_temp.id('pVelho'), pg_temp.id('med3')),
  'O plantão já terminou', 'M3: plantão que já terminou não se passa');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
