-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000015_escala_dia_passado_retroativo.sql (bug
-- baixo B3 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md;
-- decisão do RT em 31/10/2026: "Aceita como retroativo")
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_dia_passado_retroativo.sql
--
-- Escalar em dia que já passou continua valendo, só pelo gestor, e o
-- histórico da escala marca "retroativo". O plantão futuro não é marcado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000d001'),
  ('uni',    '00000000-0000-4000-8000-00000000d00a'),
  ('setor',  '00000000-0000-4000-8000-00000000d0a1'),
  ('gestor', '00000000-0000-4000-8000-00000000d011'),
  ('med',    '00000000-0000-4000-8000-00000000d012');
GRANT SELECT, INSERT ON ids TO authenticated;
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
SELECT id, nome || '@dia-passado.local' FROM ids WHERE nome IN ('gestor', 'med');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gestor', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do dia passado');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do dia passado', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gestor'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),    pg_temp.id('uni'), 'plantonista');

SET LOCAL ROLE authenticated;
-- só o gestor escala, inclusive em dia que já passou
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.adicionar_plantao_escala(%L, %L, %L, %L, %L)', pg_temp.id('uni'), pg_temp.id('setor'),
  pg_temp.id('med'), private.data_atual() - 2, 'manha'), 'Acesso negado', 'B3: quem não é gestor não escala em dia que já passou');

SELECT pg_temp.como('gestor');
INSERT INTO ids SELECT 'pPassado', public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('setor'),
  pg_temp.id('med'), private.data_atual() - 2, 'manha', NULL, false, 'plantonista');
INSERT INTO ids SELECT 'pFuturo', public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('setor'),
  pg_temp.id('med'), private.data_atual() + 2, 'manha', NULL, false, 'plantonista');
SELECT pg_temp.ok((SELECT count(*) FROM ids WHERE nome IN ('pPassado', 'pFuturo')) = 2,
  'B3: o gestor escala em dia que já passou e em dia futuro');

RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.historico_escala h
  WHERE h.plantao_id = pg_temp.id('pPassado') AND h.acao = 'retroativo' AND h.perfil_id = pg_temp.id('gestor')),
  'B3: o histórico marca o plantão de dia passado como retroativo, com o gestor como autor');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.historico_escala h
  WHERE h.plantao_id = pg_temp.id('pFuturo') AND h.acao = 'retroativo'),
  'o plantão futuro não é marcado como retroativo');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.historico_escala h
  WHERE h.plantao_id = pg_temp.id('pFuturo') AND h.acao = 'criar'),
  'o histórico de criação continua para todos');

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
