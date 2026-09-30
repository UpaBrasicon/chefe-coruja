-- Porte do frontend, onda 6 — folhas impressas A4 geradas no servidor.
--
-- A folha segue a gramática do protótipo (cabeçalho da unidade e do paciente
-- repetido em cada página, faixa de alergia, rodapé com número, protocolo,
-- código de conferência e autor). O desenho mora em src/lib/folhas.ts (cópia
-- em supabase/functions/_shared/folhas.ts); o banco entrega os dados.
--
-- 1. private.folha_cabecalho(paciente): unidade (nome, CNES, município/UF),
--    paciente (cadastro, local atual: setor e leito) e alergias ATIVAS na hora
--    da impressão — a faixa de alergia sai do banco, não da tela.
-- 2. private.folha_registro(perfil): registro no conselho do profissional
--    ("CRM 12345/SP", "COREN …"), para a linha de assinatura.
-- 3. folha_documento (Fase 4.2) passa a devolver também o cabeçalho, o
--    registro do autor, a ficha estruturada da admissão (admissao_fichas,
--    quando existe) e o cancelamento; imprime o RASCUNHO do próprio autor (a
--    folha sai com a marca "RASCUNHO – NÃO ASSINADO", sem número) e o
--    documento cancelado (sai marcado CANCELADO, com quem e por quê).
-- 4. folha_relatorio(tipo, paciente, internação, episódio, ids): RELATÓRIOS
--    de várias linhas, que não são um documento numerado. DECISÃO: uma RPC de
--    leitura que registra a impressão (log_acesso_prontuario, protocolo
--    IMP-…) e devolve os dados + cabeçalho; a mesma edge function `folha`
--    monta o HTML (parâmetro `relatorio`). Tipos:
--      classificacao          episódio   classificações do episódio, sinais crus
--      evolucao               internação historico_evolucoes (ids = selecionados)
--      alergias               paciente   alergias_do_paciente
--      avaliacao              paciente   avaliacoes_do_paciente (ids opcionais)
--      pareceres              paciente   pareceres_medicos (ids opcionais) — o
--                                        solicitante e o parecerista imprimem
--                                        mesmo fora do plantão do paciente
--      encaminhamento_interno paciente   encaminhamentos_do_paciente (ids)
--    "Atendimentos notificáveis" (paisagem) tem folha pronta em folhas.ts, mas
--    é um relatório da UNIDADE (não de um paciente) e depende do catálogo LNNC
--    da frente de notificação compulsória: fica fora desta RPC.
--    Quem imprime é quem atua no paciente (pode_atuar_no_paciente, a mesma
--    regra de registrar_impressao); as leituras reaproveitam as RPCs de cada
--    tela, que conferem o próprio acesso.
--
-- SECURITY DEFINER com search_path vazio; segundo fator; REVOKE de PUBLIC e
-- anon. Reaplicável.

-- ── 1. registro no conselho ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.folha_registro(p_perfil uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN nullif(btrim(coalesce(p.registro_numero, '')), '') IS NOT NULL
      THEN btrim(coalesce(nullif(btrim(p.conselho), ''), 'Registro') || ' ' || btrim(p.registro_numero)
                 || coalesce('/' || nullif(btrim(p.registro_uf), ''), ''))
    WHEN nullif(btrim(coalesce(p.crm, '')), '') IS NOT NULL
      THEN 'CRM ' || btrim(p.crm) || coalesce('/' || nullif(btrim(p.uf_crm), ''), '')
  END
  FROM public.perfis p WHERE p.id = p_perfil
$$;
REVOKE ALL ON FUNCTION private.folha_registro(uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. cabeçalho da folha ───────────────────────────────────────────────────
-- Chamada só de dentro das RPCs de folha, depois da conferência de acesso.
CREATE OR REPLACE FUNCTION private.folha_cabecalho(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  u public.unidades;
  v_setor text;
  v_leito text;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO u FROM public.unidades WHERE id = pa.unidade_id;
  SELECT s.nome, l.identificador INTO v_setor, v_leito
    FROM public.internacoes i
    LEFT JOIN public.setores s ON s.id = i.setor_atual_id
    LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
   WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY i.created_at DESC LIMIT 1;
  IF v_setor IS NULL THEN
    SELECT s.nome INTO v_setor
      FROM public.episodios e JOIN public.setores s ON s.id = e.setor_id
     WHERE e.paciente_id = p_paciente AND e.encerrado_em IS NULL
     ORDER BY e.chegada_em DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'unidade', jsonb_strip_nulls(jsonb_build_object('nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf)),
    'paciente', jsonb_strip_nulls(jsonb_build_object(
      'nome', coalesce(nullif(btrim(pa.nome_social), ''), pa.nome), 'nascimento', pa.data_nascimento, 'sexo', pa.sexo,
      'prontuario', pa.prontuario, 'cns', pa.cns, 'cpf', pa.cpf, 'mae', pa.nome_mae, 'telefone', pa.telefone,
      'endereco', pa.endereco, 'municipio', pa.municipio, 'uf', pa.uf, 'raca_cor', pa.raca_cor,
      'responsavel', pa.responsavel_nome, 'responsavel_telefone', pa.responsavel_telefone,
      'setor', v_setor, 'leito', v_leito)),
    'alergias', jsonb_build_object(
      'estado', CASE
        WHEN EXISTS (SELECT 1 FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL) THEN 'tem'
        WHEN EXISTS (SELECT 1 FROM public.alergias_negacoes WHERE paciente_id = p_paciente AND encerrada_em IS NULL) THEN 'nega'
        ELSE 'nao_registrada' END,
      'itens', coalesce((
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('substancia', a.substancia, 'gravidade', a.gravidade, 'reacao', a.reacao))
                         ORDER BY a.registrado_em)
          FROM public.alergias_paciente a
         WHERE a.paciente_id = p_paciente AND a.inativada_em IS NULL), '[]'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION private.folha_cabecalho(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. folha do documento ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.folha_documento(p_documento uuid, p_tipo_impressao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  imp record;
  v_ficha jsonb;
  v_canc jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF d.estado = 'rascunho' THEN
    IF d.autor_id IS DISTINCT FROM v_perfil THEN
      RAISE EXCEPTION 'Rascunho só é impresso por quem o escreve.';
    END IF;
  ELSIF d.estado NOT IN ('ativo', 'retificado', 'assinado', 'cancelado') OR d.numero IS NULL THEN
    RAISE EXCEPTION 'Só se imprime documento emitido (ou o seu rascunho).';
  END IF;
  IF NOT (d.autor_id = v_perfil OR private.pode_atuar_no_paciente(d.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  SELECT * INTO imp FROM public.registrar_impressao(d.paciente_id,
    coalesce(nullif(btrim(p_tipo_impressao), ''), replace(d.tipo_documento, '_', ' ')), d.internacao_id, d.id);

  -- a ficha estruturada da admissão (porte, 20261005000002), quando existe
  IF d.tipo_documento = 'admissao_anamnese' AND to_regclass('public.admissao_fichas') IS NOT NULL THEN
    EXECUTE 'SELECT f.dados || jsonb_strip_nulls(jsonb_build_object(''setor'', s.nome))
               FROM public.admissao_fichas f LEFT JOIN public.setores s ON s.id = f.setor_id
              WHERE f.documento_id = $1'
      INTO v_ficha USING d.id;
  END IF;
  -- cancelamento do documento emitido (porte, 20261005000003), quando existe
  IF d.estado = 'cancelado' THEN
    SELECT jsonb_strip_nulls(jsonb_build_object('em', x ->> 'cancelado_em', 'motivo', x ->> 'motivo_cancelamento',
             'por', (SELECT nome_completo FROM public.perfis WHERE id = (x ->> 'cancelado_por')::uuid)))
      INTO v_canc FROM (SELECT to_jsonb(d) AS x) t;
  END IF;

  RETURN jsonb_build_object(
    'tipo', d.tipo_documento,
    'conteudo', d.conteudo,
    'numero', d.numero,
    'versao', d.versao,
    'estado', d.estado,
    'autor', (SELECT nome_completo FROM public.perfis WHERE id = d.autor_id),
    'autor_registro', private.folha_registro(d.autor_id),
    'codigo', upper(substr(d.conteudo_hash, 1, 4) || '-' || substr(d.conteudo_hash, 5, 4) || '-' || substr(d.conteudo_hash, 9, 4)),
    'protocolo', imp.protocolo,
    'impresso_em', imp.emitido_em,
    'emitido_em', coalesce(d.emitido_em, d.created_at),
    'cabecalho', private.folha_cabecalho(d.paciente_id),
    'estruturado', v_ficha,
    'cancelamento', v_canc);
END $$;
REVOKE ALL ON FUNCTION public.folha_documento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_documento(uuid, text) TO authenticated;

-- ── 4. relatórios ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.folha_relatorio(
  p_tipo text, p_paciente uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL, p_episodio uuid DEFAULT NULL, p_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_pac uuid := p_paciente;
  e public.episodios;
  i public.internacoes;
  v_atua boolean;
  v_rot text;
  v_dados jsonb;
  imp record;
  v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('classificacao', 'evolucao', 'alergias', 'avaliacao', 'pareceres', 'encaminhamento_interno') THEN
    RAISE EXCEPTION 'Relatório desconhecido: %.', coalesce(p_tipo, '—');
  END IF;
  IF p_ids IS NOT NULL AND cardinality(p_ids) > 500 THEN RAISE EXCEPTION 'Selecione no máximo 500 registros.'; END IF;
  IF p_episodio IS NOT NULL THEN
    SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
    IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
    IF v_pac IS NOT NULL AND e.paciente_id <> v_pac THEN RAISE EXCEPTION 'Episódio não é deste paciente.'; END IF;
    v_pac := e.paciente_id;
  END IF;
  IF p_internacao IS NOT NULL THEN
    SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
    IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
    IF v_pac IS NOT NULL AND i.paciente_id <> v_pac THEN RAISE EXCEPTION 'Internação não é deste paciente.'; END IF;
    v_pac := i.paciente_id;
  END IF;
  IF v_pac IS NULL THEN RAISE EXCEPTION 'Informe o paciente.'; END IF;
  IF p_tipo = 'classificacao' AND p_episodio IS NULL THEN RAISE EXCEPTION 'Informe o episódio da classificação.'; END IF;
  IF p_tipo = 'evolucao' AND p_internacao IS NULL THEN RAISE EXCEPTION 'Informe a internação do relatório de evolução.'; END IF;

  v_rot := CASE p_tipo
    WHEN 'classificacao' THEN 'Classificação de risco'
    WHEN 'evolucao' THEN 'Relatório de evolução'
    WHEN 'alergias' THEN 'Alergias e eventos adversos'
    WHEN 'avaliacao' THEN 'Avaliações'
    WHEN 'pareceres' THEN 'Parecer médico'
    ELSE 'Encaminhamento interno' END;

  -- quem imprime: quem atua no paciente; o parecer, também quem pediu ou analisa
  v_atua := private.pode_atuar_no_paciente(v_pac) IS TRUE;
  IF v_atua THEN
    SELECT * INTO imp FROM public.registrar_impressao(v_pac, v_rot, p_internacao, NULL);
  ELSIF p_tipo = 'pareceres' AND EXISTS (
      SELECT 1 FROM public.pareceres_medicos x
       WHERE x.paciente_id = v_pac AND (x.solicitante_id = v_perfil OR x.analista_id = v_perfil)
         AND (p_ids IS NULL OR x.id = ANY (p_ids))) THEN
    SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = v_pac;
    INSERT INTO public.log_acesso_prontuario
      (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel, tipo_acesso, documento_id, documento_tipo, ip, user_agent)
    VALUES ((SELECT organizacao_id FROM public.unidades WHERE id = v_unidade), v_unidade, v_pac, p_internacao, v_perfil,
            nullif(private.papel_na_unidade(v_unidade), ''), 'impressao', NULL, v_rot, private.requisicao_ip(), private.requisicao_navegador())
    RETURNING 'IMP-' || upper(left(replace(id::text, '-', ''), 10)) AS protocolo, created_at AS emitido_em INTO imp;
  ELSE
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;

  IF p_tipo = 'classificacao' THEN
    v_dados := jsonb_build_object(
      'episodio', jsonb_strip_nulls(jsonb_build_object(
        'chegada_em', e.chegada_em, 'queixa', e.queixa, 'prioridades_legais', to_jsonb(e.prioridades_legais),
        'atendimento_iniciado_em', e.atendimento_iniciado_em,
        'medico', (SELECT nome_completo FROM public.perfis WHERE id = e.atendimento_medico_id),
        'suspeita_infeccao_em', e.suspeita_infeccao_em)),
      'classificacoes', coalesce((
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'cor', c.cor, 'fluxograma_nome', c.fluxograma_nome, 'discriminador', c.discriminador, 'queixa', c.queixa,
                 'reclassificacao', c.reclassificacao, 'motivo', c.motivo, 'justificativa', c.justificativa,
                 'autor_nome', pf.nome_completo, 'autor_papel', c.autor_papel, 'autor_registro', private.folha_registro(c.autor_id),
                 'criado_em', c.criado_em, 'dor', c.dor, 'oxigenio', c.oxigenio, 'gestacao', c.gestacao, 'avaliacao', c.avaliacao,
                 -- sinais vitais CRUS, como a enfermagem registrou (sem faixa nem marca)
                 'sinais', (SELECT jsonb_object_agg(cc.nome, o.valor_num)
                              FROM public.observacao o JOIN public.conceito cc ON cc.id = o.conceito_id
                             WHERE o.episodio_id = c.episodio_id AND o.aferido_em = c.criado_em AND o.registrado_por = c.autor_id)))
                 ORDER BY c.criado_em DESC)
          FROM public.classificacoes_risco c LEFT JOIN public.perfis pf ON pf.id = c.autor_id
         WHERE c.episodio_id = e.id), '[]'::jsonb));
  ELSIF p_tipo = 'evolucao' THEN
    v_dados := jsonb_build_object(
      'internacao', jsonb_build_object('data_admissao', i.data_admissao),
      'registros', coalesce((
        SELECT jsonb_agg(x ORDER BY (x ->> 'registrado_em')::timestamptz DESC)
          FROM jsonb_array_elements(public.historico_evolucoes(i.id)) x
         WHERE p_ids IS NULL OR (x ->> 'id')::uuid = ANY (p_ids)), '[]'::jsonb));
  ELSIF p_tipo = 'alergias' THEN
    v_dados := public.alergias_do_paciente(v_pac);
  ELSIF p_tipo = 'avaliacao' THEN
    v_dados := jsonb_build_object('avaliacoes', coalesce((
      SELECT jsonb_agg(x ORDER BY (x ->> 'registrado_em')::timestamptz DESC)
        FROM jsonb_array_elements(public.avaliacoes_do_paciente(v_pac)) x
       WHERE p_ids IS NULL OR (x ->> 'id')::uuid = ANY (p_ids)), '[]'::jsonb));
  ELSIF p_tipo = 'encaminhamento_interno' THEN
    v_dados := jsonb_build_object('encaminhamentos', coalesce((
      SELECT jsonb_agg(x ORDER BY (x ->> 'encaminhado_em')::timestamptz DESC)
        FROM jsonb_array_elements(public.encaminhamentos_do_paciente(v_pac)) x
       WHERE p_ids IS NULL OR (x ->> 'id')::uuid = ANY (p_ids)), '[]'::jsonb));
  ELSE
    v_dados := jsonb_build_object('pareceres', coalesce((
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', pm.id, 'especialidade', pm.especialidade, 'prestador', pm.prestador, 'prioridade', pm.prioridade,
               'pergunta', pm.pergunta, 'status', pm.status,
               'solicitante_nome', ps.nome_completo, 'solicitante_registro', private.folha_registro(pm.solicitante_id),
               'solicitado_em', pm.solicitado_em,
               'analista_nome', pa.nome_completo, 'analista_registro', private.folha_registro(pm.analista_id),
               'analise_iniciada_em', pm.analise_iniciada_em, 'resposta', pm.resposta, 'respondido_em', pm.respondido_em,
               'cancelado_nome', pc.nome_completo, 'cancelado_em', pm.cancelado_em, 'motivo_cancelamento', pm.motivo_cancelamento,
               'documento_solicitacao_numero', ds.numero, 'documento_resposta_numero', dr.numero))
               ORDER BY pm.solicitado_em DESC)
        FROM public.pareceres_medicos pm
        JOIN public.perfis ps ON ps.id = pm.solicitante_id
        LEFT JOIN public.perfis pa ON pa.id = pm.analista_id
        LEFT JOIN public.perfis pc ON pc.id = pm.cancelado_por
        LEFT JOIN public.documentos_clinicos ds ON ds.id = pm.documento_solicitacao_id
        LEFT JOIN public.documentos_clinicos dr ON dr.id = pm.documento_resposta_id
       WHERE pm.paciente_id = v_pac AND (p_ids IS NULL OR pm.id = ANY (p_ids))
         AND (v_atua OR pm.solicitante_id = v_perfil OR pm.analista_id = v_perfil)), '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'tipo', p_tipo,
    'dados', v_dados,
    'cabecalho', private.folha_cabecalho(v_pac),
    'autor', (SELECT nome_completo FROM public.perfis WHERE id = v_perfil),
    'autor_registro', private.folha_registro(v_perfil),
    'protocolo', imp.protocolo,
    'impresso_em', imp.emitido_em);
END $$;
REVOKE ALL ON FUNCTION public.folha_relatorio(text, uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_relatorio(text, uuid, uuid, uuid, uuid[]) TO authenticated;
