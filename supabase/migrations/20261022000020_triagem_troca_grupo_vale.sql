-- Auditoria do frontend (03/10/2026), decisão do RT 3b: a troca de grupo à mão
-- na triagem passa a reger o episódio. Antes o episódio.publico seguia a idade
-- (coalesce(v_pub_idade, v_publico)) mesmo quando o enfermeiro trocava à mão;
-- agora vale v_publico, que já honra a troca (v_trocado) e, sem a troca,
-- continua sendo a idade. O registro da classificação já guardava v_publico.

CREATE OR REPLACE FUNCTION public.classificar_risco(
  p_episodio uuid,
  p_cor text,
  p_sinais jsonb,
  p_fluxograma uuid DEFAULT NULL,
  p_discriminador text DEFAULT NULL,
  p_avaliacao jsonb DEFAULT '{}'::jsonb,
  p_publico text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  p_queixa text DEFAULT NULL,
  p_grupo_trocado boolean DEFAULT false,
  p_discriminador_livre boolean DEFAULT false,
  p_dor jsonb DEFAULT NULL,
  p_oxigenio jsonb DEFAULT NULL,
  p_gestacao jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  e public.episodios;
  v_nasc date;
  v_sexo text;
  v_pub_idade text;
  v_publico text;
  v_trocado boolean := false;
  v_reclass boolean;
  v_papel text;
  v_flx public.protocolo_fluxogramas;
  v_disc_cor text;
  v_livre boolean := false;
  v_id uuid;
  v_ordem text[] := ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  obrig text[];
  k text;
  v_conceito uuid;
  v_dor jsonb;
  v_oxi jsonb;
  v_gest jsonb;
  v_queixa text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF p_cor IS NULL OR NOT (p_cor = ANY (v_ordem)) THEN RAISE EXCEPTION 'Escolha a cor da classificação.'; END IF;

  v_reclass := e.cor_atual IS NOT NULL;
  IF NOT v_reclass THEN
    IF e.etapa <> 'triagem' THEN RAISE EXCEPTION 'Este episódio não está aguardando triagem.'; END IF;
    IF private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
      RAISE EXCEPTION 'A classificação de risco é do enfermeiro.';
    END IF;
    IF p_fluxograma IS NULL OR length(btrim(coalesce(p_discriminador, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o fluxograma e o discriminador do protocolo.';
    END IF;
    v_papel := 'enfermeiro';
  ELSE
    IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'Só se reclassifica antes do desfecho.'; END IF;
    IF private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
      RAISE EXCEPTION 'Só o médico reclassifica.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Informe o motivo da reclassificação (mínimo de 10 letras).';
    END IF;
    IF array_position(v_ordem, p_cor) > array_position(v_ordem, e.cor_atual)
       AND length(btrim(coalesce(p_justificativa, ''))) < 20 THEN
      RAISE EXCEPTION 'Baixar a prioridade exige justificativa (mínimo de 20 letras).';
    END IF;
    v_papel := 'plantonista';
  END IF;

  -- grupo: pela idade quando se sabe (pediatria até 13a 11m 29d); o enfermeiro
  -- pode trocar à mão (p_grupo_trocado), e isso fica registrado. Sem data de
  -- nascimento, vale o que foi informado.
  SELECT data_nascimento, sexo INTO v_nasc, v_sexo FROM public.pacientes WHERE id = e.paciente_id;
  IF v_nasc IS NOT NULL THEN
    v_pub_idade := CASE WHEN age((e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date, v_nasc) < interval '14 years'
                        THEN 'pediatrico' ELSE 'adulto' END;
  END IF;
  IF v_pub_idade IS NULL THEN
    v_publico := coalesce(p_publico, e.publico);
  ELSIF coalesce(p_grupo_trocado, false) AND p_publico IS NOT NULL AND p_publico <> v_pub_idade THEN
    v_publico := p_publico;
    v_trocado := true;
  ELSE
    v_publico := v_pub_idade;
  END IF;
  IF v_publico IS NULL OR v_publico NOT IN ('adulto', 'pediatrico') THEN
    RAISE EXCEPTION 'Sem data de nascimento: informe se é adulto ou pediatria.';
  END IF;

  -- protocolo: só referência; guarda a cor do discriminador ao lado da escolhida.
  -- Os discriminadores são os que valem NA UNIDADE (revisão do gestor).
  -- Discriminador escrito pelo enfermeiro só entra com p_discriminador_livre.
  IF p_fluxograma IS NOT NULL THEN
    SELECT * INTO v_flx FROM public.protocolo_fluxogramas WHERE id = p_fluxograma;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fluxograma não encontrado.'; END IF;
    IF v_flx.publico <> v_publico THEN RAISE EXCEPTION 'Fluxograma de outro público (%).', v_flx.publico; END IF;
    SELECT c.key INTO v_disc_cor
      FROM jsonb_each(private.discriminadores_efetivos(e.unidade_id, v_flx.id)) c, jsonb_array_elements(c.value) d
     WHERE d ->> 0 = btrim(p_discriminador) LIMIT 1;
    IF v_disc_cor IS NULL THEN
      IF NOT coalesce(p_discriminador_livre, false) THEN
        RAISE EXCEPTION 'Discriminador não pertence ao fluxograma.';
      END IF;
      IF length(btrim(coalesce(p_discriminador, ''))) < 3 THEN
        RAISE EXCEPTION 'Escreva o discriminador (mínimo de 3 letras).';
      END IF;
      v_livre := true;
    END IF;
  END IF;

  -- sinais vitais: todos obrigatórios; PA opcional na triagem pediátrica
  obrig := ARRAY['frequencia-cardiaca', 'frequencia-respiratoria', 'temperatura', 'saturacao-o2', 'escala-dor'];
  IF v_publico = 'adulto' THEN
    obrig := obrig || ARRAY['pressao-arterial-sistolica', 'pressao-arterial-diastolica'];
  END IF;
  FOREACH k IN ARRAY obrig LOOP
    IF NOT (coalesce(p_sinais, '{}') ? k) OR jsonb_typeof(p_sinais -> k) <> 'number' THEN
      RAISE EXCEPTION 'Sinal vital obrigatório ausente: %.', replace(k, '-', ' ');
    END IF;
  END LOOP;

  -- Glasgow (Anexo II do protocolo): de 3 a 15
  IF coalesce(p_avaliacao, '{}') ? 'glasgow' AND nullif(p_avaliacao ->> 'glasgow', '') IS NOT NULL THEN
    IF NOT (p_avaliacao ->> 'glasgow') ~ '^\d{1,2}$' OR (p_avaliacao ->> 'glasgow')::int NOT BETWEEN 3 AND 15 THEN
      RAISE EXCEPTION 'Glasgow vai de 3 a 15.';
    END IF;
  END IF;

  -- dor, oxigênio e gestação (opcionais; validados quando vêm)
  IF p_dor IS NOT NULL THEN
    v_dor := private.validar_dor_triagem(p_dor, (p_sinais ->> 'escala-dor')::numeric, v_publico);
  END IF;
  IF p_oxigenio IS NOT NULL THEN
    v_oxi := private.validar_oxigenio_triagem(p_oxigenio);
  END IF;
  IF p_gestacao IS NOT NULL THEN
    IF v_sexo = 'M' THEN RAISE EXCEPTION 'Gestação não se aplica a este paciente (sexo masculino no cadastro).'; END IF;
    v_gest := private.normalizar_gestacao(p_gestacao, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  END IF;
  v_queixa := coalesce(nullif(btrim(p_queixa), ''), CASE WHEN NOT v_reclass THEN e.queixa END);

  FOR k IN SELECT jsonb_object_keys(p_sinais) LOOP
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_perfil, (p_sinais ->> k)::numeric, 'manual');
  END LOOP;

  INSERT INTO public.classificacoes_risco
    (episodio_id, unidade_id, paciente_id, cor, publico, fluxograma_id, fluxograma_nome, discriminador,
     discriminador_cor, avaliacao, reclassificacao, motivo, justificativa, autor_id, autor_papel,
     queixa, publico_pela_idade, grupo_trocado, discriminador_livre, dor, oxigenio, gestacao)
  VALUES
    (e.id, e.unidade_id, e.paciente_id, p_cor, v_publico, v_flx.id, v_flx.nome, nullif(btrim(p_discriminador), ''),
     v_disc_cor, coalesce(p_avaliacao, '{}'), v_reclass, nullif(btrim(p_motivo), ''), nullif(btrim(p_justificativa), ''),
     v_perfil, v_papel,
     v_queixa, v_pub_idade, v_trocado, v_livre, v_dor, v_oxi, v_gest)
  RETURNING id INTO v_id;

  -- o episódio guarda o grupo da IDADE (outras telas decidem modo pediátrico
  -- por ele); a troca à mão fica só na classificação
  UPDATE public.episodios
     SET cor_atual = p_cor, publico = v_publico, etapa = 'atendimento',
         classificado_em = coalesce(classificado_em, now()), updated_at = now()
   WHERE id = e.id;

  PERFORM private.registrar_auditoria(CASE WHEN v_reclass THEN 'reclassificar' ELSE 'classificar' END,
    'episodios', e.id, e.unidade_id, jsonb_build_object('status', p_cor, 'tipo', v_publico));
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificar_risco(uuid, text, jsonb, uuid, text, jsonb, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb) TO authenticated;
