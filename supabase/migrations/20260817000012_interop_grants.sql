-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4A fix — grants da outbox para o gatilho funcionar com service_role
--
-- O gatilho trg_outbox_alta chama private.enfileirar_documento() como o
-- usuário que fez o UPDATE (service_role no teste/4B). Sem USAGE/EXECUTE
-- explícitos, o gatilho falha com "permission denied for schema private".
-- ─────────────────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.enfileirar_documento(uuid, text, uuid, jsonb) TO service_role;

-- ===========================================================================
-- DOWN
--   REVOKE EXECUTE ON FUNCTION private.enfileirar_documento(uuid, text, uuid, jsonb) FROM service_role;
--   REVOKE USAGE ON SCHEMA private FROM service_role;
-- ===========================================================================
