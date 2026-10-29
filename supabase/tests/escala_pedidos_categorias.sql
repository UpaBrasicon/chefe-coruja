-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270202000004_escala_pedidos_categorias.sql (aba Escala, E4)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_pedidos_categorias.sql
--
-- Os outros papéis pedem troca, passagem e falta e se candidatam a vaga, dentro
-- da própria categoria:
--  * colegas_da_categoria: só os da minha categoria, sem mim; sem vínculo, negado;
--  * a enfermeira pede troca e passagem com outra enfermeira e justifica falta;
--  * a vaga de enfermagem aceita a candidatura da enfermeira e recusa a do
--    técnico; a vaga sem categoria continua só do plantonista;
--  * aprovada a candidatura, o plantão nasce com a categoria da vaga, mesmo com
--    outra categoria já escalada na faixa.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000b001'),
  ('uni',   '00000000-0000-4000-8000-00000000b00a'),
  ('uni2',  '00000000-0000-4000-8000-00000000b00b'),
  ('setor', '00000000-0000-4000-8000-00000000b0a1'),
  ('gest',  '00000000-0000-4000-8000-00000000b101'),
  ('enf',   '00000000-0000-4000-8000-00000000b102'),
  ('enf2',  '00000000-0000-4000-8000-00000000b103'),
  ('tec',   '00000000-0000-4000-8000-00000000b104'),
  ('med',   '00000000-0000-4000-8000-00000000b105'),
  ('fora',  '00000000-0000-4000-8000-00000000b106'),
  ('pE',    '00000000-0000-4000-8000-00000000b201'),
  ('pE2',   '00000000-0000-4000-8000-00000000b202'),
  ('pT',    '00000000-0000-4000-8000-00000000b203');
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
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@escala-pedidos.local' FROM ids WHERE nome IN ('gest', 'enf', 'enf2', 'tec', 'med', 'fora');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'enf', 'enf2', 'tec', 'med', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org dos pedidos');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'), pg_temp.id('org'), 'UPA dos pedidos', 'hospital'),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA vizinha', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('enf'),  pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('enf2'), pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('tec'),  pg_temp.id('uni'), 'tecnico_enfermagem'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('fora'), pg_temp.id('uni2'), 'enfermeiro');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pE'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf'),  private.data_atual() + 3, 'manha'),
  (pg_temp.id('pE2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf2'), private.data_atual() + 4, 'manha'),
  (pg_temp.id('pT'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('tec'),  private.data_atual() + 5, 'manha');
-- vagas: de enfermagem (com técnico já escalado na faixa) e uma antiga, sem categoria
SELECT pg_temp.como('gest');
INSERT INTO t SELECT 'vEnf', public.marcar_vaga_escala(pg_temp.id('setor'), private.data_atual() + 5, 'manha', NULL, 'enfermeiro')::text;
INSERT INTO public.escala_vagas (id, unidade_id, setor_id, data, turno, aberta_por)
VALUES ('00000000-0000-4000-8000-00000000b301', pg_temp.id('uni'), pg_temp.id('setor'), private.data_atual() + 6, 'noite', pg_temp.id('gest'));

SET LOCAL ROLE authenticated;

-- ── 1. colegas para passar ─────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT array_agg(perfil_id) FROM public.colegas_da_categoria(pg_temp.id('uni'))) = ARRAY[pg_temp.id('enf2')],
  'colegas_da_categoria: a enfermeira vê só a outra enfermeira');
SELECT pg_temp.como('fora');
SELECT pg_temp.falha(format('SELECT * FROM public.colegas_da_categoria(%L)', pg_temp.id('uni')), 'Acesso negado', 'colegas_da_categoria: sem vínculo, negado');

-- ── 2. troca, passagem e falta da enfermagem ───────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(public.solicitar_troca(pg_temp.id('pE'), pg_temp.id('pE2'), 'consulta') IS NOT NULL,
  'a enfermeira pede troca com outra enfermeira');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('pE'), pg_temp.id('pT')),
  'Troca só entre a mesma categoria', 'troca com o técnico é recusada');
SELECT pg_temp.ok(public.passar_plantao(pg_temp.id('pE'), pg_temp.id('enf2'), NULL) IS NOT NULL,
  'a enfermeira pede passagem para outra enfermeira');
INSERT INTO public.solicitacoes_escala (unidade_id, escala_plantao_id, perfil_id, tipo, tipo_falta, justificativa, criado_por)
VALUES (pg_temp.id('uni'), pg_temp.id('pE'), pg_temp.id('enf'), 'justificar_falta', 'atestado_medico', 'atestado', pg_temp.id('enf'));
SELECT pg_temp.ok((SELECT count(*) FROM public.solicitacoes_escala WHERE perfil_id = pg_temp.id('enf')) = 2,
  'a enfermeira justifica falta e vê os próprios pedidos');

-- ── 3. vagas por categoria ─────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.falha(format('SELECT public.candidatar_vaga(%L)', pg_temp.id('vEnf')),
  'Esta vaga é de enfermeiro', 'o técnico não se candidata à vaga de enfermagem');
SELECT pg_temp.como('enf2');
INSERT INTO t SELECT 'cand', public.candidatar_vaga(pg_temp.id('vEnf'))::text;
SELECT pg_temp.ok(pg_temp.id('cand') IS NOT NULL, 'a enfermeira se candidata à vaga de enfermagem');
SELECT pg_temp.falha($$SELECT public.candidatar_vaga('00000000-0000-4000-8000-00000000b301')$$,
  'Esta vaga é de plantonista', 'a vaga sem categoria continua só do plantonista');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(public.candidatar_vaga('00000000-0000-4000-8000-00000000b301') IS NOT NULL,
  'o plantonista se candidata à vaga sem categoria');

-- ── 4. aprovar: o plantão nasce com a categoria da vaga ───────────────────
SELECT pg_temp.como('gest');
INSERT INTO t SELECT 'novo', public.aprovar_candidatura(pg_temp.id('cand'))::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT papel = 'enfermeiro' AND perfil_id = pg_temp.id('enf2') FROM public.escala_plantao WHERE id = pg_temp.id('novo')),
  'aprovada com técnico já escalado na faixa, o plantão nasce de enfermeiro');

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
