-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270202000001_escala_da_unidade.sql (aba Escala, E0)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_da_unidade.sql
--
-- A "Escala da unidade" do plantonista sai da RPC, não da tabela:
--  * pela tabela (RLS), o plantonista só vê o próprio plantão (o defeito);
--  * pela RPC, vê os próprios e os dos outros plantonistas da unidade, sem a
--    observação dos colegas, e nenhum plantão de outra categoria;
--  * o enfermeiro, até a E3, vê só os próprios;
--  * o gestor vê a escala inteira, com a observação;
--  * sem vínculo com a unidade: acesso negado; período acima de 62 dias: recusado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000e001'),
  ('uni',   '00000000-0000-4000-8000-00000000e00a'),
  ('uni2',  '00000000-0000-4000-8000-00000000e00b'),
  ('setor', '00000000-0000-4000-8000-00000000e0a1'),
  ('medA',  '00000000-0000-4000-8000-00000000e101'),  -- plantonista
  ('medB',  '00000000-0000-4000-8000-00000000e102'),  -- plantonista
  ('enf',   '00000000-0000-4000-8000-00000000e103'),  -- enfermeiro
  ('enf2',  '00000000-0000-4000-8000-00000000e104'),  -- enfermeiro
  ('gest',  '00000000-0000-4000-8000-00000000e105'),  -- gestor
  ('fora',  '00000000-0000-4000-8000-00000000e106');  -- plantonista de outra unidade
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
-- a escala da unidade lida direto da tabela (com a RLS de quem está logado)
CREATE FUNCTION pg_temp.pela_tabela() RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.escala_plantao e
  WHERE e.unidade_id = pg_temp.id('uni') AND e.data = private.data_atual() + 1
$$;
-- a mesma escala pela RPC, nos próximos 30 dias
CREATE FUNCTION pg_temp.pela_rpc() RETURNS SETOF record LANGUAGE sql AS $$
  SELECT r.perfil_id, r.nome_completo, r.crm, r.observacao
  FROM public.escala_da_unidade(pg_temp.id('uni'), private.data_atual(), private.data_atual() + 30) r
$$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text), pg_temp.pela_tabela(), pg_temp.pela_rpc() TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@escala-unidade.local' FROM ids WHERE nome IN ('medA', 'medB', 'enf', 'enf2', 'gest', 'fora');
INSERT INTO public.perfis (id, nome_completo, crm)
SELECT id, nome, CASE WHEN nome LIKE 'med%' THEN '1234' END FROM ids
WHERE nome IN ('medA', 'medB', 'enf', 'enf2', 'gest', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, crm = EXCLUDED.crm;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da escala da unidade');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'),  pg_temp.id('org'), 'UPA da escala', 'hospital'),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA vizinha',   'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'), pg_temp.id('uni'), 'Clínica', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('medA'), pg_temp.id('uni'),  'plantonista'),
  (pg_temp.id('medB'), pg_temp.id('uni'),  'plantonista'),
  (pg_temp.id('enf'),  pg_temp.id('uni'),  'enfermeiro'),
  (pg_temp.id('enf2'), pg_temp.id('uni'),  'enfermeiro'),
  (pg_temp.id('gest'), pg_temp.id('uni'),  'gestor'),
  (pg_temp.id('fora'), pg_temp.id('uni2'), 'plantonista');

INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, observacao)
SELECT pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id(n), private.data_atual() + 1, 'manha', 'obs de ' || n
FROM unnest(ARRAY['medA', 'medB', 'enf', 'enf2']) n;

SET LOCAL ROLE authenticated;

-- ── 1. o defeito: pela tabela, o plantonista só vê o próprio plantão ───────
SELECT pg_temp.como('medA');
SELECT pg_temp.ok(pg_temp.pela_tabela() = 1, 'pela tabela (RLS) o plantonista vê só o próprio plantão');

-- ── 2. pela RPC, o plantonista vê a equipe de plantonistas ─────────────────
SELECT pg_temp.ok((SELECT count(*) FROM pg_temp.pela_rpc() AS r(perfil_id uuid, nome text, crm text, obs text)) = 2,
  'pela RPC o plantonista vê o próprio plantão e o do colega plantonista');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_temp.pela_rpc() AS r(perfil_id uuid, nome text, crm text, obs text)
                              WHERE r.perfil_id IN (pg_temp.id('enf'), pg_temp.id('enf2'))),
  'o plantonista não vê plantão de outra categoria');
SELECT pg_temp.ok((SELECT r.nome = 'medB' AND r.crm = '1234' AND r.obs IS NULL
                     FROM pg_temp.pela_rpc() AS r(perfil_id uuid, nome text, crm text, obs text)
                    WHERE r.perfil_id = pg_temp.id('medB')),
  'do colega saem nome e CRM, sem a observação');
SELECT pg_temp.ok((SELECT r.obs = 'obs de medA'
                     FROM pg_temp.pela_rpc() AS r(perfil_id uuid, nome text, crm text, obs text)
                    WHERE r.perfil_id = pg_temp.id('medA')),
  'do próprio plantão sai a observação');

-- ── 3. o enfermeiro, até a E3, vê só os próprios ───────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT array_agg(r.perfil_id) = ARRAY[pg_temp.id('enf')]
                     FROM pg_temp.pela_rpc() AS r(perfil_id uuid, nome text, crm text, obs text)),
  'o enfermeiro vê só o próprio plantão');

-- ── 4. o gestor vê a escala inteira, com a observação ──────────────────────
SELECT pg_temp.como('gest');
SELECT pg_temp.ok((SELECT count(*) = 4 AND count(r.obs) = 4
                     FROM pg_temp.pela_rpc() AS r(perfil_id uuid, nome text, crm text, obs text)),
  'o gestor vê os quatro plantões, com a observação');

-- ── 5. recusas ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('fora');
SELECT pg_temp.falha(format('SELECT * FROM public.escala_da_unidade(%L, %L, %L)',
                            pg_temp.id('uni'), private.data_atual(), private.data_atual() + 30),
  'Acesso negado', 'sem vínculo com a unidade: acesso negado');
SELECT pg_temp.como('medA');
SELECT pg_temp.falha(format('SELECT * FROM public.escala_da_unidade(%L, %L, %L)',
                            pg_temp.id('uni'), private.data_atual(), private.data_atual() + 63),
  'Período maior que 62 dias', 'período acima de 62 dias é recusado');
SELECT pg_temp.falha(format('SELECT * FROM public.escala_da_unidade(%L, %L, %L)',
                            pg_temp.id('uni'), private.data_atual() + 1, private.data_atual()),
  'Informe a unidade e o período', 'fim antes do início é recusado');

RESET ROLE;
ROLLBACK;
