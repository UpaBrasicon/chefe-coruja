-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Solicitações da escala (plantonista)
--
-- O plantonista pode, ao clicar no dia do seu plantão na Minha Escala:
--   1. SAIR DO FIXO      → aviso prévio mínimo de 15 dias (informado, não bloqueado)
--   2. PASSAR PLANTÃO    → escolhe para quem passa (aplicado direto OU com aprovação
--                          do gestor, conforme config da unidade)
--   3. JUSTIFICAR FALTA   → atestado médico ou licença-maternidade, com anexo
--
-- Cada solicitação fica registrada e é visível ao gestor (aprovar/recusar).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.solicitacoes_escala (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  escala_plantao_id uuid NOT NULL REFERENCES public.escala_plantao(id) ON DELETE CASCADE,
  perfil_id         uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  tipo              text NOT NULL CHECK (tipo IN ('sair_fixo', 'passar_plantao', 'justificar_falta')),
  status            text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  destino_perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  justificativa     text,
  tipo_falta        text CHECK (tipo_falta IN ('atestado_medico', 'licenca_maternidade')),
  anexo_url         text,
  criado_por        uuid REFERENCES public.perfis(id),
  decidido_por      uuid REFERENCES public.perfis(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solic_escala_unidade_idx ON public.solicitacoes_escala (unidade_id, status);
CREATE INDEX IF NOT EXISTS solic_escala_perfil_idx ON public.solicitacoes_escala (perfil_id);
CREATE INDEX IF NOT EXISTS solic_escala_plantao_idx ON public.solicitacoes_escala (escala_plantao_id);

DROP TRIGGER IF EXISTS trg_solicitacoes_escala_updated_at ON public.solicitacoes_escala;
CREATE TRIGGER trg_solicitacoes_escala_updated_at BEFORE UPDATE ON public.solicitacoes_escala
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.solicitacoes_escala ENABLE ROW LEVEL SECURITY;

-- SELECT: o solicitante, o destino da passagem, gestor da unidade ou super
DROP POLICY IF EXISTS "solic_escala_select" ON public.solicitacoes_escala;
CREATE POLICY "solic_escala_select" ON public.solicitacoes_escala
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR destino_perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- INSERT: o plantonista cria para o PRÓPRIO plantão (deve estar escalado nele)
DROP POLICY IF EXISTS "solic_escala_insert" ON public.solicitacoes_escala;
CREATE POLICY "solic_escala_insert" ON public.solicitacoes_escala
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR (
      perfil_id = private.meu_perfil_id()
      AND EXISTS (
        SELECT 1 FROM public.escala_plantao e
        WHERE e.id = solicitacoes_escala.escala_plantao_id
          AND e.perfil_id = private.meu_perfil_id()
          AND e.ativo
      )
    )
  );

-- UPDATE/DELETE: gestor aprova/recusa; super também
DROP POLICY IF EXISTS "solic_escala_update" ON public.solicitacoes_escala;
CREATE POLICY "solic_escala_update" ON public.solicitacoes_escala
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "solic_escala_delete" ON public.solicitacoes_escala;
CREATE POLICY "solic_escala_delete" ON public.solicitacoes_escala
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── Config: passagem de plantão exige aprovação do gestor? ───────────────────
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
SELECT id, 'escala_passagem_exige_aprovacao', 'false',
       'Passagem de plantão exige aprovação do gestor (true/false)'
FROM public.unidades
ON CONFLICT (unidade_id, chave) DO NOTHING;

-- ── RPC: passar plantão ──────────────────────────────────────────────────────
-- Cria a solicitação; se a unidade não exige aprovação, aplica na hora
-- (troca o perfil do plantão para o destino) e registra como aprovada.
CREATE OR REPLACE FUNCTION public.passar_plantao(
  p_escala uuid,
  p_destino uuid,
  p_justificativa text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade  uuid;
  v_perfil   uuid;
  v_exige    text;
  v_solic    uuid;
BEGIN
  SELECT e.unidade_id, e.perfil_id INTO v_unidade, v_perfil
  FROM public.escala_plantao e
  WHERE e.id = p_escala AND e.ativo;

  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado.';
  END IF;
  IF v_perfil <> auth.uid() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Você só pode passar o seu próprio plantão.';
  END IF;

  SELECT valor INTO v_exige
  FROM public.configuracoes_unidade
  WHERE unidade_id = v_unidade AND chave = 'escala_passagem_exige_aprovacao';

  IF COALESCE(v_exige, 'false') = 'true' THEN
    INSERT INTO public.solicitacoes_escala
      (unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, criado_por)
    VALUES (v_unidade, p_escala, v_perfil, 'passar_plantao', 'pendente', p_destino, p_justificativa, auth.uid())
    RETURNING id INTO v_solic;
    RETURN v_solic;
  END IF;

  -- Aplicação direta
  UPDATE public.escala_plantao SET perfil_id = p_destino WHERE id = p_escala;

  INSERT INTO public.solicitacoes_escala
    (unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, criado_por, decidido_por)
  VALUES (v_unidade, p_escala, v_perfil, 'passar_plantao', 'aprovado', p_destino, p_justificativa, auth.uid(), auth.uid())
  RETURNING id INTO v_solic;
  RETURN v_solic;
END;
$$;

GRANT EXECUTE ON FUNCTION public.passar_plantao(uuid, uuid, text) TO authenticated;
