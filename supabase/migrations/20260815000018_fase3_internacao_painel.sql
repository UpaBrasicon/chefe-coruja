-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Internação por setores (painel) + transferência com auditoria
--
-- Nova aba "Internação": painel com os setores de internação (Enfermaria
-- Clínica, Enfermaria Pediátrica, Sala Vermelha/Semi-Crítica e outros criados
-- pelo gestor). O plantonista só enxerga os pacientes do(s) setor(es) onde
-- está NA ESCALA agora (RLS de pacientes já garante). A transferência entre
-- setores é feita por RPC SECURITY DEFINER com auditoria.
--
-- TRAVA DE SEGURANÇA:
--   • SELECT de pacientes continua restrito aos setores da escala atual
--     (setores_na_escala_agora) — ninguém vê paciente de setor fora da escala.
--   • Transferência: apenas quem está na escala do setor ORIGEM (ou gestor/
--     super) pode transferir; registro em transferencias_paciente.
--   • Plantonista NÃO pode mudar o setor_id via UPDATE direto (usa o RPC).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Auditoria de transferências ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transferencias_paciente (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_origem_id    uuid REFERENCES public.setores(id),
  setor_destino_id   uuid NOT NULL REFERENCES public.setores(id),
  transferido_por    uuid NOT NULL REFERENCES public.perfis(id),
  motivo             text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transf_paciente_pac_idx ON public.transferencias_paciente (paciente_id);
CREATE INDEX IF NOT EXISTS transf_paciente_unidade_idx ON public.transferencias_paciente (unidade_id);

-- RLS: auditoria visível ao gestor/super e a quem está na escala do setor
-- atual do paciente (o autor da transferência está no histórico).
ALTER TABLE public.transferencias_paciente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transferencias_select" ON public.transferencias_paciente;
CREATE POLICY "transferencias_select" ON public.transferencias_paciente
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR transferido_por = private.meu_perfil_id()
  );

-- ── RPC: setores de internação da unidade ────────────────────────────────────
-- Inclui os 3 padrão (enfermaria clínica, enfermaria pediátrica, sala
-- vermelha) e qualquer outro criado pelo gestor (tipos de internação).
CREATE OR REPLACE FUNCTION public.setores_internacao(p_unidade uuid)
RETURNS TABLE (id uuid, nome text, tipo text, ordem int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.nome, s.tipo, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND s.tipo IN ('internacao', 'observacao', 'uti', 'isolamento')
  ORDER BY s.ordem, s.nome;
$$;

GRANT EXECUTE ON FUNCTION public.setores_internacao(uuid) TO authenticated;

-- ── RPC: transferir paciente entre setores (com auditoria + trava) ───────────
CREATE OR REPLACE FUNCTION public.transferir_paciente(
  p_paciente uuid,
  p_destino uuid,
  p_motivo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade  uuid;
  v_origem   uuid;
  v_destino  public.setores%ROWTYPE;
  v_reg      uuid;
BEGIN
  -- Paciente e unidade
  SELECT unidade_id, setor_id INTO v_unidade, v_origem
  FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  -- Destino existe e é da mesma unidade
  SELECT * INTO v_destino FROM public.setores WHERE id = p_destino AND ativo;
  IF v_destino.id IS NULL THEN
    RAISE EXCEPTION 'Setor de destino não encontrado.';
  END IF;
  IF v_destino.unidade_id <> v_unidade THEN
    RAISE EXCEPTION 'Setor de destino pertence a outra unidade.';
  END IF;

  -- TRAVA: quem transfere precisa estar na escala do setor ORIGEM (agora),
  -- ou ser gestor da unidade / super.
  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.escala_plantao e
      WHERE e.perfil_id = private.meu_perfil_id()
        AND e.unidade_id = v_unidade
        AND e.setor_id = v_origem
        AND e.ativo
        AND e.data = private.data_atual()
        AND e.turno = private.turno_atual()
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala do setor de origem deste paciente.';
  END IF;

  -- Executa a transferência
  UPDATE public.pacientes SET setor_id = p_destino WHERE id = p_paciente;

  INSERT INTO public.transferencias_paciente
    (paciente_id, unidade_id, setor_origem_id, setor_destino_id, transferido_por, motivo)
  VALUES (p_paciente, v_unidade, v_origem, p_destino, auth.uid(), p_motivo)
  RETURNING id INTO v_reg;

  RETURN v_reg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_paciente(uuid, uuid, text) TO authenticated;

-- ── Reforço RLS de pacientes ─────────────────────────────────────────────────
-- UPDATE direto: gestor/super podem; plantonista SÓ pode editar pacientes do
-- próprio setor da escala, e NÃO pode alterar o setor_id (trava anti-vazamento).
-- Implementado com função auxiliar que compara o setor ANTES da mudança.

CREATE OR REPLACE FUNCTION private.paciente_setor_antes(p_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT setor_id FROM public.pacientes WHERE id = p_id;
$$;

DROP POLICY IF EXISTS "pacientes_update" ON public.pacientes;
CREATE POLICY "pacientes_update" ON public.pacientes
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR private.tem_acesso_atendimento(unidade_id)
    OR (setor_id IN (SELECT private.setores_na_escala_agora()))
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      -- Plantonista: setor atual deve ser o mesmo de antes (não muda setor aqui)
      setor_id = private.paciente_setor_antes(pacientes.id)
      AND setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

GRANT EXECUTE ON FUNCTION private.paciente_setor_antes(uuid) TO authenticated;
