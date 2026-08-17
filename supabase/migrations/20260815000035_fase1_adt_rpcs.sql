-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 ADT — RPCs de transição de estado (event sourcing com cadeia de hash)
-- abrir_internacao   : cria episódio + evento 'admissao'
-- registrar_evento_adt: aplica transição + registra evento imutável
-- registrar_acesso_prontuario: log NGS1 de quem viu o prontuário
-- ─────────────────────────────────────────────────────────────────────────────

-- helper: hash do conteúdo de um evento (integridade)
CREATE OR REPLACE FUNCTION private.hash_evento(
  p_seq integer, p_tipo text, p_estado jsonb, p_autor uuid, p_motivo text, p_hash_previo text
) RETURNS text AS $$
DECLARE v_payload text;
BEGIN
  v_payload := format('%s|%s|%s|%s|%s|%s', p_seq, p_tipo, p_estado::text, p_autor, coalesce(p_motivo,''), coalesce(p_hash_previo,''));
  RETURN encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');
END; $$ LANGUAGE plpgsql IMMUTABLE;

-- Abre um episódio de internação (admissão)
CREATE OR REPLACE FUNCTION public.abrir_internacao(
  p_paciente uuid,
  p_unidade uuid,
  p_tipo_internacao text DEFAULT 'urgencia',
  p_origem_admissao text DEFAULT 'emergencia',
  p_setor uuid DEFAULT NULL,
  p_leito uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_org uuid;
  v_ep uuid;
  v_seq integer := 1;
  v_hash text;
  v_estado jsonb;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada'; END IF;

  IF EXISTS (SELECT 1 FROM public.internacoes
             WHERE paciente_id = p_paciente AND status IN ('admitido','em_observacao','internado')) THEN
    RAISE EXCEPTION 'Paciente já possui internação ativa.';
  END IF;

  v_estado := jsonb_build_object(
    'status','admitido','setor',p_setor,'leito',p_leito,
    'tipo_internacao',p_tipo_internacao,'origem',p_origem_admissao
  );
  v_hash := private.hash_evento(1, 'admissao', v_estado, v_perfil, 'Admissão', NULL);

  INSERT INTO public.internacoes
    (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao,
     status, leito_atual_id, setor_atual_id, data_entrada_setor)
  VALUES
    (v_org, p_unidade, p_paciente, p_tipo_internacao, p_origem_admissao,
     'admitido', p_leito, p_setor, CASE WHEN p_setor IS NOT NULL THEN now() END)
  RETURNING id INTO v_ep;

  INSERT INTO public.eventos_adt
    (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
     estado_antes, estado_depois, setor_destino_id, leito_destino_id, autor_id,
     motivo, hash_previo, hash_conteudo)
  VALUES
    (v_seq, v_org, p_unidade, v_ep, p_paciente, 'admissao',
     NULL, v_estado, p_setor, p_leito, v_perfil,
     'Admissão', NULL, v_hash);

  -- se leito informado, emite ocupação do leito
  IF p_leito IS NOT NULL THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito, p_unidade, 'ocupacao', 'livre', 'ocupado', v_ep, v_perfil, 'Admissão');
  END IF;

  RETURN v_ep;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Registra uma transição de estado (transferência, alta, etc.)
-- p_estado_depois: {status, setor_id, leito_id}
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

  -- transições de término (terminal)
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

  -- atualiza o episódio (projeção do estado atual)
  UPDATE public.internacoes
    SET status = v_status_novo,
        setor_atual_id = coalesce(p_setor_destino, v_setor_atual_id),
        leito_atual_id = CASE
                          WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN NULL
                          ELSE coalesce(p_leito_destino, leito_atual_id)
                         END,
        data_entrada_setor = CASE WHEN p_setor_destino IS NOT NULL AND p_setor_destino <> v_setor_atual_id THEN now() ELSE data_entrada_setor END,
        data_alta = CASE
                      WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN now()
                      ELSE data_alta
                    END,
        updated_at = now()
    WHERE id = p_internacao;

  -- libera o leito anterior em alta
  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito')
     AND v_leito_origem IS NOT NULL THEN
    UPDATE public.leitos SET status = 'higienizacao' WHERE id = v_leito_origem;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito_origem, v_ep.unidade_id, 'liberacao', 'ocupado', 'higienizacao', p_internacao, v_perfil, 'Alta/óbito liberou leito');
  END IF;

  -- ocupa novo leito em transferência (se informado e diferente)
  IF p_leito_destino IS NOT NULL AND p_leito_destino <> v_leito_origem THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito_destino;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito_destino, v_ep.unidade_id, 'ocupacao', 'livre', 'ocupado', p_internacao, v_perfil, 'Transferência de leito');
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Registra acesso a prontuário (NGS1 — quem viu)
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
     tipo_acesso, documento_id, ip, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = p_unidade),
     p_unidade, p_paciente, p_internacao, v_perfil,
     private.papel_na_unidade(p_unidade), p_tipo_acesso, p_documento,
     NULLIF(host(client_addr())::text, ''), NULL);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
