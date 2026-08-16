-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Melhorias de Internação (I1–I5)
--
-- I2/I3: ocupação por setor + alerta de superlotação (função de contagem).
-- I4: checklist de admissão (tabela + RPC para atualizar itens).
-- I5: alta com critérios (tabela alta_paciente com status + critérios).
-- I1: linha do tempo do paciente (transferencias já existe; usamos ela + alta).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── I4: checklist de admissão ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_admissao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  prescricao   boolean NOT NULL DEFAULT false,
  dieta        boolean NOT NULL DEFAULT false,
  leito        boolean NOT NULL DEFAULT false,
  responsavel  boolean NOT NULL DEFAULT false,
  atualizado_por uuid REFERENCES public.perfis(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id)
);
CREATE INDEX IF NOT EXISTS checklist_admissao_unidade_idx ON public.checklist_admissao (unidade_id);

DROP TRIGGER IF EXISTS trg_checklist_admissao_updated_at ON public.checklist_admissao;
CREATE TRIGGER trg_checklist_admissao_updated_at BEFORE UPDATE ON public.checklist_admissao
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.checklist_admissao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_admissao_select" ON public.checklist_admissao;
CREATE POLICY "checklist_admissao_select" ON public.checklist_admissao
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = checklist_admissao.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "checklist_admissao_insert" ON public.checklist_admissao;
CREATE POLICY "checklist_admissao_insert" ON public.checklist_admissao
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = checklist_admissao.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "checklist_admissao_update" ON public.checklist_admissao;
CREATE POLICY "checklist_admissao_update" ON public.checklist_admissao
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = checklist_admissao.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = checklist_admissao.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

-- ── I5: alta médica com critérios ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alta_paciente (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'em_alta' CHECK (status IN ('em_alta', 'concluida')),
  criterios     jsonb NOT NULL DEFAULT '{}'::jsonb,
  justificativa text,
  liberou_leito boolean NOT NULL DEFAULT false,
  criado_por    uuid REFERENCES public.perfis(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alta_paciente_unidade_idx ON public.alta_paciente (unidade_id, status);

DROP TRIGGER IF EXISTS trg_alta_paciente_updated_at ON public.alta_paciente;
CREATE TRIGGER trg_alta_paciente_updated_at BEFORE UPDATE ON public.alta_paciente
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.alta_paciente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alta_paciente_select" ON public.alta_paciente;
CREATE POLICY "alta_paciente_select" ON public.alta_paciente
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = alta_paciente.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "alta_paciente_insert" ON public.alta_paciente;
CREATE POLICY "alta_paciente_insert" ON public.alta_paciente
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = alta_paciente.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "alta_paciente_update" ON public.alta_paciente;
CREATE POLICY "alta_paciente_update" ON public.alta_paciente
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = alta_paciente.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = alta_paciente.paciente_id
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

-- ── I2/I3: ocupação por setor (contagem viva p/ o painel e alerta) ───────────
CREATE OR REPLACE FUNCTION public.ocupacao_setores(p_unidade uuid)
RETURNS TABLE (setor_id uuid, setor_nome text, internados bigint, limite int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id AS setor_id, s.nome AS setor_nome,
         (SELECT COUNT(*) FROM public.pacientes p
          WHERE p.setor_id = s.id AND p.ativo)::bigint AS internados,
         (SELECT COUNT(*) FROM public.leitos l
          WHERE l.setor_id = s.id AND l.ativo)::int AS limite
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND s.tipo IN ('internacao', 'observacao')
  ORDER BY s.ordem, s.nome;
$$;

GRANT EXECUTE ON FUNCTION public.ocupacao_setores(uuid) TO authenticated;
