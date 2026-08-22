-- ─────────────────────────────────────────────────────────────────────────────
-- GAVIÃO v2 — relatório semanal in-app
--
-- gaviao_relatorios_semanais: relatório gerado pelo job semanal do Gavião,
-- visível ao admin/gestor na aba Gavião.
-- Resumo agregado (números, NUNCA dado de paciente).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gaviao_relatorios_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb, -- contagens/agregados da semana
  detalhes jsonb NOT NULL DEFAULT '[]'::jsonb, -- lista de incidentes/alertas (IDs + títulos)
  gerado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gaviao_relatorios_periodo_idx
  ON public.gaviao_relatorios_semanais (periodo_inicio DESC);

ALTER TABLE public.gaviao_relatorios_semanais ENABLE ROW LEVEL SECURITY;

-- Visível a super_admin (tudo) e gestor/admin (resumo sem detalhes de
-- segurança — só o super vê incidentes do Cérbero)
DROP POLICY IF EXISTS "gaviao_relatorios_super" ON public.gaviao_relatorios_semanais;
CREATE POLICY "gaviao_relatorios_super" ON public.gaviao_relatorios_semanais
  FOR SELECT TO authenticated
  USING (private.eh_super_admin());

-- ===========================================================================
-- DOWN
--   DROP POLICY IF EXISTS "gaviao_relatorios_super" ON public.gaviao_relatorios_semanais;
--   DROP TABLE IF EXISTS public.gaviao_relatorios_semanais;
-- ===========================================================================
