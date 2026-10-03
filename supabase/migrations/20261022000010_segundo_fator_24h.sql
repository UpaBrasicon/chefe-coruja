-- Segundo fator: a confirmação da sessão (código por email ou dispositivo
-- confiável) passa a valer 24 h, e não 12 h. Pedido do RT em 03/10/2026
-- ("tem que ser pelo menos 24 h"). O TOTP já valia 24 h desde a fase 1.
-- O código enviado ao email continua valendo 10 minutos (é o prazo para
-- digitá-lo) e o dispositivo confiável, 30 dias.
CREATE OR REPLACE FUNCTION private.segundo_fator_sessao_valida()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM private.segundo_fator_sessao_ok s
    WHERE s.user_id = auth.uid()
      AND s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid
      AND s.verificado_em > now() - interval '24 hours'
  );
$function$;

REVOKE EXECUTE ON FUNCTION private.segundo_fator_sessao_valida() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.segundo_fator_sessao_valida() TO authenticated;
