-- Fase 0, item 13 — migration 20261026000001_chave_rascunho.sql: chave dos
-- rascunhos cifrados, uma por sessão de login, apagada quando a sessão acaba.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-00000000aa01', '10000000-0000-4000-8000-000000000002', now(), now()),
  ('00000000-0000-4000-8000-00000000aa02', '10000000-0000-4000-8000-000000000002', now(), now()),
  ('00000000-0000-4000-8000-00000000aa03', '10000000-0000-4000-8000-000000000004', now(), now());
CREATE TEMP TABLE k (nome text PRIMARY KEY, v text);
GRANT ALL ON k TO authenticated;
CREATE FUNCTION pg_temp.como(p_user text, p_sessao text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_sessao)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text, text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aa01');
INSERT INTO k VALUES ('a1', public.chave_rascunho()), ('a1_de_novo', public.chave_rascunho());
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aa02');
INSERT INTO k VALUES ('a2', public.chave_rascunho());
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000aa03');
INSERT INTO k VALUES ('b', public.chave_rascunho());
DO $$
BEGIN
  IF length(decode((SELECT v FROM k WHERE nome = 'a1'), 'base64')) <> 32 THEN RAISE EXCEPTION 'FALHOU: chave não tem 32 bytes'; END IF;
  IF (SELECT v FROM k WHERE nome = 'a1') <> (SELECT v FROM k WHERE nome = 'a1_de_novo') THEN RAISE EXCEPTION 'FALHOU: mesma sessão recebeu outra chave'; END IF;
  IF (SELECT v FROM k WHERE nome = 'a1') = (SELECT v FROM k WHERE nome = 'a2') THEN RAISE EXCEPTION 'FALHOU: outra sessão do mesmo usuário recebeu a mesma chave'; END IF;
  IF (SELECT v FROM k WHERE nome = 'a1') = (SELECT v FROM k WHERE nome = 'b') THEN RAISE EXCEPTION 'FALHOU: outro usuário recebeu a mesma chave'; END IF;
  RAISE NOTICE 'OK  uma chave de 32 bytes por sessão; estável na sessão, diferente entre sessões e usuários';
END $$;
-- quem não é dono da sessão não pega a chave dela
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000aa01');
DO $$ BEGIN
  PERFORM public.chave_rascunho();
  RAISE EXCEPTION 'FALHOU: outro usuário pegou a chave da sessão alheia';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sessão alheia: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'private.rascunho_chave', 'SELECT') THEN RAISE EXCEPTION 'FALHOU: tabela de chaves legível pela API'; END IF;
  RAISE NOTICE 'OK  tabela de chaves fora da API';
END $$;

-- 2FA ligado: sem segundo fator, sem chave
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aa01');
DO $$ BEGIN
  PERFORM public.chave_rascunho();
  RAISE EXCEPTION 'FALHOU: chave entregue sem segundo fator';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  sem segundo fator: sem chave';
END $$;
RESET ROLE;

-- perda de sessão (logout, expiração, reset do 2FA): a chave some
DELETE FROM auth.sessions WHERE id = '00000000-0000-4000-8000-00000000aa01';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM private.rascunho_chave WHERE session_id = '00000000-0000-4000-8000-00000000aa01') THEN
    RAISE EXCEPTION 'FALHOU: chave sobreviveu ao fim da sessão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.rascunho_chave WHERE session_id = '00000000-0000-4000-8000-00000000aa02') THEN
    RAISE EXCEPTION 'FALHOU: apagou a chave de outra sessão';
  END IF;
  RAISE NOTICE 'OK  fim da sessão apaga a chave dela (as outras ficam)';
END $$;
ROLLBACK;
