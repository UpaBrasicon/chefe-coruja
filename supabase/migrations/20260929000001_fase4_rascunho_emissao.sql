-- Fase 4.1 — documento assistencial: rascunho → emissão; correção só do autor.
--
--  * O rascunho vive no banco (não só no aparelho): um por autor, paciente,
--    tipo e episódio. Rascunho aberto é impeditivo de alta ("documento do PEP
--    aberto"), então ele precisa existir onde a alta enxerga.
--  * Só o autor edita, emite ou descarta o próprio rascunho.
--  * Emitir dá o número definitivo da unidade (AAAA/000001) e congela o
--    conteúdo; mudar depois é retificação (nova versão, com motivo).
--  * Retificar documento emitido passa a ser só do autor da primeira versão
--    (igual à evolução, fase 3.4).

-- ── retificação só do autor ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.gravar_documento_episodio(
  p_id uuid, p_paciente uuid, p_tipo text, p_conteudo text, p_episodio uuid, p_retifica uuid, p_motivo text,
  p_autor uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text)
RETURNS public.documentos_clinicos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; v_org uuid; v_epi uuid := p_episodio;
  v_ant public.documentos_clinicos; r public.documentos_clinicos;
BEGIN
  IF p_tipo NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'boletim_emergencia', 'sumario_alta',
                    'sumario_obito', 'termo_consentimento', 'laudo_aih', 'evolucao', 'admissao_anamnese', 'prescricao') THEN
    RAISE EXCEPTION 'Tipo de documento desconhecido.';
  END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) = 0 THEN RAISE EXCEPTION 'Documento vazio.'; END IF;
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  IF v_epi IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = v_epi AND paciente_id = p_paciente) THEN
      RAISE EXCEPTION 'Episódio não é deste paciente.';
    END IF;
  ELSE
    SELECT id INTO v_epi FROM public.episodios
     WHERE paciente_id = p_paciente AND (etapa <> 'encerrado' OR encerrado_em > p_hora - interval '12 hours')
     ORDER BY (etapa <> 'encerrado') DESC, chegada_em DESC LIMIT 1;
  END IF;

  IF p_retifica IS NOT NULL THEN
    SELECT * INTO v_ant FROM public.documentos_clinicos WHERE id = p_retifica FOR UPDATE;
    IF NOT FOUND OR v_ant.paciente_id <> p_paciente OR v_ant.tipo_documento <> p_tipo OR v_ant.estado <> 'ativo'
       OR v_ant.episodio_id IS DISTINCT FROM v_epi THEN
      RAISE EXCEPTION 'Só se retifica documento ativo do mesmo episódio e tipo.';
    END IF;
    IF (SELECT d.autor_id FROM public.documentos_clinicos d
         WHERE d.documento_raiz_id = v_ant.documento_raiz_id ORDER BY d.versao LIMIT 1) IS DISTINCT FROM p_autor THEN
      RAISE EXCEPTION 'Só o autor corrige o próprio documento. Emita um documento novo.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo da retificação (mínimo de 10 letras).'; END IF;
  END IF;

  INSERT INTO public.documentos_clinicos
    (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, episodio_id, internacao_id, tipo_documento, conteudo,
     conteudo_hash, autor_id, estado, retificacao_de, motivo_retificacao, numero, emitido_em, sem_conexao, aparelho_id)
  VALUES
    (coalesce(p_id, gen_random_uuid()), coalesce(v_ant.documento_raiz_id, gen_random_uuid()), coalesce(v_ant.versao, 0) + 1,
     v_org, v_unidade, p_paciente, v_epi,
     (SELECT i.id FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado') LIMIT 1),
     p_tipo, p_conteudo,
     encode(extensions.digest(convert_to(p_conteudo, 'UTF8'), 'sha256'), 'hex'), p_autor, 'ativo',
     v_ant.id, CASE WHEN v_ant.id IS NOT NULL THEN btrim(p_motivo) END,
     private.gerar_numero_documento(v_unidade), p_hora, p_sem_conexao, left(p_aparelho, 64))
  RETURNING * INTO r;
  IF v_ant.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now() WHERE id = v_ant.id;
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.gravar_documento_episodio(uuid, uuid, text, text, uuid, uuid, text, uuid, timestamptz, boolean, text)
  FROM PUBLIC, anon, authenticated;

-- ── rascunho ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.salvar_rascunho(p_paciente uuid, p_tipo text, p_conteudo text, p_rascunho uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid; v_org uuid; v_epi uuid; v_int uuid; v_id uuid; d public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF p_tipo NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'prescricao',
                    'sumario_alta', 'termo_consentimento', 'boletim_emergencia') THEN
    RAISE EXCEPTION 'Tipo de documento desconhecido.';
  END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) = 0 THEN RAISE EXCEPTION 'Rascunho vazio.'; END IF;

  IF p_rascunho IS NOT NULL THEN
    SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_rascunho FOR UPDATE;
    IF NOT FOUND OR d.estado <> 'rascunho' OR d.paciente_id <> p_paciente OR d.tipo_documento <> p_tipo THEN
      RAISE EXCEPTION 'Rascunho não encontrado (talvez já emitido).';
    END IF;
    IF d.autor_id <> v_perfil THEN RAISE EXCEPTION 'Só o autor edita o próprio rascunho.'; END IF;
    UPDATE public.documentos_clinicos
       SET conteudo = p_conteudo, conteudo_hash = encode(extensions.digest(convert_to(p_conteudo, 'UTF8'), 'sha256'), 'hex'),
           updated_at = now()
     WHERE id = d.id;
    RETURN d.id;
  END IF;

  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  v_epi := private.episodio_aberto(p_paciente);
  SELECT id INTO v_int FROM public.internacoes
   WHERE paciente_id = p_paciente AND status IN ('admitido', 'em_observacao', 'internado') LIMIT 1;
  -- um rascunho aberto por autor, paciente, tipo e episódio: reaproveita
  SELECT id INTO v_id FROM public.documentos_clinicos
   WHERE paciente_id = p_paciente AND tipo_documento = p_tipo AND autor_id = v_perfil AND estado = 'rascunho'
     AND episodio_id IS NOT DISTINCT FROM v_epi
   ORDER BY updated_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN public.salvar_rascunho(p_paciente, p_tipo, p_conteudo, v_id);
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, episodio_id,
    internacao_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado)
  VALUES (v_id, v_id, 1, v_org, v_unidade, p_paciente, v_epi, v_int, p_tipo, p_conteudo,
          encode(extensions.digest(convert_to(p_conteudo, 'UTF8'), 'sha256'), 'hex'), v_perfil, 'rascunho');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.emitir_rascunho(p_rascunho uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.documentos_clinicos; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_rascunho FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não encontrado.'; END IF;
  IF d.estado = 'ativo' AND d.autor_id = v_perfil THEN   -- duplo clique: já emitido
    RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'episodio_id', d.episodio_id, 'versao', d.versao);
  END IF;
  IF d.estado <> 'rascunho' THEN RAISE EXCEPTION 'Este rascunho não está mais aberto.'; END IF;
  IF d.autor_id <> v_perfil THEN RAISE EXCEPTION 'Só o autor emite o próprio rascunho.'; END IF;
  IF private.pode_atuar_no_paciente(d.paciente_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  UPDATE public.documentos_clinicos
     SET estado = 'ativo', numero = private.gerar_numero_documento(d.unidade_id), emitido_em = now(), updated_at = now()
   WHERE id = d.id
  RETURNING * INTO d;
  PERFORM private.registrar_auditoria('emitir_documento', 'documentos_clinicos', d.id, d.unidade_id,
    jsonb_build_object('tipo', d.tipo_documento, 'de_rascunho', true));
  RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'episodio_id', d.episodio_id, 'versao', d.versao);
END $$;

CREATE OR REPLACE FUNCTION public.descartar_rascunho(p_rascunho uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_rascunho FOR UPDATE;
  IF NOT FOUND OR d.estado <> 'rascunho' THEN RETURN; END IF;
  IF d.autor_id <> private.meu_perfil_id() THEN RAISE EXCEPTION 'Só o autor descarta o próprio rascunho.'; END IF;
  UPDATE public.documentos_clinicos SET estado = 'cancelado', updated_at = now() WHERE id = d.id;
END $$;

REVOKE ALL ON FUNCTION public.salvar_rascunho(uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.emitir_rascunho(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.descartar_rascunho(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_rascunho(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_rascunho(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_rascunho(uuid) TO authenticated;

-- O impeditivo de alta passa a dizer de quem é o rascunho aberto e de que tipo.
CREATE OR REPLACE FUNCTION private.impeditivos_alta(p_internacao uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'tipo'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('tipo', CASE WHEN p.tipo = 'parecer' THEN 'parecer' ELSE 'pendencia' END,
                              'id', p.id,
                              'descricao', CASE WHEN p.tipo = 'parecer' THEN 'Parecer sem resposta: ' ELSE 'Pendência impeditiva: ' END || p.descricao) x
      FROM public.pendencias p
     WHERE p.internacao_id = p_internacao AND p.situacao = 'aberta' AND p.impeditiva
    UNION ALL
    SELECT jsonb_build_object('tipo', 'documento', 'id', d.id, 'autor_id', d.autor_id,
                              'descricao', 'Documento do PEP aberto (rascunho): ' || replace(d.tipo_documento, '_', ' ')
                                || ' de ' || coalesce((SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = d.autor_id), '—'))
      FROM public.documentos_clinicos d
      JOIN public.internacoes i ON i.id = p_internacao
     WHERE d.paciente_id = i.paciente_id AND d.estado = 'rascunho'
       AND (d.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND d.episodio_id = i.episodio_id))
    UNION ALL
    SELECT jsonb_build_object('tipo', 'passagem', 'id', pp.id,
                              'descricao', 'Passagem de plantão aguardando aceite')
      FROM public.passagens_plantao pp
     WHERE pp.internacao_id = p_internacao AND pp.situacao = 'aguardando'
  ) s
$$;
