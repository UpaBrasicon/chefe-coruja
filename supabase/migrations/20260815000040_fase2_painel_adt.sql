-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2 ADT — Painel: transferência e alta emitem eventos ADT
-- Wrappers que unificam: episódio (internacoes) + evento imutável + pacientes.
-- transferir_internado   : cria episódio se preciso + evento de transferência/setor
-- dar_alta_internado     : evento de alta/óbito + libera leito + atualiza pacientes
-- ─────────────────────────────────────────────────────────────────────────────

-- helper: episódio ativo do paciente
CREATE OR REPLACE FUNCTION private.internacao_ativa(p_paciente uuid)
RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.internacoes
    WHERE paciente_id = p_paciente AND status IN ('admitido','em_observacao','internado')
    ORDER BY data_admissao DESC LIMIT 1;
  RETURN v_id;
END; $$ LANGUAGE plpgsql STABLE;

-- Transferência/internação: garante episódio + emite evento ADT + atualiza pacientes
CREATE OR REPLACE FUNCTION public.transferir_internado(
  p_paciente uuid,
  p_destino uuid,
  p_motivo text DEFAULT NULL,
  p_tipo_evento text DEFAULT 'transferencia_setor'
) RETURNS uuid AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_ep uuid;
  v_ep_ant uuid;
  v_ep_antigo public.pacientes%ROWTYPE;
  v_tipo text;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  -- autorização: gestor ou plantonista na escala do setor de ORIGEM
  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.escala_plantao e
      JOIN public.pacientes pa ON pa.id = p_paciente
      WHERE e.perfil_id = v_perfil AND e.unidade_id = v_unidade
        AND e.setor_id = pa.setor_id AND e.ativo
        AND e.data = private.data_atual() AND e.turno = private.turno_atual()
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala do setor de origem deste paciente.';
  END IF;

  -- episódio: usa o ativo ou abre novo (na unidade, setor atual)
  v_ep := private.internacao_ativa(p_paciente);
  IF v_ep IS NULL THEN
    SELECT * INTO v_ep_antigo FROM public.pacientes WHERE id = p_paciente;
    v_ep := public.abrir_internacao(p_paciente, v_unidade, 'urgencia', 'emergencia', v_ep_antigo.setor_id, NULL);
    v_tipo := CASE WHEN p_tipo_evento = 'transferencia_setor' THEN 'internacao' ELSE p_tipo_evento END;
  ELSE
    v_tipo := p_tipo_evento;
  END IF;

  -- emite o evento ADT (mudança de setor/leito) e atualiza o episódio
  PERFORM public.registrar_evento_adt(
    v_ep, v_tipo, p_destino, NULL, p_motivo
  );

  -- atualiza pacientes.setor_id (mantém RLS/painel)
  UPDATE public.pacientes SET setor_id = p_destino, updated_at = now() WHERE id = p_paciente;

  RETURN v_ep;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Alta/óbito: emite evento ADT terminal + libera leito + atualiza pacientes
CREATE OR REPLACE FUNCTION public.dar_alta_internado(
  p_paciente uuid,
  p_tipo_alta text,           -- alta_melhorada|alta_pedido|alta_evasao|transferencia_externa|obito
  p_motivo text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_ep uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF p_tipo_alta NOT IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN
    RAISE EXCEPTION 'Tipo de alta inválido.';
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  v_ep := private.internacao_ativa(p_paciente);
  IF v_ep IS NULL THEN
    RAISE EXCEPTION 'Paciente não possui internação ativa para dar alta.';
  END IF;

  -- evento terminal + libera leito (feito dentro de registrar_evento_adt)
  PERFORM public.registrar_evento_adt(v_ep, p_tipo_alta, NULL, NULL, p_motivo);

  -- atualiza pacientes: sai do setor (mantém histórico no episódio)
  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = p_paciente;

  -- tabela de alta legada (compatibilidade com a UI atual)
  INSERT INTO public.alta_paciente
    (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES
    (p_paciente, v_unidade, 'concluida', jsonb_build_object('tipo', p_tipo_alta), p_motivo, true, v_perfil);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
