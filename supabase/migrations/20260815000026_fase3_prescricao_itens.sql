-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Prescrição: registrar/atualizar prescrição ativa COM itens
--
-- O front envia a lista de itens selecionados; este RPC cria (ou reutiliza) a
-- prescrição ativa do paciente e substitui os itens. Assim o que é marcado na
-- aba Prescrição fica salvo no banco e pode ser recarregado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_prescricao_itens(
  p_paciente uuid,
  p_observacoes text DEFAULT NULL,
  p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade uuid;
  v_presc   uuid;
  v_item    jsonb;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR private.na_escala_agora(v_unidade)
    OR private.tem_acesso_atendimento(v_unidade)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não está em plantão nesta unidade.';
  END IF;

  -- Reutiliza a prescrição ativa existente ou cria nova
  SELECT id INTO v_presc
  FROM public.prescricoes
  WHERE paciente_id = p_paciente AND status = 'ativa'
  ORDER BY created_at DESC LIMIT 1;

  IF v_presc IS NULL THEN
    INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, observacoes, criada_por)
    VALUES (v_unidade, p_paciente, auth.uid(), 'ativa', p_observacoes, auth.uid())
    RETURNING id INTO v_presc;
  ELSE
    UPDATE public.prescricoes SET observacoes = p_observacoes, updated_at = now() WHERE id = v_presc;
  END IF;

  -- Substitui os itens
  DELETE FROM public.prescricao_itens WHERE prescricao_id = v_presc;

  IF jsonb_array_length(p_itens) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      INSERT INTO public.prescricao_itens (prescricao_id, descricao, dose, posologia, ordem, observacao)
      VALUES (v_presc,
              COALESCE(v_item->>'medicamento', v_item->>'descricao', ''),
              v_item->>'dose',
              v_item->>'posologia',
              COALESCE((v_item->>'ordem')::int, 1),
              v_item->>'observacao');
    END LOOP;
  END IF;

  RETURN v_presc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_prescricao_itens(uuid, text, jsonb) TO authenticated;
