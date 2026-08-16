-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Observação: prescrição obrigatória + regra de 6h
--
-- 1. Trava: só é possível encaminhar um paciente para OBSERVAÇÃO se ele tiver
--    uma prescrição médica registrada (ativo e válida).
-- 2. Aviso: a observação dura no máximo 6h — o front avisa às 18:30 (próximo
--    do fim do turno das 19h) para internar o paciente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Prescrição ativa do paciente ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.paciente_tem_prescricao_ativa(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prescricoes p
    WHERE p.paciente_id = p_paciente
      AND p.status = 'ativa'
      AND (p.valida_ate IS NULL OR p.valida_ate > now())
  );
$$;

GRANT EXECUTE ON FUNCTION private.paciente_tem_prescricao_ativa(uuid) TO authenticated;

-- ── Registrar prescrição mínima (para liberar observação) ───────────────────
CREATE OR REPLACE FUNCTION public.registrar_prescricao_observacao(
  p_paciente uuid,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade uuid;
  v_presc uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  -- Só quem está na escala da unidade (ou gestor/super) pode prescrever
  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR private.na_escala_agora(v_unidade)
    OR private.tem_acesso_atendimento(v_unidade)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não está em plantão nesta unidade.';
  END IF;

  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, observacoes, criada_por)
  VALUES (v_unidade, p_paciente, auth.uid(), 'ativa', p_observacoes, auth.uid())
  RETURNING id INTO v_presc;

  -- Item mínimo obrigatório da prescrição de observação
  INSERT INTO public.prescricao_itens (prescricao_id, descricao, ordem, observacao)
  VALUES (v_presc, 'Paciente em observação — conforme prescrição médica', 1, 'Observação por no máximo 6h');

  RETURN v_presc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_prescricao_observacao(uuid, text) TO authenticated;

-- ── TRAVA no transferir_paciente: observação exige prescrição ───────────────
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
  SELECT unidade_id, setor_id INTO v_unidade, v_origem
  FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  SELECT * INTO v_destino FROM public.setores WHERE id = p_destino AND ativo;
  IF v_destino.id IS NULL THEN
    RAISE EXCEPTION 'Setor de destino não encontrado.';
  END IF;
  IF v_destino.unidade_id <> v_unidade THEN
    RAISE EXCEPTION 'Setor de destino pertence a outra unidade.';
  END IF;

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

  -- TRAVA DE OBSERVAÇÃO: para o setor "Observação", exige prescrição ativa
  IF v_destino.tipo = 'observacao'
     AND position('verm' in lower(v_destino.nome)) = 0
     AND NOT private.paciente_tem_prescricao_ativa(p_paciente) THEN
    RAISE EXCEPTION 'Para encaminhar à observação, o paciente precisa ter uma prescrição médica registrada.';
  END IF;

  UPDATE public.pacientes SET setor_id = p_destino WHERE id = p_paciente;

  INSERT INTO public.transferencias_paciente
    (paciente_id, unidade_id, setor_origem_id, setor_destino_id, transferido_por, motivo)
  VALUES (p_paciente, v_unidade, v_origem, p_destino, auth.uid(), p_motivo)
  RETURNING id INTO v_reg;

  RETURN v_reg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_paciente(uuid, uuid, text) TO authenticated;
