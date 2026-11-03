-- ════════════════════════════════════════════════════════════════════════════
-- VD1 do lote "Virada de data" (BACKLOG.md, decisão do RT em 01/11/2026, P0
-- clínico): corte de 14 anos errado na véspera do aniversário.
--
-- `age(dia, nascimento) < interval '14 years'` compara intervalos contando o
-- mês como 30 dias. Na véspera dos 14 anos, para quem nasceu do dia 2 em diante
-- de um mês de 31 dias, age() devolve '13 years 11 mons 30 days', que o
-- Postgres considera igual a 14 anos: o `<` dá falso e a criança (13a 11m 29d
-- pela regra da unidade) entra como adulto. Ex.: nascido em 31/12/2012, em
-- 30/12/2026.
--   * classificar_risco: protocolo de classificação adulto em vez do pediátrico;
--   * registrar_avaliacao: NIPS/FLACC recusadas, escalas de adulto aceitas;
--   * registrar_fugulin: Fugulin (adulto) aceito para a criança.
--
-- Correção: private.pediatrico_em(nascimento, dia) = nascimento > dia - 14 anos,
-- a mesma conta que prescrever e a observação já usam. Os três corpos são os
-- das migrations de origem (abaixo), conferidos por md5 com a produção, só com
-- a troca dessa expressão. Nascimento nulo continua dando nulo, como antes.
-- Expand: função nova e corpos novos com a mesma assinatura; sem DROP/RENAME.
-- Idempotente.
-- Teste: supabase/tests/vd1_corte_14_anos.sql
--
-- Rollback:
--   reaplicar public.classificar_risco de 20261119000002_reclassificacao_enfermagem.sql,
--   public.registrar_avaliacao de 20270203000006_termo_paliativo_pergunta_surpresa.sql
--   e public.registrar_fugulin de 20261119000001_desfecho_encerra_cuidado.sql;
--   depois DROP FUNCTION IF EXISTS private.pediatrico_em(date, date);
-- ════════════════════════════════════════════════════════════════════════════

-- Pediatria vai até 13 anos, 11 meses e 29 dias: no dia em que completa 14
-- anos, já é adulto. Quem nasceu em 29/02 completa os anos em 01/03 (igual a
-- idadeEm de src/domain/idade.ts).
CREATE OR REPLACE FUNCTION private.pediatrico_em(p_nascimento date, p_dia date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $function$
  SELECT p_nascimento > p_dia - interval '14 years'
$function$;

REVOKE ALL ON FUNCTION private.pediatrico_em(date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.classificar_risco(p_episodio uuid, p_cor text, p_sinais jsonb, p_fluxograma uuid DEFAULT NULL::uuid, p_discriminador text DEFAULT NULL::text, p_avaliacao jsonb DEFAULT '{}'::jsonb, p_publico text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text, p_queixa text DEFAULT NULL::text, p_grupo_trocado boolean DEFAULT false, p_discriminador_livre boolean DEFAULT false, p_dor jsonb DEFAULT NULL::jsonb, p_oxigenio jsonb DEFAULT NULL::jsonb, p_gestacao jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- o enfermeiro reclassifica enquanto o paciente espera o médico; depois que
    -- o atendimento começa, só o médico (RT, 11/10/2026)
    IF private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE THEN
      v_papel := 'plantonista';
    ELSIF private.tenho_papel(e.unidade_id, 'enfermeiro') IS TRUE THEN
      IF e.atendimento_iniciado_em IS NOT NULL THEN
        RAISE EXCEPTION 'O atendimento médico já começou: agora só o médico reclassifica.';
      END IF;
      IF p_fluxograma IS NULL OR length(btrim(coalesce(p_discriminador, ''))) = 0 THEN
        RAISE EXCEPTION 'Informe o fluxograma e o discriminador do protocolo.';
      END IF;
      v_papel := 'enfermeiro';
    ELSE
      RAISE EXCEPTION 'Reclassifica o enfermeiro, enquanto o paciente espera o médico, ou o médico.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Informe o motivo da reclassificação (mínimo de 10 letras).';
    END IF;
    IF array_position(v_ordem, p_cor) > array_position(v_ordem, e.cor_atual)
       AND length(btrim(coalesce(p_justificativa, ''))) < 20 THEN
      RAISE EXCEPTION 'Baixar a prioridade exige justificativa (mínimo de 20 letras).';
    END IF;
  END IF;

  -- grupo: pela idade quando se sabe (pediatria até 13a 11m 29d); o enfermeiro
  -- pode trocar à mão (p_grupo_trocado), e isso fica registrado. Sem data de
  -- nascimento, vale o que foi informado.
  SELECT data_nascimento, sexo INTO v_nasc, v_sexo FROM public.pacientes WHERE id = e.paciente_id;
  IF v_nasc IS NOT NULL THEN
    v_pub_idade := CASE WHEN private.pediatrico_em(v_nasc, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date)
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

  -- piora na espera: avisa os médicos de plantão na porta
  IF v_reclass AND v_papel = 'enfermeiro' AND p_cor IN ('vermelho', 'laranja')
     AND array_position(v_ordem, p_cor) < array_position(v_ordem, e.cor_atual) THEN
    PERFORM private.avisar_piora_na_espera(e, p_cor, btrim(p_motivo));
  END IF;

  PERFORM private.registrar_auditoria(CASE WHEN v_reclass THEN 'reclassificar' ELSE 'classificar' END,
    'episodios', e.id, e.unidade_id, jsonb_build_object('status', p_cor, 'tipo', v_publico));
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.registrar_avaliacao(p_paciente uuid, p_escala text, p_respostas jsonb, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d jsonb := private.escala_avaliacao(p_escala); pa public.pacientes; k text; v jsonb;
  v_total int := 0; v_interp text; f jsonb; v_ped boolean; v_ep uuid; v_int uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF d IS NULL THEN RAISE EXCEPTION 'Escala desconhecida: use NIPS, FLACC, Braden, Morse ou a pergunta surpresa.'; END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  v_ped := CASE WHEN pa.data_nascimento IS NULL THEN NULL
                ELSE private.pediatrico_em(pa.data_nascimento, private.data_atual()) END;
  IF d ->> 'publico' = 'pediatrico' AND v_ped IS NOT TRUE THEN
    RAISE EXCEPTION 'NIPS e FLACC são escalas da pediatria (até 13 anos, 11 meses e 29 dias, com a data de nascimento no cadastro).';
  END IF;
  IF d ->> 'publico' = 'adulto' AND v_ped IS TRUE THEN
    RAISE EXCEPTION '%', CASE WHEN p_escala = 'pergunta_surpresa'
      THEN 'A pergunta surpresa é do adulto: na criança não se usa (nada se converte do adulto).'
      ELSE 'Braden e Morse são escalas do adulto: na criança não se usam (nada se converte do adulto).' END;
  END IF;
  -- a pergunta surpresa só vale com a idade conhecida (a fonte é de adultos)
  IF p_escala = 'pergunta_surpresa' AND v_ped IS NULL THEN
    RAISE EXCEPTION 'A pergunta surpresa é do adulto: registre a data de nascimento no cadastro.';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda todas as perguntas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'itens' ? k) THEN RAISE EXCEPTION 'Pergunta que não é da escala: %.', k; END IF;
  END LOOP;
  FOR k, v IN SELECT * FROM jsonb_each(d -> 'itens') LOOP
    IF NOT (p_respostas ? k) THEN RAISE EXCEPTION 'Responda todas as perguntas (falta %).', k; END IF;
    IF jsonb_typeof(p_respostas -> k) <> 'number' OR NOT (v @> jsonb_build_array(p_respostas -> k)) THEN
      RAISE EXCEPTION 'Resposta fora das opções em %.', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_interp := f ->> 1; END IF;
  END LOOP;
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, false) a;
  INSERT INTO public.avaliacoes_escala (unidade_id, paciente_id, episodio_id, internacao_id, escala, versao, respostas, total, interpretacao, registrado_por)
  VALUES (pa.unidade_id, p_paciente, v_ep, v_int, p_escala, d ->> 'versao', p_respostas, v_total, v_interp, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_fugulin(p_internacao uuid, p_respostas jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  d jsonb := private.fugulin_definicao();
  i public.internacoes; pa public.pacientes;
  k text; v_total int := 0; v_cat text; f jsonb; v_dia date := private.data_atual();
  v_ant uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.data_alta IS NOT NULL OR i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'A internação não está ativa.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_em_cuidado_no_plantao(i.paciente_id) THEN
    RAISE EXCEPTION 'O Fugulin é do enfermeiro de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = i.paciente_id;
  IF pa.data_nascimento IS NOT NULL AND private.pediatrico_em(pa.data_nascimento, v_dia) THEN
    RAISE EXCEPTION 'Fugulin é instrumento do adulto: na criança não se usa (nada se converte do adulto).';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda as 12 áreas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'areas' ? k) THEN RAISE EXCEPTION 'Área que não é do Fugulin: %.', k; END IF;
  END LOOP;
  FOR k IN SELECT jsonb_array_elements_text(d -> 'areas') LOOP
    IF NOT (p_respostas ? k) OR jsonb_typeof(p_respostas -> k) <> 'number' OR (p_respostas ->> k)::numeric NOT IN (1, 2, 3, 4) THEN
      RAISE EXCEPTION 'Responda as 12 áreas com graduação de 1 a 4 (falta ou inválida: %).', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_cat := f ->> 1; END IF;
  END LOOP;
  -- uma vigente por dia: a segunda do dia é retificação
  SELECT c.id INTO v_ant FROM public.classificacoes_fugulin c
   WHERE c.internacao_id = i.id AND c.dia = v_dia
     AND NOT EXISTS (SELECT 1 FROM public.classificacoes_fugulin r WHERE r.retifica_id = c.id)
   ORDER BY c.registrado_em DESC LIMIT 1;
  IF v_ant IS NOT NULL AND length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'O Fugulin de hoje já foi feito: para corrigir, diga o motivo (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.classificacoes_fugulin (unidade_id, paciente_id, internacao_id, dia, versao, respostas, total, categoria,
                                             retifica_id, motivo, registrado_por)
  VALUES (i.unidade_id, i.paciente_id, i.id, v_dia, d ->> 'versao', p_respostas, v_total, v_cat,
          v_ant, CASE WHEN v_ant IS NOT NULL THEN btrim(p_motivo) END, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;
