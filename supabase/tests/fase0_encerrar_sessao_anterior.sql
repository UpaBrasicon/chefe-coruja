-- Fase 0, item 19 — migration 20261028000001_encerrar_sessao_anterior.sql: o
-- desbloqueio encerra a sessão anterior e leva junto a chave dos rascunhos.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-00000000bb01', '10000000-0000-4000-8000-000000000002', now(), now()),  -- anterior (A)
  ('00000000-0000-4000-8000-00000000bb02', '10000000-0000-4000-8000-000000000002', now(), now()),  -- nova (A)
  ('00000000-0000-4000-8000-00000000bb03', '10000000-0000-4000-8000-000000000004', now(), now());  -- de outra pessoa (B)
CREATE TEMP TABLE k (nome text PRIMARY KEY, v text);
GRANT ALL ON k TO authenticated;
CREATE FUNCTION pg_temp.como(p_user text, p_sessao text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_sessao)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text, text) TO authenticated;

SET LOCAL ROLE authenticated;
-- a sessão anterior tinha a chave com que o aparelho cifrou os rascunhos
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000bb01');
INSERT INTO k VALUES ('anterior', public.chave_rascunho());
-- a nova (desbloqueio) chegou a criar a dela
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000bb02');
INSERT INTO k VALUES ('nova_antes', public.chave_rascunho());

-- não encerra a própria sessão nem a de outra pessoa
DO $$ BEGIN
  IF public.encerrar_sessao_anterior('00000000-0000-4000-8000-00000000bb02') THEN RAISE EXCEPTION 'FALHOU: encerrou a sessão atual'; END IF;
  IF public.encerrar_sessao_anterior('00000000-0000-4000-8000-00000000bb03') THEN RAISE EXCEPTION 'FALHOU: encerrou sessão de outra pessoa'; END IF;
  IF public.encerrar_sessao_anterior(NULL) THEN RAISE EXCEPTION 'FALHOU: aceitou sessão vazia'; END IF;
  RAISE NOTICE 'OK  recusa a sessão atual, a de outra pessoa e a vazia';
END $$;

-- encerra a anterior e a nova passa a usar a chave dela
DO $$ BEGIN
  IF NOT public.encerrar_sessao_anterior('00000000-0000-4000-8000-00000000bb01') THEN RAISE EXCEPTION 'FALHOU: não encerrou a sessão anterior'; END IF;
END $$;
INSERT INTO k VALUES ('nova_depois', public.chave_rascunho());
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.sessions WHERE id = '00000000-0000-4000-8000-00000000bb01') THEN RAISE EXCEPTION 'FALHOU: sessão anterior continua viva'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = '00000000-0000-4000-8000-00000000bb03') THEN RAISE EXCEPTION 'FALHOU: apagou sessão de outra pessoa'; END IF;
  IF (SELECT v FROM k WHERE nome = 'nova_depois') <> (SELECT v FROM k WHERE nome = 'anterior') THEN RAISE EXCEPTION 'FALHOU: rascunho do aparelho ficaria ilegível (chave não passou)'; END IF;
  IF (SELECT count(*) FROM private.rascunho_chave WHERE session_id IN ('00000000-0000-4000-8000-00000000bb01', '00000000-0000-4000-8000-00000000bb02')) <> 1 THEN RAISE EXCEPTION 'FALHOU: sobrou chave duplicada'; END IF;
  RAISE NOTICE 'OK  sessão anterior encerrada; a nova herda a chave dos rascunhos; a de outra pessoa fica';
END $$;

-- 2FA ligado: sessão nova sem segundo fator não encerra nem herda
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000bb03');
DO $$ BEGIN
  PERFORM public.encerrar_sessao_anterior('00000000-0000-4000-8000-00000000bb02');
  RAISE EXCEPTION 'FALHOU: rodou sem segundo fator';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem segundo fator: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.encerrar_sessao_anterior(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
