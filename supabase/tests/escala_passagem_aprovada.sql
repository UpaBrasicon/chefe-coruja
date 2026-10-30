-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000002_escala_passagem_aprovada.sql (bug crítico
-- C2 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_passagem_aprovada.sql
--
-- Passagem aprovada pelo gestor muda o plantão de dono:
--  * o gestor aprova como a tela faz (update de status) e o plantão vai para o
--    destino, com histórico (C2);
--  * destino com plantão no mesmo horário: a aprovação é recusada e o pedido
--    continua pendente, com o plantão com quem pediu;
--  * plantão que mudou de dono depois do pedido não é passado;
--  * recusar não mexe no plantão.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c201'),
  ('uni',   '00000000-0000-4000-8000-00000000c20a'),
  ('setor', '00000000-0000-4000-8000-00000000c2a1'),
  ('gest',  '00000000-0000-4000-8000-00000000c211'),
  ('med',   '00000000-0000-4000-8000-00000000c212'),
  ('med2',  '00000000-0000-4000-8000-00000000c213'),
  ('med3',  '00000000-0000-4000-8000-00000000c214'),
  ('pP',    '00000000-0000-4000-8000-00000000c221'),
  ('pQ',    '00000000-0000-4000-8000-00000000c222'),
  ('pX',    '00000000-0000-4000-8000-00000000c223'),
  ('pR',    '00000000-0000-4000-8000-00000000c224'),
  ('pS',    '00000000-0000-4000-8000-00000000c225');
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
-- dono do plantão, lido como postgres (a RLS da escala não mostra o do colega)
CREATE FUNCTION pg_temp.dono(p text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text), pg_temp.dono(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@passagem-aprovada.local' FROM ids WHERE nome IN ('gest', 'med', 'med2', 'med3');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2', 'med3')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da passagem');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da passagem', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med3'), pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pP'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 2, 'manha'),
  (pg_temp.id('pQ'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 5, 'tarde'),
  (pg_temp.id('pX'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med3'), private.data_atual() + 5, 'tarde'),
  (pg_temp.id('pR'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 6, 'noite'),
  (pg_temp.id('pS'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 8, 'manha');
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_sem_sobreposicao;
-- sem a chave, a unidade exige aprovação (default seguro)
DELETE FROM public.configuracoes_unidade WHERE unidade_id = pg_temp.id('uni') AND chave = 'escala_passagem_exige_aprovacao';

SET LOCAL ROLE authenticated;

-- ── 1. C2: o gestor aprova e o plantão muda de dono ────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 'sP', public.passar_plantao(pg_temp.id('pP'), pg_temp.id('med2'), 'consulta')::text;
SELECT pg_temp.ok(pg_temp.id('sP') <> pg_temp.id('pP') AND pg_temp.dono('pP') = pg_temp.id('med'),
  'pedir a passagem cria o pedido e o plantão fica com quem pediu');
-- o colega aceita antes (20270208000006, A4)
SELECT pg_temp.como('med2');
SELECT public.aceitar_passagem(pg_temp.id('sP'));
SELECT pg_temp.como('gest');
-- o que a tela do gestor faz (Escala.tsx, mutação decidir)
UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = pg_temp.id('gest') WHERE id = pg_temp.id('sP');
SELECT pg_temp.ok(pg_temp.dono('pP') = pg_temp.id('med2'),
  'C2: aprovada a passagem, o plantão passa para o destino');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.historico_escala WHERE plantao_id = pg_temp.id('pP') AND acao = 'passagem_aplicada'),
  'C2: a passagem aplicada fica no histórico da escala');
SET LOCAL ROLE authenticated;

-- ── 2. destino com plantão no mesmo horário: não aprova ────────────────────
SELECT pg_temp.como('med');
RESET ROLE;
-- o pedido nasce antes de o destino ter o plantão (passar_plantao já barra o conflito)
UPDATE public.escala_plantao SET ativo = false WHERE id = pg_temp.id('pX');
SET LOCAL ROLE authenticated;
INSERT INTO t SELECT 'sQ', public.passar_plantao(pg_temp.id('pQ'), pg_temp.id('med3'), NULL)::text;
SELECT pg_temp.como('med3');
SELECT public.aceitar_passagem(pg_temp.id('sQ'));
RESET ROLE;
UPDATE public.escala_plantao SET ativo = true WHERE id = pg_temp.id('pX');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
SELECT pg_temp.falha(format($q$UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = %L WHERE id = %L$q$, pg_temp.id('gest'), pg_temp.id('sQ')),
  'Conflito de horário', 'destino com plantão no mesmo horário: a aprovação é recusada');
SELECT pg_temp.ok((SELECT status FROM public.solicitacoes_escala WHERE id = pg_temp.id('sQ')) = 'pendente' AND pg_temp.dono('pQ') = pg_temp.id('med'),
  'o pedido continua pendente e o plantão com quem pediu');

-- ── 3. o plantão mudou de dono depois do pedido ───────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 'sR', public.passar_plantao(pg_temp.id('pR'), pg_temp.id('med2'), NULL)::text;
SELECT pg_temp.como('med2');
SELECT public.aceitar_passagem(pg_temp.id('sR'));
RESET ROLE;
UPDATE public.escala_plantao SET perfil_id = pg_temp.id('med3') WHERE id = pg_temp.id('pR');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
SELECT pg_temp.falha(format($q$UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = %L WHERE id = %L$q$, pg_temp.id('gest'), pg_temp.id('sR')),
  'A passagem não confere com a escala', 'plantão que mudou de dono depois do pedido não é passado');
SELECT pg_temp.ok(pg_temp.dono('pR') = pg_temp.id('med3'), 'o plantão continua com o dono de agora');

-- ── 4. recusar não mexe no plantão ─────────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 'sS', public.passar_plantao(pg_temp.id('pS'), pg_temp.id('med2'), NULL)::text;
SELECT pg_temp.como('gest');
UPDATE public.solicitacoes_escala SET status = 'recusado', decidido_por = pg_temp.id('gest') WHERE id = pg_temp.id('sS');
SELECT pg_temp.ok(pg_temp.dono('pS') = pg_temp.id('med'), 'recusada a passagem, o plantão fica com quem pediu');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
