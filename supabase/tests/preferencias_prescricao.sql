-- Testes da migration 20261002000001_preferencias_prescricao.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/preferencias_prescricao.sql
BEGIN;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.negado(sql text, rotulo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RETURN;  -- qualquer recusa (RLS, CHECK, índice único) serve
  END;
  RAISE EXCEPTION 'FALHOU: %', rotulo;
END $$;

-- medicamento de teste no cadastro (só nesta transação)
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte)
VALUES ('2e000000-0000-4000-8000-000000000001', 'Dipirona de Teste', 'dipirona de teste', 'comprimido 500 mg', 'TESTE');

-- ── 1. o plantonista grava e lê o próprio favorito ─────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.preferencias_prescricao (medicamento_id, dose, via, posologia, quantidade, classe_alergenica)
  VALUES ('2e000000-0000-4000-8000-000000000001', '1 comprimido', 'VO', 'de 6/6h se dor ou febre', '20 comprimidos', 'Dipirona')
  RETURNING id INTO v;
  PERFORM set_config('teste.fav', v::text, true);
  IF (SELECT perfil_id FROM public.preferencias_prescricao WHERE id = v) <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: o dono não veio de quem está logado';
  END IF;
  IF (SELECT count(*) FROM public.preferencias_prescricao) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: o dono não lê o próprio favorito';
  END IF;
  RAISE NOTICE 'OK  o plantonista grava e lê o próprio favorito (dono = quem está logado)';
END $$;

-- ── 2. repetir medicamento + posologia é recusado; posologia vazia também ──
SELECT pg_temp.negado($$INSERT INTO public.preferencias_prescricao (medicamento_id, posologia)
  VALUES ('2e000000-0000-4000-8000-000000000001', '  DE 6/6H SE DOR OU FEBRE ')$$, 'favorito repetido');
SELECT pg_temp.negado($$INSERT INTO public.preferencias_prescricao (medicamento_id, posologia)
  VALUES ('2e000000-0000-4000-8000-000000000001', ' ')$$, 'favorito sem posologia');
DO $$ BEGIN RAISE NOTICE 'OK  mesmo medicamento com a mesma posologia não entra duas vezes; posologia é obrigatória'; END $$;

-- ── 3. ninguém grava em nome de outra pessoa ───────────────────────────────
SELECT pg_temp.negado($$INSERT INTO public.preferencias_prescricao (perfil_id, medicamento_id, posologia)
  VALUES ('10000000-0000-4000-8000-000000000001', '2e000000-0000-4000-8000-000000000001', '1x ao dia')$$, 'gravou favorito de outra pessoa');
SELECT pg_temp.negado(format($$UPDATE public.preferencias_prescricao SET perfil_id = '10000000-0000-4000-8000-000000000001' WHERE id = %L$$,
  current_setting('teste.fav')), 'passou o favorito para outra pessoa');
DO $$ BEGIN RAISE NOTICE 'OK  não se grava nem se transfere favorito para outra pessoa'; END $$;

-- ── 4. o gestor não vê, não edita e não apaga ──────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.preferencias_prescricao) THEN
    RAISE EXCEPTION 'FALHOU: gestor vê o favorito do plantonista';
  END IF;
  UPDATE public.preferencias_prescricao SET posologia = 'mudado pelo gestor' WHERE id = current_setting('teste.fav')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: gestor editou o favorito'; END IF;
  DELETE FROM public.preferencias_prescricao WHERE id = current_setting('teste.fav')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: gestor apagou o favorito'; END IF;
  RAISE NOTICE 'OK  gestor não vê, não edita e não apaga o favorito de outra pessoa';
END $$;

-- ── 5. anônimo não lê nada ─────────────────────────────────────────────────
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.negado($$SELECT 1 FROM public.preferencias_prescricao$$, 'anônimo leu favoritos');
DO $$ BEGIN RAISE NOTICE 'OK  anônimo não lê a tabela'; END $$;

-- ── 6. o dono corrige e apaga o que é seu ──────────────────────────────────
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE n int;
BEGIN
  UPDATE public.preferencias_prescricao SET quantidade = '30 comprimidos' WHERE id = current_setting('teste.fav')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: dono não corrigiu o favorito'; END IF;
  DELETE FROM public.preferencias_prescricao WHERE id = current_setting('teste.fav')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: dono não apagou o favorito'; END IF;
  RAISE NOTICE 'OK  o dono corrige e apaga o próprio favorito';
END $$;

ROLLBACK;
