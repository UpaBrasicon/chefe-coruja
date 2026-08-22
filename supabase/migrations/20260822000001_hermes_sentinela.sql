-- ─────────────────────────────────────────────────────────────────────────────
-- HERMES v1.1 — Sentinela de Escala (Chronos)
--
-- Tabela de alertas de outlier de escala, visível apenas a gestor/admin da
-- unidade (via vinculos — padrão real do projeto; NÃO existe usuarios_organizacoes).
-- As métricas e a detecção (IQR, mínimo 8 plantões) são calculadas pelo job
-- BullMQ semanal (código TS) — aqui fica só a persistência + RLS.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chronos_alertas_escala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  medico_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  janela text NOT NULL CHECK (janela IN ('30d', '90d')),
  metrica text NOT NULL CHECK (metrica IN (
    'taxa_repasse', 'faltas', 'cancelamento_tardio', 'trocas_iniciadas', 'concentracao_destino'
  )),
  valor numeric NOT NULL,
  mediana_unidade numeric NOT NULL,
  limite_outlier numeric NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb, -- ex.: lista de datas dos repasses
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'visto', 'justificado', 'em_acompanhamento')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chronos_alertas_unidade_idx ON public.chronos_alertas_escala (unidade_id, janela, metrica);
CREATE INDEX IF NOT EXISTS chronos_alertas_medico_idx ON public.chronos_alertas_escala (medico_id);

ALTER TABLE public.chronos_alertas_escala ENABLE ROW LEVEL SECURITY;

-- Só gestor/admin da unidade vê (papel via vinculos — padrão do projeto)
DROP POLICY IF EXISTS "chronos_alertas_gestor" ON public.chronos_alertas_escala;
CREATE POLICY "chronos_alertas_gestor" ON public.chronos_alertas_escala
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR (
      unidade_id IN (
        SELECT v.unidade_id
        FROM public.vinculos v
        WHERE v.perfil_id = private.meu_perfil_id()
          AND v.ativo
          AND v.papel IN ('gestor', 'admin')
      )
    )
  );

-- Nenhuma escrita por usuário autenticado — apenas o job (service_role) insere.

-- ===========================================================================
-- DOWN
--   DROP POLICY IF EXISTS "chronos_alertas_gestor" ON public.chronos_alertas_escala;
--   DROP TABLE IF EXISTS public.chronos_alertas_escala;
-- ===========================================================================
