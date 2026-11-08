-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000002_troca_pedida_de_novo.sql (achado D P2-2
-- do teste da rede; decisão do RT em 08/11/2026: A em T1 e T2). Tudo em
-- transação com ROLLBACK. O cenário é criado aqui.
--
-- T1. Só o pedido pendente trava o par: depois de cancelar, ou da recusa do
--     colega, a mesma troca pode ser pedida de novo; o histórico guarda as
--     duas tentativas. A aprovação continua funcionando.
-- T2. Com um pedido pendente do par, outro pedido é recusado com mensagem
--     clara, nos dois sentidos (X↔Y e Y↔X).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a7b01'),
  ('uni',   '00000000-0000-4000-8000-0000000a7b02'),
  ('setor', '00000000-0000-4000-8000-0000000a7b11'),
  ('gest',  '00000000-0000-4000-8000-0000000a7b21'),
  ('med',   '00000000-0000-4000-8000-0000000a7b22'),
  ('med2',  '00000000-0000-4000-8000-0000000a7b23'),
  ('pX',    '00000000-0000-4000-8000-0000000a7b31'),
  ('pY',    '00000000-0000-4000-8000-0000000a7b32');
GRANT SELECT ON ids TO authenticated;
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
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.status_t(p text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id(p) $$;
CREATE FUNCTION pg_temp.dono(p text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id(p) $$;
CREATE FUNCTION pg_temp.tentativas() RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.trocas_plantao WHERE plantao_a_id IN (pg_temp.id('pX'), pg_temp.id('pY')) $$;
CREATE FUNCTION pg_temp.pedir_sql(a text, b text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id(a), pg_temp.id(b)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text),
  pg_temp.status_t(text), pg_temp.dono(text), pg_temp.tentativas(), pg_temp.pedir_sql(text, text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@troca-de-novo.local' FROM ids WHERE nome IN ('gest', 'med', 'med2');
INSERT INTO public.perfis (id, nome_completo) SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da troca de novo');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da troca de novo', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pX'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 3, 'manha'),
  (pg_temp.id('pY'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 4, 'manha');

SET LOCAL ROLE authenticated;

-- ── T1: pedir, cancelar, pedir de novo ──────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't1', public.solicitar_troca(pg_temp.id('pX'), pg_temp.id('pY'), NULL)::text;
-- T2: pendente trava o par nos dois sentidos
SELECT pg_temp.falha(pg_temp.pedir_sql('pX', 'pY'), 'Já há um pedido de troca pendente para estes plantões', 'T2: o mesmo pedido pendente não se repete');
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(pg_temp.pedir_sql('pY', 'pX'), 'Já há um pedido de troca pendente para estes plantões', 'T2: nem no sentido inverso');
SELECT pg_temp.como('med');
SELECT public.cancelar_troca(pg_temp.id('t1'));
INSERT INTO t SELECT 't2', public.solicitar_troca(pg_temp.id('pX'), pg_temp.id('pY'), NULL)::text;
SELECT pg_temp.ok(pg_temp.status_t('t1') = 'cancelada' AND pg_temp.status_t('t2') = 'pendente' AND pg_temp.tentativas() = 2,
  'T1: depois de cancelar, a mesma troca é pedida de novo; as duas tentativas ficam no histórico');

-- ── T1: recusa e novo pedido; depois a aprovação ────────────────────────────
SELECT pg_temp.como('med2');
SELECT public.recusar_troca(pg_temp.id('t2'), 'não posso nesse dia');
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't3', public.solicitar_troca(pg_temp.id('pX'), pg_temp.id('pY'), NULL)::text;
SELECT pg_temp.ok(pg_temp.status_t('t2') = 'recusado' AND pg_temp.status_t('t3') = 'pendente' AND pg_temp.tentativas() = 3,
  'T1: depois da recusa, a mesma troca é pedida de novo');
SELECT pg_temp.como('med2');
SELECT public.aceitar_troca(pg_temp.id('t3'));
SELECT pg_temp.como('gest');
SELECT public.aprovar_troca(pg_temp.id('t3'));
SELECT pg_temp.ok(pg_temp.status_t('t3') = 'aprovado' AND pg_temp.dono('pX') = pg_temp.id('med2') AND pg_temp.dono('pY') = pg_temp.id('med'),
  'a aprovação continua: os plantões trocam de dono');

-- ── T1: depois da aprovada, a troca de volta pode ser pedida ────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't4', public.solicitar_troca(pg_temp.id('pY'), pg_temp.id('pX'), NULL)::text;
SELECT pg_temp.ok(pg_temp.status_t('t4') = 'pendente', 'T1: a troca de volta pode ser pedida depois da aprovada');
ROLLBACK;
