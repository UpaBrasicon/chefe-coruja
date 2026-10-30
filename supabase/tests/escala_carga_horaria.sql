-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000011_escala_carga_horaria.sql (bug médio M13
-- do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_carga_horaria.sql
--
-- Carga horária do gestor:
--  * as horas são as do plantão (manhã = 6 h, noite = 12 h), não 12 h por
--    diurno (antes a manhã contava 12 h e o contador do plantonista, 6 h);
--  * cada linha diz a categoria (antes todas sob "Plantonista").
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000cc01'),
  ('uni',   '00000000-0000-4000-8000-00000000cc0a'),
  ('setor', '00000000-0000-4000-8000-00000000cca1'),
  ('gest',  '00000000-0000-4000-8000-00000000cc11'),
  ('med',   '00000000-0000-4000-8000-00000000cc12'),
  ('enf',   '00000000-0000-4000-8000-00000000cc13');
GRANT SELECT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE TEMP TABLE r (perfil_id uuid, horas numeric, diurnos bigint, noturnos bigint, categorias text) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;
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
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@carga-horaria.local' FROM ids WHERE nome IN ('gest', 'med', 'enf');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'enf')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da carga');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da carga', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('enf'),  pg_temp.id('uni'), 'enfermeiro');
-- no mês que vem: médico de manhã num dia e de noite no outro; enfermeira à tarde
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'), date_trunc('month', private.data_atual() + 40)::date + 2, 'manha'),
  (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'), date_trunc('month', private.data_atual() + 40)::date + 3, 'noite'),
  (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf'), date_trunc('month', private.data_atual() + 40)::date + 2, 'tarde');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
INSERT INTO r SELECT x.perfil_id, x.horas, x.diurnos, x.noturnos, to_jsonb(x) ->> 'categorias'
  FROM public.resumo_carga_plantonistas(pg_temp.id('uni'), date_trunc('month', private.data_atual() + 40)::date,
                                         (date_trunc('month', private.data_atual() + 40) + interval '1 month - 1 day')::date) x;
SELECT pg_temp.ok((SELECT horas FROM r WHERE perfil_id = pg_temp.id('med')) = 18,
  'M13: manhã (6 h) + noite (12 h) = 18 h (antes 24 h)');
SELECT pg_temp.ok((SELECT horas FROM r WHERE perfil_id = pg_temp.id('enf')) = 6, 'M13: a tarde da enfermeira conta 6 h');
SELECT pg_temp.ok((SELECT diurnos = 1 AND noturnos = 1 FROM r WHERE perfil_id = pg_temp.id('med')), 'diurnos e noturnos continuam contados');
SELECT pg_temp.ok((SELECT categorias FROM r WHERE perfil_id = pg_temp.id('enf')) = 'enfermeiro'
                  AND (SELECT categorias FROM r WHERE perfil_id = pg_temp.id('med')) = 'plantonista',
  'M13: cada linha diz a categoria');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
