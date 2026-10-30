-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000001_escala_troca_forcada.sql (bug crítico C1
-- do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_troca_forcada.sql
--
-- A troca só nasce e só muda pelas RPCs:
--  * gravar a troca direto na tabela é negado, até a honesta (C1);
--  * quem recebe não reescreve a troca por update direto;
--  * a troca forjada (gravada fora da RPC) não se aplica nem com aprovar_troca:
--    os donos gravados têm de ser os donos reais dos dois plantões;
--  * o fluxo certo continua: pedir pela RPC, o gestor aprova, os donos trocam.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c101'),
  ('uni',   '00000000-0000-4000-8000-00000000c10a'),
  ('setor', '00000000-0000-4000-8000-00000000c1a1'),
  ('gest',  '00000000-0000-4000-8000-00000000c111'),
  ('med',   '00000000-0000-4000-8000-00000000c112'),
  ('med2',  '00000000-0000-4000-8000-00000000c113'),
  ('med3',  '00000000-0000-4000-8000-00000000c114'),
  ('pMed',  '00000000-0000-4000-8000-00000000c121'),
  ('pMed2', '00000000-0000-4000-8000-00000000c122'),
  ('pOut',  '00000000-0000-4000-8000-00000000c123');
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
SELECT id, nome || '@troca-forcada.local' FROM ids WHERE nome IN ('gest', 'med', 'med2', 'med3');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2', 'med3')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da troca');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da troca', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med3'), pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pMed'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 2, 'noite'),
  (pg_temp.id('pMed2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 3, 'manha'),
  (pg_temp.id('pOut'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 4, 'tarde');
-- sem a chave, a unidade exige aprovação (default seguro)
DELETE FROM public.configuracoes_unidade WHERE unidade_id = pg_temp.id('uni') AND chave = 'escala_passagem_exige_aprovacao';

SET LOCAL ROLE authenticated;

-- ── 1. C1: gravar a troca direto na tabela ─────────────────────────────────
SELECT pg_temp.como('med');
-- o ataque do relatório: o plantão do colega como A, ele mesmo como B
SELECT pg_temp.falha(format(
  'INSERT INTO public.trocas_plantao (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, criado_por) VALUES (%L, %L, %L, %L, %L, %L)',
  pg_temp.id('uni'), pg_temp.id('pMed2'), pg_temp.id('med'), pg_temp.id('pMed'), pg_temp.id('med'), pg_temp.id('med')),
  'permission denied', 'C1: o escalado não grava a troca forçada direto na tabela');
-- até a troca honesta só nasce pela RPC (que confere os donos)
SELECT pg_temp.falha(format(
  'INSERT INTO public.trocas_plantao (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, criado_por) VALUES (%L, %L, %L, %L, %L, %L)',
  pg_temp.id('uni'), pg_temp.id('pMed'), pg_temp.id('med'), pg_temp.id('pMed2'), pg_temp.id('med2'), pg_temp.id('med')),
  'permission denied', 'C1: nem a troca honesta se grava fora da RPC');

-- ── 2. a troca forjada não se aplica ───────────────────────────────────────
RESET ROLE;
WITH x AS (
  INSERT INTO public.trocas_plantao (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, criado_por)
  VALUES (pg_temp.id('uni'), pg_temp.id('pMed2'), pg_temp.id('med'), pg_temp.id('pMed'), pg_temp.id('med'), pg_temp.id('med'))
  RETURNING id)
INSERT INTO t SELECT 'forjada', id::text FROM x;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
-- desde a 20270208000005 (A2), o colega nem aprova: para no "só o gestor"
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('forjada')),
  'Só o gestor da unidade aprova a troca', 'C1: troca gravada fora da RPC (dono falso) não se aplica com aprovar_troca');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('forjada')),
  'A troca não confere com a escala', 'C1: nem o gestor aplica a troca com dono falso');
SELECT pg_temp.ok(pg_temp.dono('pMed2') = pg_temp.id('med2') AND pg_temp.dono('pMed') = pg_temp.id('med'),
  'C1: os plantões continuam com os donos de antes');

-- ── 3. o fluxo certo continua ──────────────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO t SELECT 'troca', public.solicitar_troca(pg_temp.id('pMed'), pg_temp.id('pMed2'), 'consulta')::text;
SELECT pg_temp.ok((SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id('troca')) = 'pendente',
  'pedir a troca pela RPC continua valendo (pendente)');
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('troca')),
  'Só o gestor da unidade aprova a troca', 'quem pediu não aprova a própria troca');

-- quem recebe não reescreve a troca (apontar outro plantão, reabrir)
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(format('UPDATE public.trocas_plantao SET plantao_a_id = %L WHERE id = %L', pg_temp.id('pOut'), pg_temp.id('troca')),
  'permission denied', 'quem recebe não troca o plantão da troca por update direto');
SELECT pg_temp.falha(format('UPDATE public.trocas_plantao SET status = %L WHERE id = %L', 'aprovado', pg_temp.id('troca')),
  'permission denied', 'quem recebe não aprova por update direto (sem aplicar)');

SELECT pg_temp.como('gest');
SELECT public.aprovar_troca(pg_temp.id('troca'));
SELECT pg_temp.ok(pg_temp.dono('pMed') = pg_temp.id('med2') AND pg_temp.dono('pMed2') = pg_temp.id('med'),
  'o gestor aprova a troca pedida pela RPC e os donos trocam');

-- ── 4. o plantão mudou de dono depois do pedido: a troca não se aplica ────
SELECT pg_temp.como('med2');
INSERT INTO t SELECT 'troca2', public.solicitar_troca(pg_temp.id('pOut'), pg_temp.id('pMed2'), NULL)::text;
RESET ROLE;
UPDATE public.escala_plantao SET perfil_id = pg_temp.id('med3') WHERE id = pg_temp.id('pOut');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('troca2')),
  'A troca não confere com a escala', 'plantão que mudou de dono depois do pedido não é trocado');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
