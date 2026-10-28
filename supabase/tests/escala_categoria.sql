-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270202000002_escala_categoria.sql (aba Escala, E1)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_categoria.sql
--
-- Cada plantão tem categoria, e troca e passagem só valem dentro dela:
--  * sem categoria informada, o plantão recebe o papel único da pessoa; quem tem
--    dois papéis fica sem categoria, e pode ser escalado escolhendo uma delas;
--  * categoria que a pessoa não tem, ou gestor/admin como categoria: recusado;
--  * pedido de troca e de passagem entre categorias diferentes: recusado já no
--    pedido; dentro da mesma categoria: aceito;
--  * o plantão não muda de dono para alguém de outra categoria;
--  * parte de plantão fracionado e vaga herdam a categoria do plantão de origem;
--  * escala_da_unidade: cada um vê a equipe da própria categoria.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000f001'),
  ('uni',   '00000000-0000-4000-8000-00000000f00a'),
  ('setor', '00000000-0000-4000-8000-00000000f0a1'),
  ('medA',  '00000000-0000-4000-8000-00000000f101'),  -- plantonista
  ('medB',  '00000000-0000-4000-8000-00000000f102'),  -- plantonista
  ('enf',   '00000000-0000-4000-8000-00000000f103'),  -- enfermeiro
  ('enf2',  '00000000-0000-4000-8000-00000000f104'),  -- enfermeiro
  ('duplo', '00000000-0000-4000-8000-00000000f105'),  -- plantonista e enfermeiro
  ('pA',    '00000000-0000-4000-8000-00000000f201'),  -- plantão de medA (dia +1)
  ('pB',    '00000000-0000-4000-8000-00000000f202'),  -- plantão de medB (dia +2)
  ('pE',    '00000000-0000-4000-8000-00000000f203'),  -- plantão de enf (dia +3)
  ('pE2',   '00000000-0000-4000-8000-00000000f204'),  -- plantão de enf2 (dia +4)
  ('pD',    '00000000-0000-4000-8000-00000000f205');  -- plantão de duplo, sem categoria (dia +5)
GRANT SELECT ON ids TO authenticated;
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
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.papel_de(p text) RETURNS text LANGUAGE sql AS $$
  SELECT papel::text FROM public.escala_plantao WHERE id = pg_temp.id(p)
$$;
-- quem aparece na escala da unidade para quem está logado (próximos 30 dias)
CREATE FUNCTION pg_temp.vejo() RETURNS uuid[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(DISTINCT r.perfil_id ORDER BY r.perfil_id), '{}')
  FROM public.escala_da_unidade(pg_temp.id('uni'), private.data_atual(), private.data_atual() + 30) r
$$;
CREATE FUNCTION pg_temp.ids_de(VARIADIC p text[]) RETURNS uuid[] LANGUAGE sql AS $$
  SELECT array_agg(i.id ORDER BY i.id) FROM ids i WHERE i.nome = ANY (p)
$$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text), pg_temp.papel_de(text), pg_temp.vejo(), pg_temp.ids_de(text[]) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@escala-categoria.local' FROM ids WHERE nome IN ('medA', 'medB', 'enf', 'enf2', 'duplo');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('medA', 'medB', 'enf', 'enf2', 'duplo')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da categoria');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da categoria', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'), pg_temp.id('uni'), 'Clínica', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('medA'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('medB'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('enf'),   pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('enf2'),  pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('duplo'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('duplo'), pg_temp.id('uni'), 'enfermeiro');

-- ── 1. preenchimento na gravação ───────────────────────────────────────────
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('pA'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medA'),  private.data_atual() + 1, 'manha'),
  (pg_temp.id('pB'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medB'),  private.data_atual() + 2, 'manha'),
  (pg_temp.id('pE'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf'),   private.data_atual() + 3, 'manha'),
  (pg_temp.id('pE2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf2'),  private.data_atual() + 4, 'manha'),
  (pg_temp.id('pD'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('duplo'), private.data_atual() + 5, 'manha');
SELECT pg_temp.ok(pg_temp.papel_de('pA') = 'plantonista' AND pg_temp.papel_de('pE') = 'enfermeiro',
  'sem categoria informada, o plantão recebe o papel único da pessoa');
SELECT pg_temp.ok(pg_temp.papel_de('pD') IS NULL, 'quem tem dois papéis fica sem categoria até o gestor escolher');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel)
VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('duplo'), private.data_atual() + 6, 'manha', 'enfermeiro');
SELECT pg_temp.ok((SELECT papel = 'enfermeiro' FROM public.escala_plantao
                    WHERE perfil_id = pg_temp.id('duplo') AND data = private.data_atual() + 6),
  'quem tem dois papéis é escalado escolhendo a categoria');
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel)
                              VALUES (%L, %L, %L, %L, 'tarde', 'enfermeiro')$q$,
                            pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medA'), private.data_atual() + 7),
  'Categoria diferente', 'categoria que a pessoa não tem é recusada');
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel)
                              VALUES (%L, %L, %L, %L, 'tarde', 'gestor')$q$,
                            pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('medA'), private.data_atual() + 8),
  'Gestor e administrador não são categoria', 'gestor não é categoria de plantão');

-- ── 2. o plantão não muda de dono para outra categoria ────────────────────
SELECT pg_temp.falha(format('UPDATE public.escala_plantao SET perfil_id = %L WHERE id = %L', pg_temp.id('enf'), pg_temp.id('pA')),
  'Categoria diferente', 'plantão de plantonista não passa para enfermeiro');

-- ── 3. parte de plantão fracionado e vaga herdam a categoria ──────────────
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, fracionado, plantao_origem_id)
VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('duplo'), private.data_atual() + 1, 'tarde', true, pg_temp.id('pA'));
SELECT pg_temp.ok((SELECT papel = 'plantonista' FROM public.escala_plantao
                    WHERE plantao_origem_id = pg_temp.id('pA') AND perfil_id = pg_temp.id('duplo')),
  'parte de plantão fracionado herda a categoria do plantão de origem');
INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, aberta_por, plantao_origem_id, parte, partes, inicio, duracao_min)
SELECT pg_temp.id('uni'), pg_temp.id('setor'), e.data, e.turno, pg_temp.id('enf'), e.id, 2, 2, e.inicio + interval '3 hours', e.duracao_min / 2
FROM public.escala_plantao e WHERE e.id = pg_temp.id('pE');
SELECT pg_temp.ok((SELECT papel = 'enfermeiro' FROM public.escala_vagas WHERE plantao_origem_id = pg_temp.id('pE')),
  'vaga de plantão fracionado herda a categoria');

SET LOCAL ROLE authenticated;

-- ── 4. pedido de troca ─────────────────────────────────────────────────────
SELECT pg_temp.como('medA');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('pA'), pg_temp.id('pE')),
  'Troca só entre a mesma categoria', 'troca de plantonista com enfermeiro é recusada no pedido');
SELECT pg_temp.ok(public.solicitar_troca(pg_temp.id('pA'), pg_temp.id('pB'), NULL) IS NOT NULL,
  'troca entre dois plantonistas é aceita');

-- ── 5. pedido de passagem ──────────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.passar_plantao(%L, %L, NULL)', pg_temp.id('pA'), pg_temp.id('enf')),
  'Passagem só para a mesma categoria', 'passagem de plantonista para enfermeiro é recusada no pedido');
SELECT pg_temp.ok(public.passar_plantao(pg_temp.id('pA'), pg_temp.id('medB'), NULL) IS NOT NULL,
  'passagem para outro plantonista é aceita');

-- ── 6. escala da unidade por categoria ─────────────────────────────────────
SELECT pg_temp.ok(NOT (pg_temp.vejo() && pg_temp.ids_de('enf', 'enf2'))
                  AND pg_temp.vejo() @> pg_temp.ids_de('medA', 'medB', 'duplo'),
  'o plantonista vê os plantonistas (inclusive quem tem dois papéis) e nenhum enfermeiro');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(pg_temp.vejo() = pg_temp.ids_de('enf', 'enf2', 'duplo'),
  'o enfermeiro vê a equipe de enfermagem');
SELECT pg_temp.ok((SELECT bool_and(r.papel = 'enfermeiro' OR r.papel IS NULL)
                     FROM public.escala_da_unidade(pg_temp.id('uni'), private.data_atual(), private.data_atual() + 30) r),
  'a RPC devolve a categoria de cada plantão');
SELECT pg_temp.como('duplo');
SELECT pg_temp.ok(pg_temp.vejo() = pg_temp.ids_de('medA', 'medB', 'enf', 'enf2', 'duplo'),
  'quem tem dois papéis vê as duas equipes');

RESET ROLE;
ROLLBACK;
