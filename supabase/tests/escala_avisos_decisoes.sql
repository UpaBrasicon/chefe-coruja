-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000008_escala_avisos_decisoes.sql (bugs médios
-- M5 e M6 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_avisos_decisoes.sql
--
-- Decisão do gestor sobre candidatura, falta e saída do fixo:
--  * quem pediu recebe aviso no sino (M5; as telas prometem o aviso);
--  * a decisão fica no histórico da escala e no log de auditoria (M6);
--  * vale pelas RPCs e pelo update direto que a tela do gestor faz;
--  * aprovada uma candidatura, as outras da vaga recusadas também avisam.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c901'),
  ('uni',   '00000000-0000-4000-8000-00000000c90a'),
  ('setor', '00000000-0000-4000-8000-00000000c9a1'),
  ('gest',  '00000000-0000-4000-8000-00000000c911'),
  ('med',   '00000000-0000-4000-8000-00000000c912'),
  ('med2',  '00000000-0000-4000-8000-00000000c913'),
  ('enf',   '00000000-0000-4000-8000-00000000c914'),
  ('pE',    '00000000-0000-4000-8000-00000000c921'),
  ('pE2',   '00000000-0000-4000-8000-00000000c922'),
  ('v1',    '00000000-0000-4000-8000-00000000c931'),
  ('v2',    '00000000-0000-4000-8000-00000000c932');
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
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
-- lidos como postgres
CREATE FUNCTION pg_temp.aviso(quem text, p_tipo text, p_texto text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.notificacoes_plantonista
                  WHERE perfil_id = pg_temp.id(quem) AND tipo LIKE p_tipo || '%' AND mensagem ILIKE '%' || p_texto || '%') $$;
CREATE FUNCTION pg_temp.hist(p_acao text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.historico_escala WHERE unidade_id = pg_temp.id('uni') AND acao = p_acao $$;
CREATE FUNCTION pg_temp.audit(p_entidade text, p_acao text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.log_auditoria WHERE unidade_id = pg_temp.id('uni') AND entidade = p_entidade AND acao = p_acao $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.ok(boolean, text),
  pg_temp.aviso(text, text, text), pg_temp.hist(text), pg_temp.audit(text, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@avisos-decisoes.local' FROM ids WHERE nome IN ('gest', 'med', 'med2', 'enf');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2', 'enf')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org dos avisos');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA dos avisos', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('enf'),  pg_temp.id('uni'), 'enfermeiro');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pE'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf'), private.data_atual() + 2, 'noite'),
  (pg_temp.id('pE2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf'), private.data_atual() + 5, 'noite');
INSERT INTO public.escala_vagas (id, unidade_id, setor_id, data, turno, aberta_por, papel) VALUES
  (pg_temp.id('v1'), pg_temp.id('uni'), pg_temp.id('setor'), private.data_atual() + 3, 'manha', pg_temp.id('gest'), 'plantonista'),
  (pg_temp.id('v2'), pg_temp.id('uni'), pg_temp.id('setor'), private.data_atual() + 4, 'tarde', pg_temp.id('gest'), 'plantonista');

SET LOCAL ROLE authenticated;

-- ── 1. candidatura aprovada pela RPC; a outra da vaga é recusada ──────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 'c1', public.candidatar_vaga(pg_temp.id('v1'))::text;
INSERT INTO t SELECT 'c3', public.candidatar_vaga(pg_temp.id('v2'))::text;
SELECT pg_temp.como('med2');
INSERT INTO t SELECT 'c2', public.candidatar_vaga(pg_temp.id('v1'))::text;
SELECT pg_temp.como('gest');
SELECT public.aprovar_candidatura(pg_temp.id('c1'));
SELECT pg_temp.ok(pg_temp.aviso('med', 'candidatura_decidida', 'aprovada'), 'M5: a candidatura aprovada avisa o candidato');
SELECT pg_temp.ok(pg_temp.aviso('med2', 'candidatura_decidida', 'recusada'), 'M5: a outra candidatura da vaga, recusada, também avisa');
SELECT pg_temp.ok(pg_temp.hist('candidatura_aprovada') = 1 AND pg_temp.hist('candidatura_recusada') = 1,
  'M6: aprovação e recusa da candidatura no histórico da escala');
SELECT pg_temp.ok(pg_temp.audit('candidaturas_escala', 'candidatura_aprovada') = 1, 'M6: a aprovação no log de auditoria');

-- ── 2. candidatura recusada pela tela (update direto) ─────────────────────
UPDATE public.candidaturas_escala SET status = 'recusado', decidido_por = pg_temp.id('gest') WHERE id = pg_temp.id('c3');
SELECT pg_temp.ok(pg_temp.aviso('med', 'candidatura_decidida', 'recusada') AND pg_temp.hist('candidatura_recusada') = 2
                  AND pg_temp.audit('candidaturas_escala', 'candidatura_recusada') = 2,
  'M5/M6: a recusa pela tela avisa, entra no histórico e na auditoria');

-- ── 3. falta e saída do fixo decididas pela tela ──────────────────────────
SELECT pg_temp.como('enf');
WITH x AS (
  INSERT INTO public.solicitacoes_escala (unidade_id, escala_plantao_id, perfil_id, tipo, tipo_falta, justificativa, criado_por)
  VALUES (pg_temp.id('uni'), pg_temp.id('pE'), pg_temp.id('enf'), 'justificar_falta', 'atestado_medico', 'atestado', pg_temp.id('enf'))
  RETURNING id) INSERT INTO t SELECT 'sF', id::text FROM x;
WITH x AS (
  INSERT INTO public.solicitacoes_escala (unidade_id, escala_plantao_id, perfil_id, tipo, justificativa, criado_por)
  VALUES (pg_temp.id('uni'), pg_temp.id('pE2'), pg_temp.id('enf'), 'sair_fixo', 'mudança', pg_temp.id('enf'))
  RETURNING id) INSERT INTO t SELECT 'sX', id::text FROM x;
SELECT pg_temp.como('gest');
UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = pg_temp.id('gest') WHERE id = pg_temp.id('sF');
UPDATE public.solicitacoes_escala SET status = 'recusado', decidido_por = pg_temp.id('gest') WHERE id = pg_temp.id('sX');
SELECT pg_temp.ok(pg_temp.aviso('enf', 'pedido_decidido', 'falta') AND pg_temp.aviso('enf', 'pedido_decidido', 'saída do fixo'),
  'M5: falta e saída do fixo decididas avisam quem pediu');
SELECT pg_temp.ok(pg_temp.hist('falta_aprovada') = 1 AND pg_temp.hist('sair_fixo_recusado') = 1,
  'M6: as decisões de falta e de saída do fixo no histórico da escala');
SELECT pg_temp.ok(pg_temp.audit('solicitacoes_escala', 'justificar_falta_aprovado') = 1 AND pg_temp.audit('solicitacoes_escala', 'sair_fixo_recusado') = 1,
  'M6: as decisões no log de auditoria');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
