-- Fase 0, item 19 do BACKLOG.md — política de sessão.
--
-- Decisão do RT (07/10/2026): vários aparelhos por pessoa são permitidos; a
-- sessão acaba com 30 min sem uso (o navegador já faz: bloqueia em 10 min,
-- encerra em 30 — useBloqueioOcioso.ts; e a Supabase encerra pelo servidor,
-- Authentication › Sessions › Inactivity timeout = 30 min); sem tempo máximo.
--
-- Causa das sessões acumuladas (a conta real tinha 19): o DESBLOQUEIO da tela
-- refaz o login com a senha, que abre uma sessão nova e deixava a anterior
-- viva. encerrar_sessao_anterior(), chamada pela sessão nova logo depois do
-- desbloqueio:
--   • passa a chave dos rascunhos cifrados (item 13) da sessão anterior para a
--     nova — o rascunho do aparelho continua legível depois do desbloqueio;
--   • apaga a sessão anterior (o gatilho do item 13 apaga o que sobrar dela;
--     refresh tokens caem em cascata).
-- Só a própria pessoa, só uma sessão dela, nunca a atual; exige o segundo
-- fator da sessão nova (herdado no desbloqueio, ADR 0010).
-- Só aditiva (expand).
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.encerrar_sessao_anterior(uuid);
CREATE OR REPLACE FUNCTION public.encerrar_sessao_anterior(p_sessao_anterior uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_nova uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
BEGIN
  IF v_uid IS NULL OR v_nova IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.exigir_segundo_fator();
  IF p_sessao_anterior IS NULL OR p_sessao_anterior = v_nova
     OR NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = p_sessao_anterior AND s.user_id = v_uid) THEN
    RETURN false;
  END IF;

  -- a chave da sessão anterior passa a ser a desta (descarta a que esta já
  -- tivesse criado: o aparelho cifra com a anterior)
  IF EXISTS (SELECT 1 FROM private.rascunho_chave r WHERE r.session_id = p_sessao_anterior AND r.user_id = v_uid) THEN
    DELETE FROM private.rascunho_chave WHERE session_id = v_nova;
    UPDATE private.rascunho_chave SET session_id = v_nova
     WHERE session_id = p_sessao_anterior AND user_id = v_uid;
  END IF;

  DELETE FROM auth.sessions WHERE id = p_sessao_anterior AND user_id = v_uid;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.encerrar_sessao_anterior(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_sessao_anterior(uuid) TO authenticated;
