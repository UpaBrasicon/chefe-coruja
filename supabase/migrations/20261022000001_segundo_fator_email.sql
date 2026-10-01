-- ════════════════════════════════════════════════════════════════════════════
-- Segundo fator por EMAIL (OTP) + dispositivo confiável.
--
-- Complementa o TOTP (ADR 0010): o gate `private.segundo_fator_valido()` passa a
-- aceitar DUAS provas — `aal2`+TOTP (como antes) OU a sessão atual verificada por
-- código de email. Flag mestre continua `exigir_segundo_fator`.
--
-- Fluxo: dispositivo novo → Edge Function `enviar-codigo-2fa` manda o código ao
-- email → `verificar_codigo_2fa` valida e marca a SESSÃO (claim `session_id` do
-- JWT) como aprovada; com "confiar neste dispositivo", emite um token (30 dias)
-- que pula o email em logins futuros desse aparelho.
--
-- Reversão consciente da recusa do ADR 0010 ("confiar no aparelho"): mitigado
-- com dispositivos REVOGÁVEIS (o usuário corta um aparelho perdido na hora) e
-- token guardado só como hash.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tabelas ─────────────────────────────────────────────────────────────────
-- Código OTP por email: um ativo por usuário (hash, nunca o código em claro).
CREATE TABLE IF NOT EXISTS private.segundo_fator_email_codigo (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL,
  expira_em  timestamptz NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

-- Dispositivos confiáveis: token só como hash; expira e é revogável.
CREATE TABLE IF NOT EXISTS public.dispositivos_confiaveis (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  rotulo     text,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  expira_em  timestamptz NOT NULL,
  ultimo_uso timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dispositivos_confiaveis_user ON public.dispositivos_confiaveis (user_id);

-- Sessões que passaram pelo 2º fator por email (não são aal2).
CREATE TABLE IF NOT EXISTS private.segundo_fator_sessao_ok (
  session_id    uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verificado_em timestamptz NOT NULL DEFAULT now()
);

-- ── RLS: cada um vê/remove só os próprios dispositivos ───────────────────────
ALTER TABLE public.dispositivos_confiaveis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispositivos_confiaveis FROM anon, authenticated;
GRANT SELECT, DELETE ON public.dispositivos_confiaveis TO authenticated;  -- INSERT só via RPC
DROP POLICY IF EXISTS dispositivos_confiaveis_proprios ON public.dispositivos_confiaveis;
CREATE POLICY dispositivos_confiaveis_proprios ON public.dispositivos_confiaveis
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS dispositivos_confiaveis_remover ON public.dispositivos_confiaveis;
CREATE POLICY dispositivos_confiaveis_remover ON public.dispositivos_confiaveis
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Gate: sessão atual verificada por email? ────────────────────────────────
CREATE OR REPLACE FUNCTION private.segundo_fator_sessao_valida()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.segundo_fator_sessao_ok s
    WHERE s.user_id = auth.uid()
      AND s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid
  );
$$;

-- Redefine o gate: aal2+TOTP (<24h) OU sessão verificada por email.
CREATE OR REPLACE FUNCTION private.segundo_fator_valido()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (auth.jwt()->>'aal' = 'aal2' AND private.ultima_verificacao_totp() > now() - interval '24 hours')
    OR private.segundo_fator_sessao_valida(),
    false);
$$;

-- ── RPC: solicitar código (gera + guarda hash; retorna o código em claro só
-- para a Edge Function enviar por email). Cooldown 60s. ──────────────────────
CREATE OR REPLACE FUNCTION public.solicitar_codigo_2fa()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_codigo text; v_ultimo timestamptz; v_uid uuid := auth.uid(); v_b bytea;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  SELECT enviado_em INTO v_ultimo FROM private.segundo_fator_email_codigo WHERE user_id = v_uid;
  IF v_ultimo IS NOT NULL AND v_ultimo > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Aguarde um momento antes de pedir outro código.';
  END IF;
  -- 6 dígitos cripto-aleatórios (000000–999999), sempre não-negativo.
  v_b := extensions.gen_random_bytes(3);
  v_codigo := lpad(((get_byte(v_b, 0)::int * 65536 + get_byte(v_b, 1) * 256 + get_byte(v_b, 2)) % 1000000)::text, 6, '0');
  INSERT INTO private.segundo_fator_email_codigo (user_id, codigo_hash, expira_em, tentativas, enviado_em)
  VALUES (v_uid, encode(extensions.digest(v_codigo || v_uid::text, 'sha256'), 'hex'), now() + interval '10 minutes', 0, now())
  ON CONFLICT (user_id) DO UPDATE
    SET codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0, enviado_em = now();
  RETURN v_codigo;
END; $$;

-- ── RPC: verificar código. Marca a sessão; se p_confiar, emite device token. ─
CREATE OR REPLACE FUNCTION public.verificar_codigo_2fa(p_codigo text, p_confiar boolean DEFAULT false, p_rotulo text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_uid uuid := auth.uid(); v_session uuid; v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  v_session := nullif(auth.jwt()->>'session_id', '')::uuid;
  IF v_session IS NULL THEN RAISE EXCEPTION 'Sessão sem identificador; refaça o login.'; END IF;
  SELECT * INTO r FROM private.segundo_fator_email_codigo WHERE user_id = v_uid;
  IF r IS NULL OR r.expira_em < now() THEN RAISE EXCEPTION 'Código expirado. Peça um novo.'; END IF;
  IF r.tentativas >= 5 THEN RAISE EXCEPTION 'Muitas tentativas. Peça um novo código.'; END IF;
  IF encode(extensions.digest(p_codigo || v_uid::text, 'sha256'), 'hex') <> r.codigo_hash THEN
    UPDATE private.segundo_fator_email_codigo SET tentativas = tentativas + 1 WHERE user_id = v_uid;
    RAISE EXCEPTION 'Código não confere.';
  END IF;
  DELETE FROM private.segundo_fator_email_codigo WHERE user_id = v_uid;
  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id)
    VALUES (v_session, v_uid)
    ON CONFLICT (session_id) DO UPDATE SET verificado_em = now(), user_id = excluded.user_id;
  IF p_confiar THEN
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.dispositivos_confiaveis (user_id, token_hash, rotulo, expira_em)
      VALUES (v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'),
              left(coalesce(nullif(p_rotulo, ''), 'Dispositivo'), 80), now() + interval '30 days');
    RETURN v_token;
  END IF;
  RETURN '';
END; $$;

-- ── RPC: dispositivo confiável → marca a sessão (pula o email) ───────────────
CREATE OR REPLACE FUNCTION public.verificar_dispositivo_2fa(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_uid uuid := auth.uid(); v_session uuid;
BEGIN
  IF v_uid IS NULL OR p_token IS NULL OR length(p_token) < 32 THEN RETURN false; END IF;
  v_session := nullif(auth.jwt()->>'session_id', '')::uuid;
  IF v_session IS NULL THEN RETURN false; END IF;
  SELECT * INTO r FROM public.dispositivos_confiaveis
    WHERE user_id = v_uid
      AND token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      AND expira_em > now();
  IF r IS NULL THEN RETURN false; END IF;
  UPDATE public.dispositivos_confiaveis SET ultimo_uso = now() WHERE id = r.id;
  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id)
    VALUES (v_session, v_uid)
    ON CONFLICT (session_id) DO UPDATE SET verificado_em = now(), user_id = excluded.user_id;
  RETURN true;
END; $$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION private.segundo_fator_sessao_valida() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.segundo_fator_sessao_valida() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.solicitar_codigo_2fa(), public.verificar_codigo_2fa(text, boolean, text),
  public.verificar_dispositivo_2fa(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_codigo_2fa(), public.verificar_codigo_2fa(text, boolean, text),
  public.verificar_dispositivo_2fa(text) TO authenticated;
