-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 3 — CID conferido contra a CID-10 (P1-01 do
-- teste de ponta a ponta de 11/10/2026; decisões do RT de 11/10/2026,
-- BACKLOG.md).
--
-- • Todos os campos estruturados de CID que só conferiam o formato passam a
--   conferir se o código existe na CID-10 carregada (a do DATASUS, usada pelo
--   SUS): SOAP, CID de alta na porta, CID de alta da internação e da
--   observação, CID do óbito, agravo suspeito e notificação compulsória. A
--   regra e a mensagem são as da regulação ("Informe um CID-10 válido"), que
--   já conferia, como o diagnóstico, a AIH e a APAC.
-- • Categoria de 3 caracteres (ex.: K35) é aceita, como na regulação e no
--   diagnóstico; a crítica da AIH continua protegendo o faturamento.
-- • Código fora da tabela (versões da OMS que o DATASUS não traz) é recusado.
--   Código novo só entra pela tabela oficial, nunca acrescentado à mão.
-- • Sem a tabela carregada (ambiente vazio), vale só o formato, como no
--   diagnóstico. O código gravado sai normalizado (K359 → K35.9).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.cid_existente(p_cid text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := private.cid_normalizado(p_cid);
BEGIN
  IF v IS NULL THEN RAISE EXCEPTION 'CID fora do formato (ex.: J18.9).'; END IF;
  IF EXISTS (SELECT 1 FROM terminologia.cid10)
     AND NOT EXISTS (SELECT 1 FROM terminologia.cid10 WHERE codigo IN (v, replace(v, '.', ''))) THEN
    RAISE EXCEPTION 'Informe um CID-10 válido: % não está na CID-10 do DATASUS usada pelo SUS; escolha um da lista.', v;
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION private.cid_existente(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_soap(p_episodio uuid, p_subjetivo text, p_objetivo text, p_avaliacao text, p_plano text, p_cid text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.episodios; v_id uuid; v_cid text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'Abra o atendimento antes de registrar.';
  END IF;
  -- CID opcional; quando vem, tem de existir na CID-10 (tarefa 3 do portão)
  IF nullif(btrim(p_cid), '') IS NOT NULL THEN v_cid := private.cid_existente(p_cid); END IF;
  INSERT INTO public.atendimento_registros (episodio_id, unidade_id, paciente_id, subjetivo, objetivo, avaliacao, cid, plano, autor_id)
  VALUES (e.id, e.unidade_id, e.paciente_id, nullif(btrim(p_subjetivo), ''), nullif(btrim(p_objetivo), ''),
          nullif(btrim(p_avaliacao), ''), v_cid, nullif(btrim(p_plano), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id AND autor_id = private.meu_perfil_id();
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.registrar_desfecho(p_episodio uuid, p_desfecho text, p_relato text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  e public.episodios;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_etapa text;
  v_setor uuid;
  v_leito uuid;
  v_internacao uuid;
  v_alta_em timestamptz;
  v_cid text;
  v_proc text;
  v_do text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'O episódio não está em atendimento.'; END IF;
  IF p_desfecho NOT IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito', 'observacao', 'internacao') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;

  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros WHERE episodio_id = e.id) THEN
    RAISE EXCEPTION 'Registre o atendimento (SOAP) antes do desfecho.';
  END IF;
  -- hipótese diagnóstica (protótipo: "Informe a hipótese diagnóstica na aba Atendimento")
  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros
                                             WHERE episodio_id = e.id AND length(btrim(coalesce(avaliacao, ''))) > 0) THEN
    RAISE EXCEPTION 'Informe a hipótese diagnóstica (Avaliação) no registro do atendimento.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(btrim(coalesce(p_relato, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_desfecho = 'obito' THEN
    IF nullif(d ->> 'hora_obito', '') IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF (d ->> 'hora_obito')::timestamptz > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN RAISE EXCEPTION 'Informe o número da Declaração de Óbito.'; END IF;
  END IF;

  -- dados da alta (protótipo altaErro, manual 3.17)
  IF nullif(btrim(d ->> 'alta_em'), '') IS NOT NULL THEN
    BEGIN
      v_alta_em := (d ->> 'alta_em')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Data e hora da alta inválidas.';
    END;
    IF v_alta_em > now() + interval '1 minute' THEN RAISE EXCEPTION 'Data e hora da alta no futuro.'; END IF;
    IF v_alta_em < e.chegada_em THEN RAISE EXCEPTION 'Data e hora da alta antes da chegada do paciente.'; END IF;
    IF v_alta_em < now() - interval '30 minutes'
       AND length(btrim(coalesce(d ->> 'justificativa_retroativa', ''))) < 10 THEN
      RAISE EXCEPTION 'Alta retroativa: justifique (mínimo de 10 letras).';
    END IF;
    d := d || jsonb_build_object('alta_em', v_alta_em, 'retroativa', v_alta_em < now() - interval '30 minutes');
  END IF;
  IF p_desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'obito') THEN
    v_cid := coalesce(nullif(btrim(d ->> 'cid_alta'), ''),
                      (SELECT s.cid FROM public.atendimento_registros s
                        WHERE s.episodio_id = e.id AND s.cid IS NOT NULL ORDER BY s.criado_em DESC LIMIT 1));
    IF v_cid IS NULL THEN RAISE EXCEPTION 'Informe o diagnóstico de alta (CID).'; END IF;
    IF private.cid_normalizado(v_cid) IS NULL THEN RAISE EXCEPTION 'Diagnóstico de alta: CID em formato inválido (ex.: J45.9).'; END IF;
    d := d || jsonb_build_object('cid_alta', private.cid_existente(v_cid));
  END IF;
  v_proc := nullif(regexp_replace(coalesce(d ->> 'procedimento', ''), '\D', '', 'g'), '');
  IF v_proc IS NOT NULL THEN
    IF v_proc !~ '^\d{10}$' THEN RAISE EXCEPTION 'Procedimento SIGTAP: código de 10 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento)
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Procedimento SIGTAP não encontrado na tabela vigente.';
    END IF;
    d := d || jsonb_build_object('procedimento', v_proc);
  END IF;
  IF p_desfecho = 'obito' THEN
    d := d || jsonb_build_object('setor_obito', coalesce(nullif(btrim(d ->> 'setor_obito'), ''),
                                                        (SELECT nome FROM public.setores WHERE id = e.setor_id)));
    IF private.cid_normalizado(d ->> 'cid_obito') IS NULL THEN RAISE EXCEPTION 'Óbito: informe o CID do óbito.'; END IF;
    v_do := regexp_replace(coalesce(d ->> 'numero_do', ''), '\D', '', 'g');
    IF v_do !~ '^\d{6,12}$' THEN RAISE EXCEPTION 'Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos.'; END IF;
    d := d || jsonb_build_object('cid_obito', private.cid_existente(d ->> 'cid_obito'), 'numero_do', v_do);
  END IF;

  IF p_desfecho = 'observacao' THEN
    SELECT b.setor_id, b.leito_id INTO v_setor, v_leito FROM private.box_livre(e.unidade_id, e.publico) b;
    IF v_setor IS NULL THEN RAISE EXCEPTION 'A unidade não tem setor de Observação cadastrado.'; END IF;
    v_internacao := private.internar_do_episodio(e, 'em_observacao', v_setor, v_leito);
    INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, autor_id)
    VALUES (e.unidade_id, e.paciente_id, v_internacao, 'observacao',
            'Observação: definir conduta (alta ou internação) em até 6 horas.', now() + interval '6 hours',
            private.meu_perfil_id());
    d := d || jsonb_build_object('internacao_id', v_internacao, 'box', v_leito);
  ELSIF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = e.unidade_id
                                        AND ativo AND tipo IN ('internacao', 'uti', 'isolamento')) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status IN ('livre', 'reservado')) THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    v_internacao := private.internar_do_episodio(e, 'internado', v_setor, v_leito);
    d := d || jsonb_build_object('internacao_id', v_internacao);
  END IF;

  v_etapa := CASE p_desfecho WHEN 'observacao' THEN 'observacao' WHEN 'internacao' THEN 'internacao' ELSE 'encerrado' END;
  UPDATE public.episodios
     SET etapa = v_etapa,
         desfecho = p_desfecho,
         desfecho_motivo = nullif(btrim(p_relato), ''),
         desfecho_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END,
         desfecho_em = now(), desfecho_por = private.meu_perfil_id(),
         encerrado_em = CASE WHEN v_etapa = 'encerrado' THEN now() END,
         encerrado_por = CASE WHEN v_etapa = 'encerrado' THEN private.meu_perfil_id() END,
         reavaliar_em = NULL,
         updated_at = now()
   WHERE id = e.id;
  -- Parecer órfão (decisão do RT 03/10/2026): ao encerrar o atendimento da
  -- porta, os pareceres ainda abertos deste episódio são cancelados com motivo
  -- (quando o paciente vai para observação ou internação, o parecer segue o
  -- paciente, então só cancela nos desfechos que encerram).
  IF v_etapa = 'encerrado' THEN
    -- o paciente saiu: a prescrição para de valer e sai da checagem
    PERFORM private.encerrar_prescricoes(NULL, e.id, 'Encerrada com o desfecho do pronto-socorro (' || p_desfecho || ').');
    -- óbito e transferência: exame sem resultado é cancelado com o motivo (RT, 11/10/2026)
    IF p_desfecho IN ('obito', 'transferencia') THEN
      PERFORM private.cancelar_exames_pedidos(NULL, e.id,
        CASE p_desfecho WHEN 'obito' THEN 'Óbito' ELSE 'Transferência externa' END || ': exame cancelado sem resultado.');
    END IF;
    PERFORM private.cancelar_pareceres_do_episodio(e, private.meu_perfil_id(),
      'Atendimento do pronto-socorro encerrado (' || p_desfecho || ') com o parecer ainda pendente.');
  END IF;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id;
  PERFORM private.registrar_auditoria('desfecho', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', v_etapa, 'tipo', p_desfecho));
END $function$;

CREATE OR REPLACE FUNCTION public.dar_alta(p_internacao uuid, p_tipo text, p_cid text, p_quando timestamp with time zone DEFAULT NULL::timestamp with time zone, p_justificativa text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_quando timestamptz := coalesce(p_quando, now());
  v_cid text := upper(btrim(coalesce(p_cid, '')));
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_imp jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação já encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'A alta é do médico.'; END IF;
  IF p_tipo NOT IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito') THEN
    RAISE EXCEPTION 'Tipo de alta inválido.';
  END IF;
  -- evasão: o paciente saiu sem avaliação final, então o CID é opcional
  -- (decisão do RT, 29/09/2026 — a mesma regra da porta); se vier, vale o formato
  IF v_cid = '' AND p_tipo = 'alta_evasao' THEN
    v_cid := NULL;
  ELSIF v_cid !~ '^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,2})?$' THEN
    RAISE EXCEPTION 'Informe o CID de alta.';
  END IF;
  -- o código tem de existir na CID-10 (tarefa 3 do portão)
  IF v_cid IS NOT NULL THEN v_cid := private.cid_existente(v_cid); END IF;
  IF v_quando > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora da alta no futuro.'; END IF;
  IF v_quando < i.data_admissao THEN RAISE EXCEPTION 'Hora da alta antes da admissão.'; END IF;
  IF v_quando < now() - interval '30 minutes' AND length(btrim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Alta retroativa (mais de 30 minutos atrás): justifique (mínimo de 10 letras).';
  END IF;
  IF p_tipo IN ('alta_pedido', 'alta_evasao') AND length(btrim(coalesce(p_observacoes, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_tipo = 'transferencia_externa' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_tipo = 'obito' AND length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o número da Declaração de Óbito.';
  END IF;

  -- óbito e transferência externa não esperam o que ficou aberto (RT, 11/10/2026);
  -- só o agravo suspeito sem notificação continua impedindo
  IF p_tipo IN ('obito', 'transferencia_externa') THEN
    PERFORM private.encerrar_abertos_da_internacao(i, CASE p_tipo WHEN 'obito' THEN 'Óbito' ELSE 'Transferência externa' END);
  END IF;
  v_imp := private.impeditivos_alta(i.id);
  IF p_tipo IN ('obito', 'transferencia_externa') THEN
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_imp FROM jsonb_array_elements(v_imp) x WHERE x ->> 'tipo' <> 'documento';
  END IF;
  IF jsonb_array_length(v_imp) > 0 THEN
    RAISE EXCEPTION 'Existe(m) pendência(s) em aberto: %',
      (SELECT string_agg(x ->> 'descricao', '; ') FROM jsonb_array_elements(v_imp) x);
  END IF;

  PERFORM public.registrar_evento_adt(i.id, p_tipo, NULL, NULL, nullif(btrim(p_observacoes), ''),
    jsonb_build_object('cid', v_cid, 'quando', v_quando) || d);
  UPDATE public.internacoes
     SET data_alta = v_quando, cid_alta = v_cid, alta_por = v_perfil, alta_registrada_em = now(),
         alta_justificativa_retroativa = nullif(btrim(p_justificativa), ''),
         alta_observacoes = nullif(btrim(p_observacoes), ''),
         alta_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END
   WHERE id = i.id;
  UPDATE public.episodios SET encerrado_em = v_quando WHERE id = i.episodio_id;
  -- o paciente saiu: a prescrição para de valer e sai da checagem
  PERFORM private.encerrar_prescricoes(i.id, i.episodio_id, 'Encerrada com a alta da internação (' || p_tipo || ').');
  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = i.paciente_id;
  INSERT INTO public.alta_paciente (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES (i.paciente_id, i.unidade_id, 'concluida', jsonb_build_object('tipo', p_tipo, 'cid', v_cid, 'internacao_id', i.id),
          nullif(btrim(p_observacoes), ''), i.leito_atual_id IS NOT NULL, v_perfil);
END $function$;

CREATE OR REPLACE FUNCTION public.marcar_agravo(p_paciente uuid, p_agravo text, p_cid text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_unidade uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF NOT private.paciente_no_meu_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A suspeita de agravo é marcada pelo médico de plantão.';
  END IF;
  IF length(btrim(coalesce(p_agravo, ''))) < 3 THEN RAISE EXCEPTION 'Informe o agravo.'; END IF;
  IF nullif(btrim(p_cid), '') IS NOT NULL THEN PERFORM private.cid_existente(p_cid); END IF;
  INSERT INTO public.agravos_notificacao (unidade_id, paciente_id, episodio_id, internacao_id, agravo, cid, suspeito_por)
  VALUES (v_unidade, p_paciente, private.episodio_aberto(p_paciente),
          (SELECT id FROM public.internacoes WHERE paciente_id = p_paciente AND status IN ('admitido', 'em_observacao', 'internado') LIMIT 1),
          btrim(p_agravo), private.cid_normalizado(p_cid), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.abrir_notificacao(p_paciente uuid, p_item text DEFAULT NULL::text, p_cid text DEFAULT NULL::text, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  pa public.pacientes;
  v_cid text := private.cid_do_texto(p_cid);
  v_item text;
  v_lnnc public.lnnc_agravos;
  v_ep uuid := p_episodio;
  v_int uuid := p_internacao;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND OR NOT private.pode_notificar(pa.unidade_id) THEN
    RAISE EXCEPTION 'A notificação é aberta pela equipe de plantão da unidade ou pela gestão.';
  END IF;
  v_item := coalesce(nullif(btrim(p_item), ''), private.lnnc_item_do_cid(v_cid));
  SELECT * INTO v_lnnc FROM public.lnnc_agravos WHERE item = v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agravo fora da lista de notificação compulsória (LNNC).'; END IF;
  IF p_cid IS NOT NULL AND v_cid IS NULL THEN RAISE EXCEPTION 'CID fora do formato (ex.: A90).'; END IF;
  IF v_cid IS NOT NULL THEN v_cid := private.cid_existente(v_cid); END IF;

  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = pa.id) THEN
    RAISE EXCEPTION 'Atendimento não é deste paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = pa.id) THEN
    RAISE EXCEPTION 'Internação não é deste paciente.';
  END IF;
  -- sem atendimento informado: o atual (caso aberto na hora, ex.: acidente de trabalho)
  IF v_ep IS NULL AND v_int IS NULL THEN
    IF NOT private.pode_atuar_no_paciente(pa.id) THEN
      RAISE EXCEPTION 'Paciente fora do seu cuidado agora: abra a notificação a partir do atendimento na lista.';
    END IF;
    v_ep := private.episodio_aberto(pa.id);
    v_int := private.internacao_ativa(pa.id);
  END IF;
  v_ep := coalesce(v_ep, (SELECT i.episodio_id FROM public.internacoes i WHERE i.id = v_int));
  v_int := coalesce(v_int, (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = v_ep));

  SELECT a.id INTO v_id FROM public.agravos_notificacao a
   WHERE a.paciente_id = pa.id AND a.situacao IN ('suspeito', 'notificado')
     AND coalesce(a.lnnc_item, private.lnnc_item_do_cid(a.cid)) = v_item
     AND (a.episodio_id IS NOT DISTINCT FROM v_ep OR (v_int IS NOT NULL AND a.internacao_id = v_int))
   ORDER BY a.situacao = 'suspeito' DESC, a.suspeito_em DESC
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.agravos_notificacao
    (unidade_id, paciente_id, episodio_id, internacao_id, agravo, cid, suspeito_por, lnnc_item, origem, ficha)
  VALUES (pa.unidade_id, pa.id, v_ep, v_int, v_lnnc.agravo, v_cid, private.meu_perfil_id(), v_item,
          CASE WHEN v_cid IS NOT NULL THEN 'cid' ELSE 'manual' END,
          private.ficha_sinan_limpa(jsonb_build_object(
            'nome', pa.nome,
            'nascimento', to_char(pa.data_nascimento, 'YYYY-MM-DD'),
            'sexo', CASE WHEN upper(left(pa.sexo, 1)) IN ('M', 'F') THEN upper(left(pa.sexo, 1)) END,
            'gestante', CASE WHEN upper(left(pa.sexo, 1)) = 'M' THEN '6' END,
            'raca', CASE pa.raca_cor WHEN 'branca' THEN '1' WHEN 'preta' THEN '2' WHEN 'amarela' THEN '3'
                                     WHEN 'parda' THEN '4' WHEN 'indigena' THEN '5' WHEN 'sem_informacao' THEN '9' END,
            'cns', pa.cns, 'mae', pa.nome_mae, 'uf', pa.uf, 'municipio', pa.municipio,
            'logradouro', pa.endereco, 'telefone', pa.telefone)))
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('notificacao_aberta', 'agravos_notificacao', v_id, pa.unidade_id,
    jsonb_build_object('item', v_item, 'cid', v_cid));
  RETURN v_id;
END $function$;
