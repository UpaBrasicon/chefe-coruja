-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — RPCs públicas (wrappers seguros para o cliente)
-- O schema `private` não é exposto pelo PostgREST; estes wrappers no schema
-- `public` (SECURITY DEFINER) liberam ao cliente apenas o que for seguro.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.papel_na_unidade(unidade uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.papel_na_unidade(unidade);
$$;

CREATE OR REPLACE FUNCTION public.eh_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.eh_super_admin();
$$;

CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_acao         text,
  p_entidade     text,
  p_entidade_id  uuid DEFAULT NULL,
  p_unidade_id   uuid DEFAULT NULL,
  p_payload      jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.registrar_auditoria(p_acao, p_entidade, p_entidade_id, p_unidade_id, p_payload);
$$;

GRANT EXECUTE ON FUNCTION public.papel_na_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria(text, text, uuid, uuid, jsonb) TO authenticated;
