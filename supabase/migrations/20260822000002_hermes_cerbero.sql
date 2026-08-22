-- ─────────────────────────────────────────────────────────────────────────────
-- HERMES v1.1 — Cérbero (guardian de integridade cross-tenant)
--
-- Tabelas: cerbero_incidentes (patrulhas A/B/C), cerbero_url_cache (veredictos
-- de URL 24h), cerbero_quarentena (conteúdo reprovado).
-- RLS: exclusivo super_admin (tabela super_admins — padrão real do projeto).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── cerbero_incidentes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cerbero_incidentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,                       -- NULL = plataforma toda
  patrulha text NOT NULL CHECK (patrulha IN ('dados', 'conteudo', 'hermes')),
  severidade text NOT NULL CHECK (severidade IN ('critico', 'atencao', 'informativo')),
  titulo text NOT NULL,
  evidencia jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostico text,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'resolvido', 'falso_positivo')),
  detectado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

CREATE INDEX IF NOT EXISTS cerbero_incidentes_status_idx ON public.cerbero_incidentes (status, detectado_em);
CREATE INDEX IF NOT EXISTS cerbero_incidentes_patrulha_idx ON public.cerbero_incidentes (patrulha, severidade);

ALTER TABLE public.cerbero_incidentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cerbero_super_admin" ON public.cerbero_incidentes;
CREATE POLICY "cerbero_super_admin" ON public.cerbero_incidentes
  FOR SELECT TO authenticated
  USING (private.eh_super_admin());

-- ── cerbero_url_cache ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cerbero_url_cache (
  url_hash text PRIMARY KEY,            -- sha256 da URL normalizada
  veredicto text NOT NULL CHECK (veredicto IN ('seguro', 'suspeito', 'malicioso')),
  fonte text NOT NULL,                  -- 'heuristica' | 'safe_browsing'
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  verificado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cerbero_url_cache ENABLE ROW LEVEL SECURITY;

-- ── cerbero_quarentena ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cerbero_quarentena (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('url', 'anexo')),
  origem text NOT NULL,                 -- 'chat_lateral' | 'evolucao' | ...
  autor_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  conteudo_hash text NOT NULL,
  motivo text NOT NULL,
  incidente_id uuid REFERENCES public.cerbero_incidentes(id) ON DELETE SET NULL,
  liberado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cerbero_quarentena_status_idx ON public.cerbero_quarentena (liberado, criado_em);

ALTER TABLE public.cerbero_quarentena ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quarentena_super_admin" ON public.cerbero_quarentena;
CREATE POLICY "quarentena_super_admin" ON public.cerbero_quarentena
  FOR SELECT TO authenticated
  USING (private.eh_super_admin());

-- ===========================================================================
-- DOWN
--   DROP TABLE IF EXISTS public.cerbero_quarentena;
--   DROP TABLE IF EXISTS public.cerbero_url_cache;
--   DROP TABLE IF EXISTS public.cerbero_incidentes;
-- ===========================================================================
