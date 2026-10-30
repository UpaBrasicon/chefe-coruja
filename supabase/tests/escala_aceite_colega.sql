-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000006_escala_aceite_colega.sql (bug alto A4 do
-- teste ponta a ponta da escala e o aceite do colega na troca; proposta A do RT
-- em 30/10/2026: o colega aceita, depois o gestor aprova)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_aceite_colega.sql
--
-- Passagem e troca:
--  * o pedido nasce esperando o colega, que é avisado e o vê em pedidos_para_mim;
--  * o gestor não aprova antes do aceite, nem marca o aceite por update;
--  * aceito, o gestor aprova e o plantão muda de dono; os dois são avisados;
--  * o colega recusa; quem pediu cancela; quem não é o colega não aceita;
--  * na unidade sem aprovação do gestor, o aceite do colega já aplica.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c701'),
  ('uni',   '00000000-0000-4000-8000-00000000c70a'),
  ('uni2',  '00000000-0000-4000-8000-00000000c70b'),
  ('setor', '00000000-0000-4000-8000-00000000c7a1'),
  ('set2',  '00000000-0000-4000-8000-00000000c7a2'),
  ('gest',  '00000000-0000-4000-8000-00000000c711'),
  ('med',   '00000000-0000-4000-8000-00000000c712'),
  ('med2',  '00000000-0000-4000-8000-00000000c713'),
  ('med3',  '00000000-0000-4000-8000-00000000c714'),
  ('p1',    '00000000-0000-4000-8000-00000000c721'),
  ('p2',    '00000000-0000-4000-8000-00000000c722'),
  ('p3',    '00000000-0000-4000-8000-00000000c723'),
  ('pT1',   '00000000-0000-4000-8000-00000000c724'),
  ('pT2',   '00000000-0000-4000-8000-00000000c725'),
  ('pT3',   '00000000-0000-4000-8000-00000000c726'),
  ('q1',    '00000000-0000-4000-8000-00000000c727'),
  ('q2',    '00000000-0000-4000-8000-00000000c728'),
  ('q3',    '00000000-0000-4000-8000-00000000c729');
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
-- lidos como postgres: dono do plantão e avisos de uma pessoa
CREATE FUNCTION pg_temp.dono(p text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id(p) $$;
CREATE FUNCTION pg_temp.avisos(quem text, p_tipo text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id(quem) AND tipo LIKE p_tipo || '%' $$;
CREATE FUNCTION pg_temp.status_s(p text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status FROM public.solicitacoes_escala WHERE id = pg_temp.id(p) $$;
CREATE FUNCTION pg_temp.status_t(p text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text),
  pg_temp.dono(text), pg_temp.avisos(text, text), pg_temp.status_s(text), pg_temp.status_t(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@aceite-colega.local' FROM ids WHERE nome IN ('gest', 'med', 'med2', 'med3');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2', 'med3')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do aceite');
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
  (pg_temp.id('med3'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med'),  pg_temp.id('uni2'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni2'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('p1'),  pg_temp.id('uni'),  pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 2, 'manha'),
  (pg_temp.id('p2'),  pg_temp.id('uni'),  pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 3, 'manha'),
  (pg_temp.id('p3'),  pg_temp.id('uni'),  pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 4, 'manha'),
  (pg_temp.id('pT1'), pg_temp.id('uni'),  pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 5, 'tarde'),
  (pg_temp.id('pT2'), pg_temp.id('uni'),  pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 6, 'tarde'),
  (pg_temp.id('pT3'), pg_temp.id('uni'),  pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 7, 'tarde'),
  (pg_temp.id('q1'),  pg_temp.id('uni2'), pg_temp.id('set2'),  pg_temp.id('med'),  private.data_atual() + 2, 'noite'),
  (pg_temp.id('q2'),  pg_temp.id('uni2'), pg_temp.id('set2'),  pg_temp.id('med'),  private.data_atual() + 3, 'noite'),
  (pg_temp.id('q3'),  pg_temp.id('uni2'), pg_temp.id('set2'),  pg_temp.id('med2'), private.data_atual() + 4, 'noite');
DELETE FROM public.configuracoes_unidade WHERE unidade_id IN (pg_temp.id('uni'), pg_temp.id('uni2')) AND chave = 'escala_passagem_exige_aprovacao';
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor) VALUES (pg_temp.id('uni2'), 'escala_passagem_exige_aprovacao', 'false');

SET LOCAL ROLE authenticated;

-- ── 1. passagem: o colega aceita, depois o gestor ─────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 's1', public.passar_plantao(pg_temp.id('p1'), pg_temp.id('med2'), 'consulta')::text;
SELECT pg_temp.ok(pg_temp.status_s('s1') = 'pendente' AND pg_temp.dono('p1') = pg_temp.id('med') AND pg_temp.avisos('med2', 'passagem_pedida') = 1,
  'A4: a passagem nasce esperando o colega, que é avisado');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok((SELECT count(*) FROM public.pedidos_para_mim(pg_temp.id('uni')) WHERE id = pg_temp.id('s1') AND tipo = 'passagem' AND de_nome = 'med') = 1,
  'A4: o colega vê o pedido em pedidos_para_mim, com quem pediu');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha(format($q$UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = %L WHERE id = %L$q$, pg_temp.id('gest'), pg_temp.id('s1')),
  'O colega ainda não aceitou a passagem', 'A4: o gestor não aprova antes do aceite');
SELECT pg_temp.falha(format($q$UPDATE public.solicitacoes_escala SET aceito_em = now() WHERE id = %L$q$, pg_temp.id('s1')),
  'permission denied', 'A4: o gestor não marca o aceite por update');
SELECT pg_temp.como('med3');
SELECT pg_temp.falha(format('SELECT public.aceitar_passagem(%L)', pg_temp.id('s1')), 'Acesso negado', 'A4: quem não é o colega não aceita');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(public.aceitar_passagem(pg_temp.id('s1')) = 'aceita' AND pg_temp.avisos('med', 'passagem_aceita') = 1 AND pg_temp.avisos('gest', 'passagem_aceita') = 1,
  'A4: o colega aceita; quem pediu e o gestor são avisados');
SELECT pg_temp.como('gest');
UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = pg_temp.id('gest') WHERE id = pg_temp.id('s1');
SELECT pg_temp.ok(pg_temp.dono('p1') = pg_temp.id('med2') AND pg_temp.avisos('med', 'passagem_decidida') = 1 AND pg_temp.avisos('med2', 'passagem_decidida') = 1,
  'A4: aceito, o gestor aprova; o plantão muda de dono e os dois são avisados');

-- ── 2. o colega recusa; quem pediu cancela ────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 's2', public.passar_plantao(pg_temp.id('p2'), pg_temp.id('med2'), NULL)::text;
INSERT INTO t SELECT 's3', public.passar_plantao(pg_temp.id('p3'), pg_temp.id('med2'), NULL)::text;
SELECT pg_temp.como('med2');
SELECT public.recusar_passagem(pg_temp.id('s2'), 'não posso');
SELECT pg_temp.ok(pg_temp.status_s('s2') = 'recusado' AND pg_temp.dono('p2') = pg_temp.id('med') AND pg_temp.avisos('med', 'passagem_decidida') >= 1,
  'A4: o colega recusa; o plantão fica e quem pediu é avisado');
SELECT pg_temp.como('med');
SELECT public.cancelar_pedido_escala(pg_temp.id('s3'));
SELECT pg_temp.ok(pg_temp.status_s('s3') = 'cancelado', 'A4: quem pediu cancela a passagem pendente');
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(format('SELECT public.aceitar_passagem(%L)', pg_temp.id('s3')), 'O pedido não está mais pendente', 'A4: passagem cancelada não se aceita');

-- ── 3. troca: o colega aceita, depois o gestor ────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't1', public.solicitar_troca(pg_temp.id('pT1'), pg_temp.id('pT2'), NULL)::text;
SELECT pg_temp.ok(pg_temp.status_t('t1') = 'pendente' AND pg_temp.avisos('med2', 'troca_pedida') = 1, 'troca nasce esperando o colega, que é avisado');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('t1')), 'O colega ainda não aceitou a troca', 'o gestor não aprova a troca antes do aceite');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok((SELECT count(*) FROM public.pedidos_para_mim(pg_temp.id('uni')) WHERE id = pg_temp.id('t1') AND tipo = 'troca') = 1, 'o colega vê a troca em pedidos_para_mim');
SELECT pg_temp.ok(public.aceitar_troca(pg_temp.id('t1')) = 'aceita' AND pg_temp.avisos('gest', 'troca_aceita') = 1, 'o colega aceita a troca; o gestor é avisado');
SELECT pg_temp.como('gest');
SELECT public.aprovar_troca(pg_temp.id('t1'));
SELECT pg_temp.ok(pg_temp.dono('pT1') = pg_temp.id('med2') AND pg_temp.dono('pT2') = pg_temp.id('med') AND pg_temp.avisos('med', 'troca_decidida') = 1,
  'aceita, o gestor aprova; os donos trocam e os dois são avisados');
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't2', public.solicitar_troca(pg_temp.id('pT3'), pg_temp.id('pT1'), NULL)::text;
SELECT public.cancelar_troca(pg_temp.id('t2'));
SELECT pg_temp.ok(pg_temp.status_t('t2') = 'cancelada', 'quem pediu cancela a troca pendente');

-- ── 4. unidade sem aprovação do gestor: o aceite aplica ───────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 's4', public.passar_plantao(pg_temp.id('q1'), pg_temp.id('med2'), NULL)::text;
SELECT pg_temp.ok(pg_temp.dono('q1') = pg_temp.id('med'), 'sem aprovação: a passagem também espera o colega');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(public.aceitar_passagem(pg_temp.id('s4')) = 'aplicada' AND pg_temp.dono('q1') = pg_temp.id('med2'),
  'sem aprovação: o aceite do colega aplica a passagem');
SELECT pg_temp.como('med');
INSERT INTO t SELECT 't3', public.solicitar_troca(pg_temp.id('q2'), pg_temp.id('q3'), NULL)::text;
SELECT pg_temp.ok(pg_temp.dono('q2') = pg_temp.id('med'), 'sem aprovação: a troca também espera o colega');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(public.aceitar_troca(pg_temp.id('t3')) = 'aplicada' AND pg_temp.dono('q2') = pg_temp.id('med2') AND pg_temp.dono('q3') = pg_temp.id('med'),
  'sem aprovação: o aceite do colega aplica a troca');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
