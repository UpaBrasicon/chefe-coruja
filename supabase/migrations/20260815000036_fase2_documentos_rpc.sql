-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2 ADT — RPCs de documentos clínicos (persistência com versionamento)
-- O front não insere direto em documentos_clinicos (RLS: só escrita via RPC).
-- Validação: autor deve ser gestor da unidade OU plantonista na escala atual
-- (setor da internação) OU super.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.pode_escrever_documento(p_unidade uuid, p_internacao uuid)
RETURNS boolean AS $$
BEGIN
  IF private.eh_super_admin() THEN RETURN true; END IF;
  IF private.papel_na_unidade(p_unidade) = 'gestor' THEN RETURN true; END IF;
  IF private.papel_na_unidade(p_unidade) = 'plantonista'
     AND private.na_escala_agora(p_unidade) THEN RETURN true; END IF;
  IF p_internacao IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.internacoes i
    WHERE i.id = p_internacao
      AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
  ) THEN RETURN true; END IF;
  RETURN false;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Salva/cria a versão mais recente de um documento. Se já existe versão com o
-- mesmo hash, retorna a existente (idempotente). Retificação = nova versão.
CREATE OR REPLACE FUNCTION public.salvar_documento(
  p_paciente uuid,
  p_unidade uuid,
  p_internacao uuid,
  p_tipo text,
  p_conteudo text,
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
  v_novo_estado text;
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
    RETURN v_atual.id; -- idempotente
  END IF;

  v_raiz := coalesce(v_atual.documento_raiz_id, gen_random_uuid());
  v_versao := coalesce(v_atual.versao, 0) + 1;
  v_novo_estado := CASE WHEN v_atual.id IS NOT NULL THEN 'retificado' ELSE 'ativo' END;

  INSERT INTO public.documentos_clinicos
    (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
     tipo_documento, conteudo, conteudo_hash, autor_id, estado,
     retificacao_de, motivo_retificacao)
  VALUES
    (v_raiz, v_versao, v_org, p_unidade, p_paciente, p_internacao,
     p_tipo, p_conteudo, v_hash, v_perfil, v_novo_estado,
     v_atual.id, coalesce(p_motivo_retificacao, 'Nova versão'))
  RETURNING id INTO v_id;

  -- a versão anterior deixa de ser a "ativa" (metadata; nunca apagada)
  IF v_atual.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now()
      WHERE id = v_atual.id;
  END IF;

  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
