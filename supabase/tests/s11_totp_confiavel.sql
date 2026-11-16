-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S11 (F1, opção C; migration 20270414000063).
-- O aplicativo autenticador só vale como segundo fator se o primeiro código
-- dele foi confirmado numa sessão que já tinha passado pelo código por e-mail.
-- As linhas de auth.mfa_factors e auth.sessions imitam o que o Auth grava ao
-- confirmar um código TOTP (fator 'verified', sessão aal2 com factor_id).
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('u',  '00000000-0000-4000-8000-0000000110a1'),
  ('f1', '00000000-0000-4000-8000-0000000110f1'),
  ('f2', '00000000-0000-4000-8000-0000000110f2'),
  ('s1', '00000000-0000-4000-8000-0000000110b1'),
  ('s2', '00000000-0000-4000-8000-0000000110b2'),
  ('s3', '00000000-0000-4000-8000-0000000110b3');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
-- JWT da sessão: aal2 com TOTP confirmado há 5 min
CREATE FUNCTION pg_temp.jwt(p_sessao text, p_aal text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', pg_temp.id('u'), 'role', 'authenticated', 'aal', p_aal, 'session_id', pg_temp.id(p_sessao),
    'amr', json_build_array(
      json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint),
      json_build_object('method', 'totp', 'timestamp', extract(epoch FROM now() - interval '5 minutes')::bigint)))::text, true);
END $$;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('u'), 's11@teste.local');

-- ── 1. Ataque: só a senha, cadastra o próprio aplicativo ────────────────────
INSERT INTO auth.sessions (id, user_id, aal) VALUES (pg_temp.id('s1'), pg_temp.id('u'), 'aal1');
INSERT INTO auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
VALUES (pg_temp.id('f1'), pg_temp.id('u'), 'totp', 'unverified', now(), now());
UPDATE auth.mfa_factors SET status = 'verified' WHERE id = pg_temp.id('f1');
UPDATE auth.sessions SET aal = 'aal2', factor_id = pg_temp.id('f1') WHERE id = pg_temp.id('s1');
SELECT pg_temp.ok((SELECT NOT confiavel FROM private.totp_confiavel WHERE factor_id = pg_temp.id('f1')),
  'aplicativo cadastrado numa sessão sem o código por e-mail fica não confiável');
SELECT pg_temp.jwt('s1', 'aal2');
SELECT pg_temp.ok(private.segundo_fator_valido() IS FALSE,
  'aal2 com esse aplicativo NÃO vale como segundo fator');

-- ── 2. Caminho certo: e-mail primeiro, depois o aplicativo ──────────────────
INSERT INTO auth.sessions (id, user_id, aal) VALUES (pg_temp.id('s2'), pg_temp.id('u'), 'aal1');
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id) VALUES (pg_temp.id('s2'), pg_temp.id('u'));
INSERT INTO auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
VALUES (pg_temp.id('f2'), pg_temp.id('u'), 'totp', 'unverified', now(), now());
UPDATE auth.mfa_factors SET status = 'verified' WHERE id = pg_temp.id('f2');
UPDATE auth.sessions SET aal = 'aal2', factor_id = pg_temp.id('f2') WHERE id = pg_temp.id('s2');
SELECT pg_temp.ok((SELECT confiavel FROM private.totp_confiavel WHERE factor_id = pg_temp.id('f2')),
  'aplicativo cadastrado depois do código por e-mail fica confiável');

-- ── 3. Login seguinte só com o aplicativo confiável ─────────────────────────
INSERT INTO auth.sessions (id, user_id, aal) VALUES (pg_temp.id('s3'), pg_temp.id('u'), 'aal1');
UPDATE auth.sessions SET aal = 'aal2', factor_id = pg_temp.id('f2') WHERE id = pg_temp.id('s3');
SELECT pg_temp.jwt('s3', 'aal2');
SELECT pg_temp.ok(private.segundo_fator_valido(), 'login seguinte com o aplicativo confiável vale como segundo fator');
SELECT pg_temp.ok((SELECT confiavel FROM private.totp_confiavel WHERE factor_id = pg_temp.id('f2')),
  'o uso seguinte não muda a decisão do primeiro');

-- ── 4. A sessão do ataque passa pelo e-mail depois: o aplicativo segue não confiável,
--       mas o e-mail vale ─────────────────────────────────────────────────────
INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id) VALUES (pg_temp.id('s1'), pg_temp.id('u'));
SELECT pg_temp.jwt('s1', 'aal2');
SELECT pg_temp.ok(private.totp_da_sessao_confiavel() IS FALSE, 'a primeira decisão vale: o aplicativo do ataque segue não confiável');
SELECT pg_temp.ok(private.segundo_fator_valido(), 'com o código por e-mail na sessão, o portão abre pelo e-mail');

-- ── 5. Sem sessão no JWT ou aal1: o aplicativo não abre o portão ────────────
SELECT pg_temp.jwt('s3', 'aal1');
SELECT pg_temp.ok(private.segundo_fator_valido() IS FALSE, 'aal1 com o aplicativo confiável não basta');

-- ── 6. Remover o aplicativo apaga o registro ────────────────────────────────
UPDATE auth.sessions SET factor_id = NULL WHERE factor_id = pg_temp.id('f1');
DELETE FROM auth.mfa_factors WHERE id = pg_temp.id('f1');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM private.totp_confiavel WHERE factor_id = pg_temp.id('f1')),
  'aplicativo removido some do registro');

ROLLBACK;
