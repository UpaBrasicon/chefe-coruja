-- ════════════════════════════════════════════════════════════════════════════
-- Correções de segurança (revisão de 02/10/2026) sobre 20261022000001 e
-- 20261020000001.
--
-- 1. 2FA por e-mail — o código voltava para quem chamava. solicitar_codigo_2fa()
--    estava liberada para `authenticated` e devolve o código em claro: com só a
--    senha roubada, o atacante pedia o código pela API e o verificava, sem ver o
--    e-mail. Agora a função recebe o usuário e só o `service_role` executa (a
--    Edge Function enviar-codigo-2fa resolve o usuário pelo token e chama com a
--    chave secreta). Também limita a 5 códigos por hora.
-- 2. 2FA por e-mail — o limite de 5 tentativas nunca contava: o UPDATE do
--    contador vinha seguido de RAISE, que desfazia o UPDATE. Agora o código
--    errado devolve NULL (a transação confirma o contador) e, na 5ª tentativa
--    errada, o código é apagado.
-- 3. Sessão verificada por e-mail vale 12 h (antes não expirava).
-- 4. Funções do Hermes que confiam no p_perfil recebido estavam executáveis por
--    qualquer usuário logado (o REVOKE era só de PUBLIC; o Supabase concede a
--    `authenticated` por padrão). O Hermes usa a chave de serviço: tiramos de
--    anon/authenticated e deixamos só service_role.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 e 2: 2FA por e-mail ───────────────────────────────────────────────────
ALTER TABLE private.segundo_fator_email_codigo
  ADD COLUMN IF NOT EXISTS pedidos_na_hora int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hora_inicio timestamptz NOT NULL DEFAULT now();

DROP FUNCTION IF EXISTS public.solicitar_codigo_2fa();
CREATE OR REPLACE FUNCTION public.solicitar_codigo_2fa(p_user uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_codigo text; r private.segundo_fator_email_codigo; v_b bytea; v_pedidos int;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;
  SELECT * INTO r FROM private.segundo_fator_email_codigo WHERE user_id = p_user;
  IF r.enviado_em IS NOT NULL AND r.enviado_em > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Aguarde um momento antes de pedir outro código.';
  END IF;
  v_pedidos := CASE WHEN r.hora_inicio IS NULL OR r.hora_inicio < now() - interval '1 hour' THEN 0 ELSE r.pedidos_na_hora END;
  IF v_pedidos >= 5 THEN
    RAISE EXCEPTION 'Aguarde um momento antes de pedir outro código: limite de 5 códigos por hora.';
  END IF;
  v_b := extensions.gen_random_bytes(3);
  v_codigo := lpad(((get_byte(v_b, 0)::int * 65536 + get_byte(v_b, 1) * 256 + get_byte(v_b, 2)) % 1000000)::text, 6, '0');
  INSERT INTO private.segundo_fator_email_codigo (user_id, codigo_hash, expira_em, tentativas, enviado_em, pedidos_na_hora, hora_inicio)
  VALUES (p_user, encode(extensions.digest(v_codigo || p_user::text, 'sha256'), 'hex'), now() + interval '10 minutes', 0, now(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0, enviado_em = now(),
        pedidos_na_hora = v_pedidos + 1,
        hora_inicio = CASE WHEN v_pedidos = 0 THEN now() ELSE private.segundo_fator_email_codigo.hora_inicio END;
  RETURN v_codigo;
END; $$;
REVOKE ALL ON FUNCTION public.solicitar_codigo_2fa(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_codigo_2fa(uuid) TO service_role;

-- Código errado devolve NULL (não RAISE) para o contador de tentativas ficar.
CREATE OR REPLACE FUNCTION public.verificar_codigo_2fa(p_codigo text, p_confiar boolean DEFAULT false, p_rotulo text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_uid uuid := auth.uid(); v_session uuid; v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  v_session := nullif(auth.jwt()->>'session_id', '')::uuid;
  IF v_session IS NULL THEN RAISE EXCEPTION 'Sessão sem identificador; refaça o login.'; END IF;
  SELECT * INTO r FROM private.segundo_fator_email_codigo WHERE user_id = v_uid FOR UPDATE;
  IF r IS NULL OR r.expira_em < now() THEN RAISE EXCEPTION 'Código expirado. Peça um novo.'; END IF;
  IF r.tentativas >= 5 THEN RAISE EXCEPTION 'Muitas tentativas. Peça um novo código.'; END IF;
  IF encode(extensions.digest(coalesce(p_codigo, '') || v_uid::text, 'sha256'), 'hex') <> r.codigo_hash THEN
    IF r.tentativas + 1 >= 5 THEN
      -- 5ª tentativa errada: o código morre (expira já), e só um novo resolve
      UPDATE private.segundo_fator_email_codigo SET tentativas = 5, expira_em = now() WHERE user_id = v_uid;
    ELSE
      UPDATE private.segundo_fator_email_codigo SET tentativas = tentativas + 1 WHERE user_id = v_uid;
    END IF;
    RETURN NULL;  -- "código não confere": a tela trata data === null
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
REVOKE ALL ON FUNCTION public.verificar_codigo_2fa(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificar_codigo_2fa(text, boolean, text) TO authenticated;

-- ── 3: sessão verificada vale 12 h ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.segundo_fator_sessao_valida()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.segundo_fator_sessao_ok s
    WHERE s.user_id = auth.uid()
      AND s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid
      AND s.verificado_em > now() - interval '12 hours'
  );
$$;

-- ── 4: funções do Hermes só para service_role ───────────────────────────────
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'hermes\_%' OR p.proname = 'confirmar_vinculo_hermes')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
