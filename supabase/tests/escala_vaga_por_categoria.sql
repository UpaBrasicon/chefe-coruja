-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000003_escala_vaga_por_categoria.sql (bug alto A1
-- do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_vaga_por_categoria.sql
--
-- O gestor abre vaga de várias categorias na mesma faixa:
--  * médico, enfermeiro e técnico no PS de manhã: três vagas (A1);
--  * marcar de novo a mesma categoria devolve a vaga que já existe;
--  * a vaga sem categoria continua uma por faixa;
--  * duas vagas abertas da mesma categoria na mesma faixa continuam barradas
--    pelo índice, também fora da RPC.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c301'),
  ('uni',   '00000000-0000-4000-8000-00000000c30a'),
  ('setor', '00000000-0000-4000-8000-00000000c3a1'),
  ('gest',  '00000000-0000-4000-8000-00000000c311');
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
-- marca a vaga e guarda o id; o erro sai como texto, para o teste dizer qual foi
CREATE FUNCTION pg_temp.marca(p_chave text, p_papel public.papel) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
  v := public.marcar_vaga_escala(pg_temp.id('setor'), private.data_atual() + 3, 'manha', NULL, p_papel);
  INSERT INTO t VALUES (p_chave, v::text);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text), pg_temp.marca(text, public.papel) TO authenticated;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('gest'), 'gest@vaga-categoria.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('gest'), 'gest')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org das vagas');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA das vagas', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');

-- ── 1. A1: três categorias na mesma faixa ─────────────────────────────────
SELECT pg_temp.ok(pg_temp.marca('vMed', 'plantonista') = 'ok', 'vaga de plantonista no PS de manhã');
SELECT pg_temp.ok(pg_temp.marca('vEnf', 'enfermeiro') = 'ok', 'A1: vaga de enfermeiro na mesma faixa');
SELECT pg_temp.ok(pg_temp.marca('vTec', 'tecnico_enfermagem') = 'ok', 'A1: vaga de técnico na mesma faixa');
SELECT pg_temp.ok((SELECT count(DISTINCT v) FROM t WHERE k IN ('vMed', 'vEnf', 'vTec')) = 3, 'A1: são três vagas diferentes');

-- ── 2. a mesma categoria não duplica ───────────────────────────────────────
SELECT pg_temp.ok(pg_temp.marca('vEnf2', 'enfermeiro') = 'ok' AND pg_temp.id('vEnf2') = pg_temp.id('vEnf'),
  'marcar de novo a vaga de enfermeiro devolve a mesma');
SELECT pg_temp.ok(pg_temp.marca('vSem', NULL) = 'ok', 'vaga sem categoria na mesma faixa');
SELECT pg_temp.ok(pg_temp.marca('vSem2', NULL) = 'ok' AND pg_temp.id('vSem2') = pg_temp.id('vSem'),
  'a vaga sem categoria continua uma por faixa');

-- ── 3. o índice barra a duplicata também fora da RPC ──────────────────────
RESET ROLE;
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, aberta_por, papel)
  VALUES (%L, %L, private.data_atual() + 3, 'manha', %L, 'enfermeiro')$q$, pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('gest')),
  'duplicate key value violates unique constraint', 'duas vagas abertas de enfermeiro na mesma faixa: barrado');
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, aberta_por, papel)
  VALUES (%L, %L, private.data_atual() + 3, 'manha', %L, NULL)$q$, pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('gest')),
  'duplicate key value violates unique constraint', 'duas vagas abertas sem categoria na mesma faixa: barrado');
-- fechada a vaga, a categoria pode abrir de novo
UPDATE public.escala_vagas SET fechada_em = now() WHERE id = pg_temp.id('vEnf');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(pg_temp.marca('vEnf3', 'enfermeiro') = 'ok' AND pg_temp.id('vEnf3') <> pg_temp.id('vEnf'),
  'fechada a vaga de enfermeiro, abre outra');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
