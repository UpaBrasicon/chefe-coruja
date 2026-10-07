-- Fase 0, item 13 do BACKLOG.md — rascunho clínico cifrado no navegador.
--
-- Os rascunhos (evolução, prescrição, documentos, nota da prancheta) ficam no
-- localStorage para sobreviver a recarga e queda; até aqui em TEXTO CLARO, com
-- nome, nascimento, alergias e diagnóstico do paciente. Agora o navegador cifra
-- (AES-256-GCM) com uma chave POR SESSÃO de login, guardada aqui:
--   • chave_rascunho(): devolve a chave da sessão atual (cria na primeira vez);
--   • o gatilho em auth.sessions apaga a chave quando a sessão acaba (logout,
--     expiração, reset do 2FA) — o rascunho que sobrou no aparelho vira texto
--     ilegível para sempre;
--   • chave nunca sai para outra sessão nem para outro usuário.
-- Só aditiva (expand): nada existente muda.
--
-- ROLLBACK: DROP TRIGGER IF EXISTS rascunho_chave_fim_sessao ON auth.sessions;
--   DROP FUNCTION IF EXISTS public.chave_rascunho(), private.rascunho_chave_fim_sessao();
--   DROP TABLE IF EXISTS private.rascunho_chave;
CREATE TABLE IF NOT EXISTS private.rascunho_chave (
  session_id uuid PRIMARY KEY,
  user_id    uuid NOT NULL,
  chave      bytea NOT NULL DEFAULT extensions.gen_random_bytes(32),
  criado_em  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.rascunho_chave FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chave_rascunho()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sessao uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  v_chave bytea;
BEGIN
  IF v_uid IS NULL OR v_sessao IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.exigir_segundo_fator();
  -- faxina oportunista: chave de sessão que não existe mais
  DELETE FROM private.rascunho_chave r
   WHERE r.criado_em < now() - interval '1 day'
     AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = r.session_id);
  INSERT INTO private.rascunho_chave (session_id, user_id) VALUES (v_sessao, v_uid)
  ON CONFLICT (session_id) DO NOTHING;
  SELECT r.chave INTO v_chave FROM private.rascunho_chave r
   WHERE r.session_id = v_sessao AND r.user_id = v_uid;
  IF v_chave IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN encode(v_chave, 'base64');
END; $$;
REVOKE ALL ON FUNCTION public.chave_rascunho() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chave_rascunho() TO authenticated;

CREATE OR REPLACE FUNCTION private.rascunho_chave_fim_sessao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM private.rascunho_chave WHERE session_id = OLD.id;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS rascunho_chave_fim_sessao ON auth.sessions;
CREATE TRIGGER rascunho_chave_fim_sessao
  AFTER DELETE ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION private.rascunho_chave_fim_sessao();
