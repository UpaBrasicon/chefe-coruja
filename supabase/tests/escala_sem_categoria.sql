-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000017_escala_sem_categoria.sql (médio M7 do
-- teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md; decisão
-- do RT em 31/10/2026: "Categoria em comum")
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_sem_categoria.sql
--
--  * plantão sem categoria: troca e passagem só com quem tem categoria em
--    comum com o dono na unidade;
--  * o gestor define a categoria de um ou de vários plantões de uma vez
--    (definir_categoria_plantoes), só com um papel que a pessoa tem.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000d301'),
  ('uni',    '00000000-0000-4000-8000-00000000d30a'),
  ('setor',  '00000000-0000-4000-8000-00000000d3a1'),
  ('gestor', '00000000-0000-4000-8000-00000000d311'),
  ('medA',   '00000000-0000-4000-8000-00000000d312'),  -- plantonista e telemedicina: plantão sem categoria
  ('medB',   '00000000-0000-4000-8000-00000000d313'),  -- plantonista
  ('enfC',   '00000000-0000-4000-8000-00000000d314'),  -- enfermeiro e recepção: plantão sem categoria
  ('pA',     '00000000-0000-4000-8000-00000000d321'),
  ('pA2',    '00000000-0000-4000-8000-00000000d322'),
  ('pA3',    '00000000-0000-4000-8000-00000000d323'),
  ('pB',     '00000000-0000-4000-8000-00000000d324'),
  ('pC',     '00000000-0000-4000-8000-00000000d325');
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
SELECT id, nome || '@sem-categoria.local' FROM ids WHERE nome IN ('gestor', 'medA', 'medB', 'enfC');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gestor', 'medA', 'medB', 'enfC')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org sem categoria');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA sem categoria', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gestor'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('medA'),   pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('medA'),   pg_temp.id('uni'), 'telemedicina'),
  (pg_temp.id('medB'),   pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('enfC'),   pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('enfC'),   pg_temp.id('uni'), 'recepcao');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pA'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medA'), private.data_atual() + 3, 'manha'),
  (pg_temp.id('pA2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medA'), private.data_atual() + 5, 'manha'),
  (pg_temp.id('pA3'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medA'), private.data_atual() + 7, 'manha'),
  (pg_temp.id('pB'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medB'), private.data_atual() + 4, 'tarde'),
  (pg_temp.id('pC'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enfC'), private.data_atual() + 6, 'tarde');

RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.escala_plantao WHERE id IN (pg_temp.id('pA'), pg_temp.id('pC')) AND papel IS NULL) = 2,
  'quem tem duas categorias fica com o plantão sem categoria (E1)');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medA');
SELECT pg_temp.falha(format('SELECT public.passar_plantao(%L, %L, NULL)', pg_temp.id('pA'), pg_temp.id('enfC')),
  'Plantão sem categoria', 'M7: plantão sem categoria não passa para quem não tem categoria em comum');
SELECT pg_temp.ok(public.passar_plantao(pg_temp.id('pA2'), pg_temp.id('medB'), NULL) IS NOT NULL,
  'M7: plantão sem categoria passa para quem tem categoria em comum');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('pA'), pg_temp.id('pC')),
  'Plantão sem categoria', 'M7: plantão sem categoria não se troca com quem não tem categoria em comum');
SELECT pg_temp.ok(public.solicitar_troca(pg_temp.id('pA'), pg_temp.id('pB'), NULL) IS NOT NULL,
  'M7: plantão sem categoria se troca com quem tem categoria em comum');

-- só o gestor define a categoria; e só com um papel que a pessoa tem
SELECT pg_temp.falha(format('SELECT public.definir_categoria_plantoes(ARRAY[%L]::uuid[], %L)', pg_temp.id('pA3'), 'plantonista'),
  'Acesso negado', 'quem não é gestor não define a categoria do plantão');
SELECT pg_temp.como('gestor');
SELECT pg_temp.falha(format('SELECT public.definir_categoria_plantoes(ARRAY[%L]::uuid[], %L)', pg_temp.id('pA3'), 'enfermeiro'),
  'Categoria diferente', 'o gestor não define uma categoria que a pessoa não tem');
SELECT pg_temp.ok(public.definir_categoria_plantoes(ARRAY[pg_temp.id('pA3'), pg_temp.id('pA')], 'telemedicina') = 2,
  'M7: o gestor define a categoria de vários plantões de uma vez');
SELECT pg_temp.ok((SELECT count(*) FROM public.escala_plantao WHERE id IN (pg_temp.id('pA3'), pg_temp.id('pA')) AND papel = 'telemedicina') = 2,
  'os plantões ficam com a categoria escolhida');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
