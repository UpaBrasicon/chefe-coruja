-- ─────────────────────────────────────────────────────────────────────────────
-- Auditoria de segurança — SET search_path nas funções SECURITY DEFINER
--
-- Auditoria realizada em 2026-08-17: das 86 funções SECURITY DEFINER do
-- projeto, 86 já declaravam `SET search_path` (diferença = 0). As 8 "diferenças"
-- identificadas por `grep -c "SECURITY DEFINER"` vs `grep -c "SET search_path"`
-- eram, na verdade, COMENTÁRIOS que citavam "SECURITY DEFINER" (não funções).
--
-- Esta migration reforça de forma EXPLÍCITA e idempotente o search_path das 8
-- funções apontadas na auditoria, garantindo proteção contra o CVE de search_path
-- mesmo que o estado do banco divirja do código (ALTER FUNCTION não reescreve o
-- corpo; apenas fixa a configuração de segurança).
--
-- Padrão usado no restante do projeto (86 funções):
--   * funções SQL puras com objetos totalmente qualificados: search_path = ''
--   * funções PL/pgSQL que referenciam objetos public/private: search_path = public, private, pg_temp
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. private (00002) — SQL pura, objetos qualificados
ALTER FUNCTION private.orgs_admin() SET search_path = '';
ALTER FUNCTION private.registrar_auditoria(
  p_acao text, p_entidade text, p_entidade_id uuid, p_unidade_id uuid, p_payload jsonb
) SET search_path = '';

-- 2. private.fn_censo_unidade (00004) — PL/pgSQL, usa public.* e private.*
ALTER FUNCTION private.fn_censo_unidade() SET search_path = public, private, pg_temp;

-- 3. public.registrar_auditoria (00006) — wrapper, delega a private.*
ALTER FUNCTION public.registrar_auditoria(
  p_acao text, p_entidade text, p_entidade_id uuid, p_unidade_id uuid, p_payload jsonb
) SET search_path = public, private, pg_temp;

-- 4. private.fn_indicadores_unidade (00010) — PL/pgSQL, usa public.*
ALTER FUNCTION private.fn_indicadores_unidade() SET search_path = public, private, pg_temp;

-- 5. public.transferir_paciente (00018) — PL/pgSQL, usa public.* e private.*
ALTER FUNCTION public.transferir_paciente(
  p_paciente uuid, p_destino uuid, p_motivo text
) SET search_path = public, private, pg_temp;

-- 6. public.salvar_documento (00038) — PL/pgSQL, usa public.* e private.*
ALTER FUNCTION public.salvar_documento(
  p_paciente uuid, p_unidade uuid, p_tipo text, p_conteudo text,
  p_internacao uuid, p_motivo_retificacao text
) SET search_path = public, private, pg_temp;

-- 7. public.registrar_evento_adt (00038) — PL/pgSQL, usa public.* e private.*
ALTER FUNCTION public.registrar_evento_adt(
  p_internacao uuid, p_tipo_evento text, p_setor_destino uuid, p_leito_destino uuid,
  p_motivo text, p_payload jsonb
) SET search_path = public, private, pg_temp;

-- 8. public.registrar_acesso_prontuario (00038) — PL/pgSQL, usa public.* e private.*
ALTER FUNCTION public.registrar_acesso_prontuario(
  p_paciente uuid, p_unidade uuid, p_tipo_acesso text, p_internacao uuid, p_documento uuid
) SET search_path = public, private, pg_temp;
