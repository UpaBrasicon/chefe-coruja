-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000005_escala_troca_gestor.sql (bugs altos A2 e
-- A3 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_troca_gestor.sql
--
-- A troca só entra na escala com o gestor (unidade que exige aprovação, o
-- padrão):
--  * o colega que recebe não aplica a troca (A2); o gestor aplica;
--  * quem recebe não reescreve a troca por update direto (A3, fechado pela
--    20270208000001; conferido aqui);
--  * o colega ainda recusa;
--  * na unidade sem aprovação, a troca continua entrando na hora.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c601'),
  ('uni',   '00000000-0000-4000-8000-00000000c60a'),
  ('uni2',  '00000000-0000-4000-8000-00000000c60b'),
  ('setor', '00000000-0000-4000-8000-00000000c6a1'),
  ('set2',  '00000000-0000-4000-8000-00000000c6a2'),
  ('gest',  '00000000-0000-4000-8000-00000000c611'),
  ('med',   '00000000-0000-4000-8000-00000000c612'),
  ('med2',  '00000000-0000-4000-8000-00000000c613'),
  ('p1',    '00000000-0000-4000-8000-00000000c621'),
  ('p2',    '00000000-0000-4000-8000-00000000c622'),
  ('p3',    '00000000-0000-4000-8000-00000000c623'),
  ('p4',    '00000000-0000-4000-8000-00000000c624'),
  ('q1',    '00000000-0000-4000-8000-00000000c625'),
  ('q2',    '00000000-0000-4000-8000-00000000c626');
GRANT SELECT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE TEMP TABLE t (k text PRIMARY KEY, v text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT coalesce((SELECT id FROM ids WHERE nome = p), (SELECT v::uuid FROM t WHERE k = p)) $$;
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
CREATE FUNCTION pg_temp.dono(p text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text), pg_temp.dono(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@troca-gestor.local' FROM ids WHERE nome IN ('gest', 'med', 'med2');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da troca do gestor');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'), pg_temp.id('org'), 'UPA com aprovação', 'hospital'),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA sem aprovação', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro'),
  (pg_temp.id('set2'), pg_temp.id('uni2'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med'),  pg_temp.id('uni2'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni2'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('p1'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 2, 'manha'),
  (pg_temp.id('p2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 3, 'tarde'),
  (pg_temp.id('p3'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 5, 'manha'),
  (pg_temp.id('p4'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 6, 'tarde'),
  (pg_temp.id('q1'), pg_temp.id('uni2'), pg_temp.id('set2'), pg_temp.id('med'),  private.data_atual() + 2, 'noite'),
  (pg_temp.id('q2'), pg_temp.id('uni2'), pg_temp.id('set2'), pg_temp.id('med2'), private.data_atual() + 4, 'noite');
DELETE FROM public.configuracoes_unidade WHERE unidade_id IN (pg_temp.id('uni'), pg_temp.id('uni2')) AND chave = 'escala_passagem_exige_aprovacao';
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor) VALUES (pg_temp.id('uni2'), 'escala_passagem_exige_aprovacao', 'false');

SET LOCAL ROLE authenticated;

-- ── 1. A2: o colega não aplica; o gestor aplica ───────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't1', public.solicitar_troca(pg_temp.id('p1'), pg_temp.id('p2'), 'consulta')::text;
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('t1')),
  'Só o gestor da unidade aprova a troca', 'A2: o colega que recebe não aplica a troca');
SELECT pg_temp.ok(pg_temp.dono('p1') = pg_temp.id('med') AND pg_temp.dono('p2') = pg_temp.id('med2')
                  AND (SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id('t1')) = 'pendente',
  'A2: a troca continua pendente e os plantões com os donos de antes');
-- o colega aceita (20270208000006, A4); quem aplica é o gestor
SELECT public.aceitar_troca(pg_temp.id('t1'));
SELECT pg_temp.como('gest');
SELECT public.aprovar_troca(pg_temp.id('t1'));
SELECT pg_temp.ok(pg_temp.dono('p1') = pg_temp.id('med2') AND pg_temp.dono('p2') = pg_temp.id('med'),
  'A2: o gestor aprova e os donos trocam');

-- ── 2. A3: quem recebe não reescreve a troca ──────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't2', public.solicitar_troca(pg_temp.id('p3'), pg_temp.id('p4'), NULL)::text;
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(format($q$UPDATE public.trocas_plantao SET status = 'pendente', plantao_a_id = %L WHERE id = %L$q$, pg_temp.id('p1'), pg_temp.id('t2')),
  'permission denied', 'A3: quem recebe não reescreve a troca por update direto');

-- ── 3. o colega ainda recusa ───────────────────────────────────────────────
SELECT public.recusar_troca(pg_temp.id('t2'), 'não posso');
SELECT pg_temp.ok((SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id('t2')) = 'recusado'
                  AND pg_temp.dono('p3') = pg_temp.id('med'), 'o colega recusa e nada muda na escala');

-- ── 4. unidade sem aprovação: entra com o aceite do colega (A4) ───────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't3', public.solicitar_troca(pg_temp.id('q1'), pg_temp.id('q2'), NULL)::text;
SELECT pg_temp.como('med2');
SELECT public.aceitar_troca(pg_temp.id('t3'));
SELECT pg_temp.ok(pg_temp.dono('q1') = pg_temp.id('med2') AND pg_temp.dono('q2') = pg_temp.id('med'),
  'unidade sem aprovação: a troca entra com o aceite do colega');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
