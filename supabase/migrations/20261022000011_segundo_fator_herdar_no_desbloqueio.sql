-- Desbloqueio da tela herda o segundo fator (RT, 03/10/2026).
--
-- A tela bloqueia após 10 min parada e o desbloqueio refaz o login com a
-- senha (nova sessão). Pela regra "todo login novo pede o código" (ADR 0010),
-- o código voltava a cada 10 min. Agora a sessão nova herda a confirmação da
-- sessão anterior da MESMA pessoa, só dentro da janela de 24 h contada da
-- confirmação ORIGINAL (o prazo não é esticado). Login de verdade (abrir o
-- sistema, outro computador) continua pedindo o código: só quem tem a sessão
-- anterior confirmada no navegador (o id dela vem do token antigo) herda.
CREATE OR REPLACE FUNCTION public.herdar_segundo_fator(p_sessao_anterior uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nova uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  v_quando timestamptz;
BEGIN
  IF v_uid IS NULL OR v_nova IS NULL OR p_sessao_anterior IS NULL OR p_sessao_anterior = v_nova THEN
    RETURN false;
  END IF;
  SELECT s.verificado_em INTO v_quando
    FROM private.segundo_fator_sessao_ok s
   WHERE s.session_id = p_sessao_anterior
     AND s.user_id = v_uid
     AND s.verificado_em > now() - interval '24 hours';
  IF v_quando IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em)
  VALUES (v_nova, v_uid, v_quando)
  ON CONFLICT (session_id) DO UPDATE SET verificado_em = excluded.verificado_em, user_id = excluded.user_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.herdar_segundo_fator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.herdar_segundo_fator(uuid) TO authenticated;
