-- ════════════════════════════════════════════════════════════════════════════
-- Correções do red-team (01/10/2026) — dois achados Média.
--
-- V3 — registrar_prescricao_itens (RPC legado) reutilizava a prescrição ativa
-- do paciente sem conferir o dono. Um plantonista da unidade (não autor)
-- sobrescrevia os itens de uma prescrição assinada por OUTRO médico; o
-- medico_id permanecia o original → falsa autoria (risco CFM/legal). Agora:
-- só reutiliza se o chamador for o autor, gestor da unidade ou super admin;
-- caso contrário bloqueia e orienta a abrir a própria prescrição.
--
-- V4 — a passagem/troca de plantão (solicitar_troca, passar_plantao) aplicava
-- AUTOMATICAMENTE, sem aprovação da contraparte, quando a config
-- escala_passagem_exige_aprovacao estava ausente OU 'false' — e o default era
-- justamente aplicar sem aprovar (coalesce(..., false)). Isso permitia impor
-- um plantão a um colega sem consentimento. Agora o default é SEGURO:
-- coalesce(..., true) → ausência de config exige aprovação. Linhas já semeadas
-- como 'false' são migradas para 'true' (quem quiser o automático re-opta
-- explicitamente por unidade).
--
-- SECURITY DEFINER preservado; 2FA (ADR 0010) e search_path de cada função
-- mantidos como estavam. Reaplicável (CREATE OR REPLACE preserva os GRANTs).
-- ════════════════════════════════════════════════════════════════════════════

-- ── V3 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_prescricao_itens(p_paciente uuid, p_observacoes text DEFAULT NULL::text, p_itens jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_presc   uuid;
  v_medico  uuid;
  v_item    jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR private.paciente_no_meu_plantao(p_paciente)  -- escala por setor (0011)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;

  -- Reutiliza a prescrição ativa existente ou cria nova
  SELECT id, medico_id INTO v_presc, v_medico
  FROM public.prescricoes
  WHERE paciente_id = p_paciente AND status = 'ativa'
  ORDER BY created_at DESC LIMIT 1;

  -- V3 (red-team 2026-10-01): não sobrescrever prescrição ativa de OUTRO médico.
  -- Só reutiliza se o chamador for o autor, gestor da unidade ou super admin.
  IF v_presc IS NOT NULL
     AND v_medico IS DISTINCT FROM auth.uid()
     AND NOT private.eh_super_admin()
     AND private.papel_na_unidade(v_unidade) <> 'gestor' THEN
    RAISE EXCEPTION 'A prescrição ativa deste paciente pertence a outro médico. Use o fluxo de prescrição para abrir a sua.';
  END IF;

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
$function$;

-- ── V4: solicitar_troca (default seguro = exigir aprovação) ──────────────────
CREATE OR REPLACE FUNCTION public.solicitar_troca(p_plantao_a uuid, p_plantao_b uuid, p_mensagem text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
  v_id uuid;
  v_aprovacao boolean;
  v_erro text;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = p_plantao_a AND ativo;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = p_plantao_b AND ativo;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'Plantões inválidos';
  END IF;
  IF v_a.unidade_id <> v_b.unidade_id THEN
    RAISE EXCEPTION 'Os plantões devem pertencer à mesma unidade';
  END IF;
  IF v_a.perfil_id <> v_perfil THEN
    RAISE EXCEPTION 'Você só pode oferecer seus próprios plantões';
  END IF;
  IF v_b.perfil_id IS NULL OR v_b.perfil_id = v_perfil THEN
    RAISE EXCEPTION 'O plantão B deve pertencer a outro plantonista';
  END IF;

  INSERT INTO public.trocas_plantao
    (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, mensagem, criado_por)
  VALUES
    (v_a.unidade_id, v_a.id, v_perfil, v_b.id, v_b.perfil_id, p_mensagem, v_perfil)
  RETURNING id INTO v_id;

  SELECT (valor = 'true') INTO v_aprovacao
    FROM public.configuracoes_unidade
    WHERE unidade_id = v_a.unidade_id AND chave = 'escala_passagem_exige_aprovacao';

  -- V4 (red-team 2026-10-01): default SEGURO — sem config = exige aprovação.
  IF coalesce(v_aprovacao, true) IS FALSE THEN
    BEGIN
      PERFORM private.aplicar_troca((SELECT t FROM public.trocas_plantao t WHERE id = v_id));
      UPDATE public.trocas_plantao SET status = 'aprovado', decidido_por = v_perfil, updated_at = now() WHERE id = v_id;
      PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'troca_aprovada',
        format('Troca aprovada automaticamente: %s <-> %s', v_a.rotulo, v_b.rotulo),
        jsonb_build_object('troca_id', v_id));
    EXCEPTION WHEN OTHERS THEN
      v_erro := SQLERRM;
      UPDATE public.trocas_plantao SET status = 'erro', erro = v_erro, updated_at = now() WHERE id = v_id;
      PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'erro_passagem',
        v_erro, jsonb_build_object('troca_id', v_id, 'tipo', 'troca'));
      RAISE EXCEPTION '%', v_erro;
    END;
  ELSE
    PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'troca_solicitada',
      format('Troca solicitada: %s <-> %s', v_a.rotulo, v_b.rotulo),
      jsonb_build_object('troca_id', v_id));
  END IF;

  RETURN v_id;
END; $function$;

-- ── V4: passar_plantao (default seguro = exigir aprovação) ───────────────────
CREATE OR REPLACE FUNCTION public.passar_plantao(p_escala uuid, p_destino uuid, p_justificativa text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade uuid;
  v_aprovacao boolean;
  v_solic uuid;
BEGIN
  SELECT * INTO v_escala FROM public.escala_plantao WHERE id = p_escala AND ativo;
  IF v_escala.id IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado';
  END IF;
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_escala.perfil_id IS DISTINCT FROM v_perfil
     AND (private.papel_na_unidade(v_escala.unidade_id) = 'gestor' OR private.eh_super_admin()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_escala.perfil_id = p_destino THEN
    RAISE EXCEPTION 'O destino não pode ser o próprio plantonista';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_destino AND v.unidade_id = v_escala.unidade_id AND v.ativo) THEN
    RAISE EXCEPTION 'O destino não tem vínculo ativo nesta unidade.';
  END IF;
  IF private.tem_conflito_plantao(p_destino, v_escala.unidade_id, v_escala.setor_id, v_escala.data, v_escala.turno, NULL) THEN
    PERFORM private.registrar_historico(v_escala.unidade_id, p_escala, 'erro_passagem',
      'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário',
      jsonb_build_object('destino', p_destino, 'tipo', 'passagem'));
    RAISE EXCEPTION 'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário';
  END IF;

  v_unidade := v_escala.unidade_id;

  SELECT (valor = 'true') INTO v_aprovacao
    FROM public.configuracoes_unidade
    WHERE unidade_id = v_unidade AND chave = 'escala_passagem_exige_aprovacao';

  -- V4 (red-team 2026-10-01): default SEGURO — sem config = exige aprovação.
  IF coalesce(v_aprovacao, true) IS FALSE THEN
    UPDATE public.escala_plantao SET perfil_id = p_destino, observacao = p_justificativa, updated_at = now() WHERE id = p_escala;
    PERFORM private.registrar_historico(v_unidade, p_escala, 'passagem_aplicada',
      'Plantão passado automaticamente', jsonb_build_object('destino', p_destino, 'justificativa', p_justificativa));
    RETURN p_escala;
  END IF;

  INSERT INTO public.solicitacoes_escala
    (unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, criado_por)
  VALUES
    (v_unidade, p_escala, v_perfil, 'passar_plantao', 'pendente', p_destino, p_justificativa, v_perfil)
  RETURNING id INTO v_solic;

  PERFORM private.registrar_historico(v_unidade, p_escala, 'passagem_solicitada',
    'Passagem de plantão solicitada', jsonb_build_object('destino', p_destino, 'solicitacao', v_solic));

  RETURN v_solic;
END; $function$;

-- ── V4: migra o default já semeado 'false' para 'true' (opt-out explícito) ───
UPDATE public.configuracoes_unidade
   SET valor = 'true'
 WHERE chave = 'escala_passagem_exige_aprovacao' AND valor = 'false';
