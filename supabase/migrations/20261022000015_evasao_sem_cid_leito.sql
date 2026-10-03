-- Auditoria do frontend (03/10/2026), defeito 5: evasão sem CID valia só na
-- porta (desfecho do PS). A alta do leito (dar_alta) e o desfecho da
-- observação (finalizar_observacao, que chama dar_alta) ainda exigiam o CID.
-- Agora a evasão aceita CID vazio (grava NULL); os demais tipos continuam
-- exigindo o CID no formato de sempre.

CREATE OR REPLACE FUNCTION public.dar_alta(
  p_internacao uuid, p_tipo text, p_cid text, p_quando timestamptz DEFAULT NULL,
  p_justificativa text DEFAULT NULL, p_observacoes text DEFAULT NULL, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

  v_imp := private.impeditivos_alta(i.id);
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
  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = i.paciente_id;
  INSERT INTO public.alta_paciente (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES (i.paciente_id, i.unidade_id, 'concluida', jsonb_build_object('tipo', p_tipo, 'cid', v_cid, 'internacao_id', i.id),
          nullif(btrim(p_observacoes), ''), i.leito_atual_id IS NOT NULL, v_perfil);
END $$;
