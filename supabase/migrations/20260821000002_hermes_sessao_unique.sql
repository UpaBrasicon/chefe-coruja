-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 HERMES — fix: unicidade de sessão por (user_id, phone)
--
-- Sem UNIQUE, duas mensagens paralelas do mesmo telefone podiam criar sessões
-- duplicadas em hermes_sessions (a app agora faz upsert via ON CONFLICT).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Remove duplicatas antigas, mantendo a mais recente por (user_id, phone)
DELETE FROM public.hermes_sessions a
USING public.hermes_sessions b
WHERE a.user_id = b.user_id
  AND a.phone = b.phone
  AND a.updated_at < b.updated_at;

-- 2) Unique constraint (upsert depende dela)
DROP INDEX IF EXISTS hermes_sessions_user_phone_uniq;
CREATE UNIQUE INDEX hermes_sessions_user_phone_uniq
  ON public.hermes_sessions (user_id, phone);

-- ===========================================================================
-- DOWN
--   DROP INDEX IF EXISTS hermes_sessions_user_phone_uniq;
-- ===========================================================================
