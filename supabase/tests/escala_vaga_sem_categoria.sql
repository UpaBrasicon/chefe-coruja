-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000007_escala_vaga_sem_categoria.sql (bug médio
-- M1 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_vaga_sem_categoria.sql
--
-- A vaga sem categoria é do plantonista (regra da E4, em candidatar_vaga):
--  * vagas_abertas não a mostra à enfermeira (antes mostrava a todos os papéis
--    e a candidatura recusava);
--  * o plantonista continua vendo;
--  * a vaga de enfermagem continua aparecendo para a enfermeira;
--  * B2: a vaga numa faixa em que eu já estou escalado não aparece.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c801'),
  ('uni',   '00000000-0000-4000-8000-00000000c80a'),
  ('setor', '00000000-0000-4000-8000-00000000c8a1'),
  ('gest',  '00000000-0000-4000-8000-00000000c811'),
  ('enf',   '00000000-0000-4000-8000-00000000c812'),
  ('med',   '00000000-0000-4000-8000-00000000c813'),
  ('vSem',  '00000000-0000-4000-8000-00000000c821'),
  ('vEnf',  '00000000-0000-4000-8000-00000000c822'),
  ('vMed2', '00000000-0000-4000-8000-00000000c823'),
  ('sv',    '00000000-0000-4000-8000-00000000c8a2');
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
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
CREATE FUNCTION pg_temp.ve(p text) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.vagas_abertas() WHERE id = pg_temp.id(p)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.ok(boolean, text), pg_temp.ve(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@vaga-sem-categoria.local' FROM ids WHERE nome IN ('gest', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da vaga');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da vaga', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro'),
  (pg_temp.id('sv'), pg_temp.id('uni'), 'Sala Vermelha', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('enf'),  pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista');
-- B2: o médico já está na Sala Vermelha em D+5 de manhã
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel) VALUES
  (pg_temp.id('uni'), pg_temp.id('sv'), pg_temp.id('med'), private.data_atual() + 5, 'manha', 'plantonista');
INSERT INTO public.escala_vagas (id, unidade_id, setor_id, data, turno, aberta_por, papel) VALUES
  (pg_temp.id('vSem'), pg_temp.id('uni'), pg_temp.id('setor'), private.data_atual() + 3, 'manha', pg_temp.id('gest'), NULL),
  (pg_temp.id('vEnf'), pg_temp.id('uni'), pg_temp.id('setor'), private.data_atual() + 3, 'tarde', pg_temp.id('gest'), 'enfermeiro'),
  (pg_temp.id('vMed2'), pg_temp.id('uni'), pg_temp.id('setor'), private.data_atual() + 5, 'manha', pg_temp.id('gest'), 'plantonista');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(NOT pg_temp.ve('vSem'), 'M1: a enfermeira não vê a vaga sem categoria (é do plantonista)');
SELECT pg_temp.ok(pg_temp.ve('vEnf'), 'a enfermeira vê a vaga de enfermagem');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.ve('vSem'), 'o plantonista vê a vaga sem categoria');
SELECT pg_temp.ok(NOT pg_temp.ve('vEnf'), 'o plantonista não vê a vaga de enfermagem');
SELECT pg_temp.ok(NOT pg_temp.ve('vMed2'), 'B2: o plantonista não vê a vaga na faixa em que já está escalado (Sala Vermelha)');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
