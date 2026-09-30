-- Testes dos favoritos e da contagem de uso da Central (migration
-- 20261010000001). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_ferramentas_uso.sql
-- Cada uso soma 1; favoritar e desfavoritar não mexem na contagem; cada um só
-- vê a própria lista (nem o gestor, nem o administrador veem a do plantonista);
-- escrita direta na tabela é negada; chave fora do formato é recusada; anônimo
-- não chama as RPCs.
BEGIN;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;

DELETE FROM public.ferramenta_uso WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');

-- ── o plantonista usa e favorita ────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'u1', public.registrar_uso_ferramenta('calculadoras/drogas-vasoativas')::text;
INSERT INTO t SELECT 'u2', public.registrar_uso_ferramenta('calculadoras/drogas-vasoativas')::text;
SELECT public.registrar_uso_ferramenta('escores/heart');
SELECT public.marcar_favorito_ferramenta('escores/heart', true);
SELECT public.marcar_favorito_ferramenta('pediatria/bolus', true);
SELECT pg_temp.igual(pg_temp.v('u1') || ',' || pg_temp.v('u2'), '1,2', 'cada abertura soma 1 ao uso');
SELECT pg_temp.igual((SELECT string_agg(chave || ':' || favorita || ':' || usos, ' ' ORDER BY chave) FROM public.minhas_ferramentas()),
  'calculadoras/drogas-vasoativas:false:2 escores/heart:true:1 pediatria/bolus:true:0',
  'a lista traz favorita e contagem; favoritar não conta uso');
SELECT pg_temp.igual((SELECT chave FROM public.minhas_ferramentas() LIMIT 1), 'calculadoras/drogas-vasoativas',
  'a mais usada vem primeiro');
SELECT public.marcar_favorito_ferramenta('escores/heart', false);
SELECT pg_temp.igual((SELECT favorita || ':' || usos || ':' || coalesce(favoritada_em::text, 'nulo') FROM public.minhas_ferramentas() WHERE chave = 'escores/heart'),
  'false:1:nulo', 'tirar dos favoritos mantém a contagem de uso');
SELECT pg_temp.falha($$SELECT public.registrar_uso_ferramenta('Calculadoras/../x')$$, 'Ferramenta inválida', 'chave fora do formato é recusada');
SELECT pg_temp.falha($$SELECT public.marcar_favorito_ferramenta('escores/heart', NULL)$$, 'Informe se é favorita', 'favorito sem valor é recusado');
SELECT pg_temp.falha($$UPDATE public.ferramenta_uso SET usos = 999$$, 'permission denied', 'a contagem não se edita direto na tabela');
SELECT pg_temp.falha($$INSERT INTO public.ferramenta_uso (perfil_id, chave, usos) VALUES ('10000000-0000-4000-8000-000000000002', 'escores/grace', 50)$$,
  'permission denied', 'não se insere direto na tabela');
SELECT pg_temp.falha($$DELETE FROM public.ferramenta_uso$$, 'permission denied', 'não se apaga direto na tabela');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.ferramenta_uso), '3', 'o plantonista lê as próprias linhas pela RLS');

-- ── a gestora e o administrador não veem a lista do plantonista ─────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.ferramenta_uso), '0', 'a gestora não lê o uso do plantonista');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.minhas_ferramentas()), '0', 'a lista da gestora é só dela (vazia)');
SELECT public.registrar_uso_ferramenta('escores/heart');
SELECT pg_temp.igual((SELECT usos::text FROM public.minhas_ferramentas() WHERE chave = 'escores/heart'), '1',
  'o uso da gestora não soma no do plantonista');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.igual((SELECT count(*)::text FROM public.ferramenta_uso), '0', 'o administrador não lê o uso de ninguém');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((SELECT usos::text FROM public.minhas_ferramentas() WHERE chave = 'escores/heart'), '1',
  'a contagem do plantonista segue a dele');
RESET ROLE;

-- ── anônimo não chama ───────────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.registrar_uso_ferramenta('escores/heart')$$, 'permission denied', 'anônimo não registra uso');
SELECT pg_temp.falha($$SELECT * FROM public.minhas_ferramentas()$$, 'permission denied', 'anônimo não lê a lista');
SELECT pg_temp.falha($$SELECT * FROM public.ferramenta_uso$$, 'permission denied', 'anônimo não lê a tabela');
RESET ROLE;

ROLLBACK;
