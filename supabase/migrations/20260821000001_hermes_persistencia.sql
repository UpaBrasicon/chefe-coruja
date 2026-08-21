-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 HERMES — persistência do agente de WhatsApp
--
-- hermes_sessions : contexto de conversa (janela 20 msgs ou 2h — a expiração
--                   é feita pela aplicação; aqui só o armazenamento).
-- hermes_audit_log: trilha de auditoria de toda mensagem/tool do Hermes.
--
-- SEGURANÇA: RLS ATIVO e SEM NENHUMA POLÍTICA — acesso NEGADO a anon e
-- authenticated. Apenas service_role (bypassa RLS) usa estas tabelas.
-- Nenhum dado clínico de paciente trafega por aqui (regra 4 do Hermes).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── hermes_sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  phone text NOT NULL,                          -- wa_id (E.164 sem '+')
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,  -- histórico da janela
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hermes_sessions_phone_idx ON public.hermes_sessions (phone);
CREATE INDEX IF NOT EXISTS hermes_sessions_user_idx ON public.hermes_sessions (user_id);

ALTER TABLE public.hermes_sessions ENABLE ROW LEVEL SECURITY;

-- ── hermes_audit_log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                                 -- null quando número não cadastrado
  phone text NOT NULL,                          -- wa_id (E.164 sem '+')
  direction text NOT NULL CHECK (direction IN ('in', 'out', 'tool')),
  tool_name text,
  tool_args jsonb,
  tool_result_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hermes_audit_phone_idx ON public.hermes_audit_log (phone);
CREATE INDEX IF NOT EXISTS hermes_audit_created_idx ON public.hermes_audit_log (created_at);

ALTER TABLE public.hermes_audit_log ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- DOWN
--   DROP TABLE IF EXISTS public.hermes_audit_log;
--   DROP TABLE IF EXISTS public.hermes_sessions;
-- ===========================================================================
