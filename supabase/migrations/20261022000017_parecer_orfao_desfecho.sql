-- Auditoria do frontend (03/10/2026), defeito 3 / decisão do RT: cancela os
-- pareceres ainda em aberto (solicitado ou em análise) de um episódio, com um
-- documento de cancelamento, quando o atendimento da porta encerra. Espelha
-- public.cancelar_parecer, mas sem pedir o perfil interativo.
CREATE OR REPLACE FUNCTION private.cancelar_pareceres_do_episodio(
  e public.episodios, p_autor uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pm public.pareceres_medicos; d public.documentos_clinicos;
BEGIN
  FOR pm IN SELECT * FROM public.pareceres_medicos
             WHERE episodio_id = e.id AND status IN ('solicitado', 'em_analise') FOR UPDATE
  LOOP
    d := private.gravar_documento_episodio(NULL, pm.paciente_id, 'parecer',
      'CANCELAMENTO DE SOLICITAÇÃO DE PARECER MÉDICO' || E'
' ||
      'Especialidade: ' || pm.especialidade ||
        coalesce(' — solicitação nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = pm.documento_solicitacao_id), '') || E'
' ||
      'Cancelado por: ' || private.identificacao_medico(p_autor) || E'
' ||
      'Data e hora: ' || private.hora_brasilia(now()) || ' (Brasília)' || E'
' ||
      CASE WHEN pm.status = 'em_analise' THEN 'Estava em análise por: ' || private.identificacao_medico(pm.analista_id) || E'
' ELSE '' END ||
      E'
' || 'Motivo:' || E'
' || btrim(p_motivo),
      pm.episodio_id, NULL, NULL, p_autor, now(), false, NULL);
    UPDATE public.pareceres_medicos
       SET status = 'cancelado', cancelado_em = now(), cancelado_por = p_autor, motivo_cancelamento = btrim(p_motivo),
           documento_cancelamento_id = d.id, rascunho = NULL, rascunho_salvo_em = NULL
     WHERE id = pm.id;
    PERFORM private.registrar_auditoria('cancelar_parecer', 'pareceres_medicos', pm.id, pm.unidade_id,
      jsonb_build_object('status', 'cancelado', 'status_anterior', pm.status, 'automatico', true));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.cancelar_pareceres_do_episodio(public.episodios, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_desfecho(
  p_episodio uuid, p_desfecho text, p_relato text DEFAULT NULL, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    d := d || jsonb_build_object('cid_alta', private.cid_normalizado(v_cid));
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
    d := d || jsonb_build_object('cid_obito', private.cid_normalizado(d ->> 'cid_obito'), 'numero_do', v_do);
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
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status = 'livre') THEN
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
    PERFORM private.cancelar_pareceres_do_episodio(e, private.meu_perfil_id(),
      'Atendimento do pronto-socorro encerrado (' || p_desfecho || ') com o parecer ainda pendente.');
  END IF;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id;
  PERFORM private.registrar_auditoria('desfecho', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', v_etapa, 'tipo', p_desfecho));
END $$;
REVOKE ALL ON FUNCTION public.registrar_desfecho(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_desfecho(uuid, text, text, jsonb) TO authenticated;
