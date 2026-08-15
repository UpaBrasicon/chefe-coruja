-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 — RLS do motor de prescrição
-- Admin NUNCA lê identidade de paciente (só vw_indicadores_unidade).
-- Plantonista vê apenas pacientes sob seu cuidado (cuidados_plantonistas).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── medicamentos (leitura para todos; escrita só super) ──────────────────────
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medicamentos_select" ON public.medicamentos;
CREATE POLICY "medicamentos_select" ON public.medicamentos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "medicamentos_insert" ON public.medicamentos;
CREATE POLICY "medicamentos_insert" ON public.medicamentos
  FOR INSERT TO authenticated WITH CHECK (private.eh_super_admin());
DROP POLICY IF EXISTS "medicamentos_update" ON public.medicamentos;
CREATE POLICY "medicamentos_update" ON public.medicamentos
  FOR UPDATE TO authenticated USING (private.eh_super_admin()) WITH CHECK (private.eh_super_admin());
DROP POLICY IF EXISTS "medicamentos_delete" ON public.medicamentos;
CREATE POLICY "medicamentos_delete" ON public.medicamentos
  FOR DELETE TO authenticated USING (private.eh_super_admin());

-- ── pacientes ────────────────────────────────────────────────────────────────
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pacientes_select" ON public.pacientes;
CREATE POLICY "pacientes_select" ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.cuidados_plantonistas c
      WHERE c.paciente_id = pacientes.id AND c.perfil_id = private.meu_perfil_id() AND c.ativo
    )
  );

DROP POLICY IF EXISTS "pacientes_insert" ON public.pacientes;
CREATE POLICY "pacientes_insert" ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) IN ('gestor', 'plantonista')
  );

DROP POLICY IF EXISTS "pacientes_update" ON public.pacientes;
CREATE POLICY "pacientes_update" ON public.pacientes
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- Sem DELETE: desativação via ativo = false.

-- ── cuidados_plantonistas ────────────────────────────────────────────────────
ALTER TABLE public.cuidados_plantonistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuidados_select" ON public.cuidados_plantonistas;
CREATE POLICY "cuidados_select" ON public.cuidados_plantonistas
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "cuidados_insert" ON public.cuidados_plantonistas;
CREATE POLICY "cuidados_insert" ON public.cuidados_plantonistas
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (perfil_id = private.meu_perfil_id() AND private.papel_na_unidade(unidade_id) = 'plantonista')
  );

DROP POLICY IF EXISTS "cuidados_update" ON public.cuidados_plantonistas;
CREATE POLICY "cuidados_update" ON public.cuidados_plantonistas
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "cuidados_delete" ON public.cuidados_plantonistas;
CREATE POLICY "cuidados_delete" ON public.cuidados_plantonistas
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── prescricoes ──────────────────────────────────────────────────────────────
ALTER TABLE public.prescricoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescricoes_select" ON public.prescricoes;
CREATE POLICY "prescricoes_select" ON public.prescricoes
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR medico_id = private.meu_perfil_id()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "prescricoes_insert" ON public.prescricoes;
CREATE POLICY "prescricoes_insert" ON public.prescricoes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (medico_id = private.meu_perfil_id() AND private.papel_na_unidade(unidade_id) = 'plantonista')
  );

DROP POLICY IF EXISTS "prescricoes_update" ON public.prescricoes;
CREATE POLICY "prescricoes_update" ON public.prescricoes
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR medico_id = private.meu_perfil_id()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (medico_id = private.meu_perfil_id() AND private.papel_na_unidade(unidade_id) = 'plantonista')
  );

DROP POLICY IF EXISTS "prescricoes_delete" ON public.prescricoes;
CREATE POLICY "prescricoes_delete" ON public.prescricoes
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR medico_id = private.meu_perfil_id()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── prescricao_itens (herda visibilidade da prescrição) ─────────────────────
ALTER TABLE public.prescricao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescricao_itens_select" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_select" ON public.prescricao_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR p.medico_id = private.meu_perfil_id()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
        )
    )
  );

DROP POLICY IF EXISTS "prescricao_itens_insert" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_insert" ON public.prescricao_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (p.medico_id = private.meu_perfil_id() AND private.papel_na_unidade(p.unidade_id) = 'plantonista')
        )
    )
  );

DROP POLICY IF EXISTS "prescricao_itens_update" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_update" ON public.prescricao_itens
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR p.medico_id = private.meu_perfil_id()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (p.medico_id = private.meu_perfil_id() AND private.papel_na_unidade(p.unidade_id) = 'plantonista')
        )
    )
  );

DROP POLICY IF EXISTS "prescricao_itens_delete" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_delete" ON public.prescricao_itens
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR p.medico_id = private.meu_perfil_id()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
        )
    )
  );

-- ── assinaturas ──────────────────────────────────────────────────────────────
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assinaturas_select" ON public.assinaturas;
CREATE POLICY "assinaturas_select" ON public.assinaturas
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR medico_id = private.meu_perfil_id()
  );

DROP POLICY IF EXISTS "assinaturas_insert" ON public.assinaturas;
CREATE POLICY "assinaturas_insert" ON public.assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR (medico_id = private.meu_perfil_id() AND private.papel_na_unidade((SELECT unidade_id FROM public.prescricoes WHERE id = prescricao_id)) = 'plantonista')
  );

DROP POLICY IF EXISTS "assinaturas_update" ON public.assinaturas;
CREATE POLICY "assinaturas_update" ON public.assinaturas
  FOR UPDATE TO authenticated
  USING (private.eh_super_admin() OR medico_id = private.meu_perfil_id())
  WITH CHECK (private.eh_super_admin() OR medico_id = private.meu_perfil_id());

DROP POLICY IF EXISTS "assinaturas_delete" ON public.assinaturas;
CREATE POLICY "assinaturas_delete" ON public.assinaturas
  FOR DELETE TO authenticated
  USING (private.eh_super_admin());

-- ── receitas_retidas (append-only) ───────────────────────────────────────────
ALTER TABLE public.receitas_retidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receitas_retidas_select" ON public.receitas_retidas;
CREATE POLICY "receitas_retidas_select" ON public.receitas_retidas
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = receitas_retidas.prescricao_id
        AND private.papel_na_unidade(p.unidade_id) = 'gestor'
    )
  );

-- Escrita via Edge Function (SECURITY DEFINER) ou gestor da unidade.
DROP POLICY IF EXISTS "receitas_retidas_insert" ON public.receitas_retidas;
CREATE POLICY "receitas_retidas_insert" ON public.receitas_retidas
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = receitas_retidas.prescricao_id
        AND private.papel_na_unidade(p.unidade_id) = 'gestor'
    )
  );

-- ── notificacoes_whatsapp (escrita via Edge Function) ────────────────────────
ALTER TABLE public.notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_whats_select" ON public.notificacoes_whatsapp;
CREATE POLICY "notif_whats_select" ON public.notificacoes_whatsapp
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = notificacoes_whatsapp.prescricao_id
        AND private.papel_na_unidade(p.unidade_id) = 'gestor'
    )
  );

-- ── configuracoes_unidade ────────────────────────────────────────────────────
ALTER TABLE public.configuracoes_unidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_unidade_select" ON public.configuracoes_unidade;
CREATE POLICY "config_unidade_select" ON public.configuracoes_unidade
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = configuracoes_unidade.unidade_id
        AND private.eh_admin_da_organizacao(u.organizacao_id)
    )
  );

DROP POLICY IF EXISTS "config_unidade_insert" ON public.configuracoes_unidade;
CREATE POLICY "config_unidade_insert" ON public.configuracoes_unidade
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = configuracoes_unidade.unidade_id
        AND private.eh_admin_da_organizacao(u.organizacao_id)
    )
  );

DROP POLICY IF EXISTS "config_unidade_update" ON public.configuracoes_unidade;
CREATE POLICY "config_unidade_update" ON public.configuracoes_unidade
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = configuracoes_unidade.unidade_id
        AND private.eh_admin_da_organizacao(u.organizacao_id)
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = configuracoes_unidade.unidade_id
        AND private.eh_admin_da_organizacao(u.organizacao_id)
    )
  );

-- ── links_publicos_receita (resolução pública via Edge Function) ─────────────
ALTER TABLE public.links_publicos_receita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "links_receita_select" ON public.links_publicos_receita;
CREATE POLICY "links_receita_select" ON public.links_publicos_receita
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = links_publicos_receita.prescricao_id
        AND (
          p.medico_id = private.meu_perfil_id()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
        )
    )
  );

DROP POLICY IF EXISTS "links_receita_insert" ON public.links_publicos_receita;
CREATE POLICY "links_receita_insert" ON public.links_publicos_receita
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = links_publicos_receita.prescricao_id
        AND (
          p.medico_id = private.meu_perfil_id()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
        )
    )
  );

DROP POLICY IF EXISTS "links_receita_delete" ON public.links_publicos_receita;
CREATE POLICY "links_receita_delete" ON public.links_publicos_receita
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = links_publicos_receita.prescricao_id
        AND (
          p.medico_id = private.meu_perfil_id()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
        )
    )
  );

-- ── View agregada para admin (sem identidade) ───────────────────────────────
CREATE OR REPLACE FUNCTION private.fn_indicadores_unidade()
RETURNS TABLE (
  unidade_id uuid,
  unidade_nome text,
  total_pacientes bigint,
  prescricoes_assinadas bigint,
  prescricoes_rascunho bigint,
  receitas_retidas bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_super boolean;
BEGIN
  v_super := private.eh_super_admin();

  RETURN QUERY
  WITH c AS (
    SELECT
      u.id AS uid,
      u.nome AS unome,
      count(DISTINCT pa.id) AS t_pacientes,
      count(pr.id) FILTER (WHERE pr.status = 'assinada') AS pr_assinadas,
      count(pr.id) FILTER (WHERE pr.status = 'rascunho') AS pr_rascunho,
      count(DISTINCT rr.id) AS t_retidas
    FROM public.unidades u
    LEFT JOIN public.pacientes pa ON pa.unidade_id = u.id AND pa.ativo
    LEFT JOIN public.prescricoes pr ON pr.unidade_id = u.id
    LEFT JOIN public.receitas_retidas rr ON rr.prescricao_id = pr.id
    WHERE v_super
       OR u.id IN (SELECT private.unidades_admin())
       OR u.id IN (SELECT private.unidades_gestor_plantonista())
    GROUP BY u.id, u.nome
  )
  SELECT
    c.uid,
    c.unome,
    CASE WHEN c.t_pacientes   BETWEEN 1 AND 4 THEN NULL ELSE c.t_pacientes END,
    CASE WHEN c.pr_assinadas  BETWEEN 1 AND 4 THEN NULL ELSE c.pr_assinadas END,
    CASE WHEN c.pr_rascunho   BETWEEN 1 AND 4 THEN NULL ELSE c.pr_rascunho END,
    CASE WHEN c.t_retidas     BETWEEN 1 AND 4 THEN NULL ELSE c.t_retidas END
  FROM c
  ORDER BY c.unome;
END;
$$;

CREATE OR REPLACE VIEW public.vw_indicadores_unidade AS
  SELECT * FROM private.fn_indicadores_unidade();

GRANT SELECT ON public.vw_indicadores_unidade TO authenticated;
GRANT EXECUTE ON FUNCTION private.fn_indicadores_unidade() TO authenticated;
