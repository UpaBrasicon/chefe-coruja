-- ─────────────────────────────────────────────────────────────────────────────
-- Correções ADT após teste real (gestor via PostgREST)
-- 1. Drop da assinatura duplicada de salvar_documento (0036 era concorrente).
-- 2. Fix registrar_evento_adt (v_setor_atual_id -> v_ep.setor_atual_id).
-- 3. Fix registrar_acesso_prontuario (client_addr() inexistente em SECURITY DEFINER).
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.salvar_documento(uuid, uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.salvar_documento(
  p_paciente uuid,
  p_unidade uuid,
  p_tipo text,
  p_conteudo text,
  p_internacao uuid DEFAULT NULL,
  p_motivo_retificacao text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_hash text;
  v_atual public.documentos_clinicos%ROWTYPE;
  v_raiz uuid;
  v_versao integer;
  v_org uuid;
  v_id uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF NOT private.pode_escrever_documento(p_unidade, p_internacao) THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala deste paciente ou da unidade.';
  END IF;
  IF p_conteudo IS NULL OR trim(p_conteudo) = '' THEN
    RAISE EXCEPTION 'Conteúdo do documento não pode ser vazio.';
  END IF;

  v_hash := encode(sha256(convert_to(p_conteudo, 'UTF8')), 'hex');
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;

  SELECT * INTO v_atual FROM public.documentos_clinicos
    WHERE paciente_id = p_paciente AND tipo_documento = p_tipo
    ORDER BY versao DESC LIMIT 1;

  IF v_atual.id IS NOT NULL AND v_atual.conteudo_hash = v_hash THEN
    RETURN v_atual.id;
  END IF;

  v_raiz := coalesce(v_atual.documento_raiz_id, gen_random_uuid());
  v_versao := coalesce(v_atual.versao, 0) + 1;

  INSERT INTO public.documentos_clinicos
    (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
     tipo_documento, conteudo, conteudo_hash, autor_id, estado,
     retificacao_de, motivo_retificacao)
  VALUES
    (v_raiz, v_versao, v_org, p_unidade, p_paciente, p_internacao,
     p_tipo, p_conteudo, v_hash, v_perfil, 'ativo',
     v_atual.id, coalesce(p_motivo_retificacao, 'Nova versão'))
  RETURNING id INTO v_id;

  -- a versão anterior deixa de ser a ativa (nunca é apagada)
  IF v_atual.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now()
      WHERE id = v_atual.id;
  END IF;

  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix registrar_evento_adt: variável de setor atual
CREATE OR REPLACE FUNCTION public.registrar_evento_adt(
  p_internacao uuid,
  p_tipo_evento text,
  p_setor_destino uuid DEFAULT NULL,
  p_leito_destino uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_ep public.internacoes%ROWTYPE;
  v_org uuid;
  v_seq integer;
  v_hash_previo text;
  v_hash text;
  v_estado_antes jsonb;
  v_estado_depois jsonb;
  v_status_novo text;
  v_leito_origem uuid;
  v_setor_origem uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_ep FROM public.internacoes WHERE id = p_internacao;
  IF v_ep.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;

  v_status_novo := CASE p_tipo_evento
    WHEN 'alta_melhorada' THEN 'alta_melhorada'
    WHEN 'alta_pedido' THEN 'alta_pedido'
    WHEN 'alta_evasao' THEN 'alta_evasao'
    WHEN 'transferencia_externa' THEN 'transferencia_externa'
    WHEN 'obito' THEN 'obito'
    WHEN 'internacao' THEN 'internado'
    WHEN 'entrada_observacao' THEN 'em_observacao'
    ELSE v_ep.status
  END;

  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN
    IF v_ep.status NOT IN ('admitido','em_observacao','internado') THEN
      RAISE EXCEPTION 'Internação já encerrada.';
    END IF;
  END IF;

  SELECT max(seq) INTO v_seq FROM public.eventos_adt WHERE internacao_id = p_internacao;
  v_seq := coalesce(v_seq, 0) + 1;

  SELECT hash_conteudo INTO v_hash_previo FROM public.eventos_adt
    WHERE internacao_id = p_internacao AND seq = v_seq - 1 ORDER BY seq DESC LIMIT 1;

  v_leito_origem := v_ep.leito_atual_id;
  v_setor_origem := v_ep.setor_atual_id;
  v_estado_antes := jsonb_build_object(
    'status', v_ep.status, 'setor', v_setor_origem, 'leito', v_leito_origem);
  v_estado_depois := jsonb_build_object(
    'status', v_status_novo,
    'setor', coalesce(p_setor_destino, v_setor_origem),
    'leito', coalesce(p_leito_destino, v_leito_origem));

  v_hash := private.hash_evento(v_seq, p_tipo_evento, v_estado_depois, v_perfil, p_motivo, v_hash_previo);

  INSERT INTO public.eventos_adt
    (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
     estado_antes, estado_depois,
     leito_origem_id, leito_destino_id, setor_origem_id, setor_destino_id,
     autor_id, motivo, payload, hash_previo, hash_conteudo)
  VALUES
    (v_seq, v_ep.organizacao_id, v_ep.unidade_id, v_ep.id, v_ep.paciente_id, p_tipo_evento,
     v_estado_antes, v_estado_depois,
     v_leito_origem, p_leito_destino, v_setor_origem, p_setor_destino,
     v_perfil, p_motivo, p_payload, v_hash_previo, v_hash);

  UPDATE public.internacoes
    SET status = v_status_novo,
        setor_atual_id = coalesce(p_setor_destino, setor_atual_id),
        leito_atual_id = CASE
                          WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN NULL
                          ELSE coalesce(p_leito_destino, leito_atual_id)
                         END,
        data_entrada_setor = CASE WHEN p_setor_destino IS NOT NULL AND p_setor_destino <> setor_atual_id THEN now() ELSE data_entrada_setor END,
        data_alta = CASE
                      WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN now()
                      ELSE data_alta
                    END,
        updated_at = now()
    WHERE id = p_internacao;

  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito')
     AND v_leito_origem IS NOT NULL THEN
    UPDATE public.leitos SET status = 'higienizacao' WHERE id = v_leito_origem;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito_origem, v_ep.unidade_id, 'liberacao', 'ocupado', 'higienizacao', p_internacao, v_perfil, 'Alta/óbito liberou leito');
  END IF;

  IF p_leito_destino IS NOT NULL AND p_leito_destino <> v_leito_origem THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito_destino;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito_destino, v_ep.unidade_id, 'ocupacao', 'livre', 'ocupado', p_internacao, v_perfil, 'Transferência de leito');
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix registrar_acesso_prontuario: remover client_addr()
CREATE OR REPLACE FUNCTION public.registrar_acesso_prontuario(
  p_paciente uuid,
  p_unidade uuid,
  p_tipo_acesso text DEFAULT 'leitura_prontuario',
  p_internacao uuid DEFAULT NULL,
  p_documento uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF v_perfil IS NULL THEN RETURN; END IF;
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_id, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = p_unidade),
     p_unidade, p_paciente, p_internacao, v_perfil,
     private.papel_na_unidade(p_unidade), p_tipo_acesso, p_documento,
     NULL);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
