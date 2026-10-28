-- Ponto 9 do plantonista (docs/plantonista/PONTO-09-EVOLUCAO.md; o RT aprovou
-- em 28/10/2026 a regra B e o Diagnóstico como sub-aba de Evolução).
--
-- 1. Regra B: a evolução médica passa a valer também para o médico de plantão
--    agora no setor do CADASTRO do paciente, como já vale para o diagnóstico
--    (private.paciente_em_cuidado_no_plantao). Só a evolução médica (tipo
--    'evolucao'): a regra geral private.cuido_da_internacao (alta, documentos,
--    passagem, enfermagem…) não muda.
-- 2. public.por_que_nao_evoluo: o motivo de não poder evoluir, para a tela
--    dizer o que fazer (check-in, setor, papel).
--
-- Expand: cria duas funções e troca, em contexto_evolucao e registrar_evolucao
-- (copiadas das últimas definições, 20261119000004 e 20261004000006), só a
-- linha da permissão.
--
-- Rollback (testado na homologação): reaplicar as definições de
-- contexto_evolucao (20261119000004) e registrar_evolucao (20261004000006) e
--   DROP FUNCTION IF EXISTS public.por_que_nao_evoluo(uuid);
--   DROP FUNCTION IF EXISTS private.evoluo_internacao(public.internacoes);

-- quem evolui (evolução médica): o cuidado de sempre (setor da internação) ou o
-- plantão no setor do cadastro do paciente
CREATE OR REPLACE FUNCTION private.evoluo_internacao(i public.internacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.cuido_da_internacao(i)
      OR EXISTS (SELECT 1 FROM public.pacientes pa
                  WHERE pa.id = i.paciente_id AND pa.setor_id IN (SELECT private.setores_na_escala_agora()))
$$;
REVOKE ALL ON FUNCTION private.evoluo_internacao(public.internacoes) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.evoluo_internacao(public.internacoes) TO authenticated;

-- por que não posso evoluir: encerrada, papel, check-in pendente, plantão em
-- outro setor ou sem plantão. Só fala de quem chama.
CREATE OR REPLACE FUNCTION public.por_que_nao_evoluo(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_motivo text;
  v_meus text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT coalesce(array_agg(DISTINCT s.nome ORDER BY s.nome), '{}') INTO v_meus
    FROM public.setores s WHERE s.id IN (SELECT private.setores_na_escala_agora());

  v_motivo := CASE
    WHEN i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN 'encerrada'
    WHEN NOT private.pode_registrar_evolucao(i.unidade_id, 'evolucao') THEN 'papel'
    WHEN private.evoluo_internacao(i) THEN NULL
    -- escalado agora nesta unidade, passada a tolerância, sem check-in
    -- (dentro da tolerância o plantão já vale e não cai aqui)
    WHEN EXISTS (SELECT 1 FROM private.plantoes_na_janela() e
                  WHERE e.unidade_id = i.unidade_id AND private.checkin_do_plantao(e.id) IS NULL
                    AND e.id NOT IN (SELECT p.id FROM private.plantoes_agora() p)) THEN 'checkin_pendente'
    WHEN cardinality(v_meus) > 0 THEN 'outro_setor'
    ELSE 'sem_plantao' END;

  RETURN jsonb_build_object(
    'pode', v_motivo IS NULL,
    'motivo', v_motivo,
    'setor_paciente', (SELECT nome FROM public.setores WHERE id = i.setor_atual_id),
    'meus_setores_agora', to_jsonb(v_meus));
END $$;
REVOKE ALL ON FUNCTION public.por_que_nao_evoluo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.por_que_nao_evoluo(uuid) TO authenticated;

-- ── contexto_evolucao: pode_registrar pela regra da evolução médica ─────────
CREATE OR REPLACE FUNCTION public.contexto_evolucao(p_internacao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_hoje date := private.data_atual();
  v_perfil uuid := private.meu_perfil_id();
  v_sv jsonb;
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  -- últimos sinais vitais das 24 h (lançados pela enfermagem ou por quem for),
  -- um valor por parâmetro, com a hora e quem aferiu o mais recente
  WITH ult AS (
    SELECT DISTINCT ON (c.nome) c.nome, o.valor_num, o.valor_texto, op.valor AS opcao, o.aferido_em, o.registrado_por
      FROM public.observacao o
      JOIN public.conceito c ON c.id = o.conceito_id
      LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
     WHERE o.paciente_id = i.paciente_id AND o.aferido_em > now() - interval '24 hours'
       AND c.nome IN ('pressao-arterial-sistolica', 'pressao-arterial-diastolica', 'frequencia-cardiaca', 'frequencia-respiratoria',
                      'temperatura', 'saturacao-o2', 'glicemia-capilar', 'oxigenio-suplementar')
     ORDER BY c.nome, o.aferido_em DESC
  ), num AS (
    SELECT nome, replace(trim_scale(valor_num)::text, '.', ',') AS t FROM ult
  ), mais_recente AS (
    SELECT u.aferido_em, pf.nome_completo FROM ult u LEFT JOIN public.perfis pf ON pf.id = u.registrado_por
     ORDER BY u.aferido_em DESC LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ult) THEN NULL ELSE jsonb_build_object(
    'pa', CASE WHEN EXISTS (SELECT 1 FROM num WHERE nome = 'pressao-arterial-sistolica')
               THEN (SELECT t FROM num WHERE nome = 'pressao-arterial-sistolica')
                    || coalesce('x' || (SELECT t FROM num WHERE nome = 'pressao-arterial-diastolica'), '') END,
    'fc', (SELECT t FROM num WHERE nome = 'frequencia-cardiaca'),
    'fr', (SELECT t FROM num WHERE nome = 'frequencia-respiratoria'),
    'temp', (SELECT t FROM num WHERE nome = 'temperatura'),
    'spo2', (SELECT t FROM num WHERE nome = 'saturacao-o2'),
    'glic', (SELECT t FROM num WHERE nome = 'glicemia-capilar'),
    'condicao', (SELECT CASE WHEN opcao = 'ar' THEN 'ar' WHEN opcao IS NOT NULL THEN 'o2' END FROM ult WHERE nome = 'oxigenio-suplementar'),
    'aferido_em', (SELECT aferido_em FROM mais_recente),
    'por', (SELECT nome_completo FROM mais_recente)) END
  INTO v_sv;

  SELECT jsonb_build_object(
    'internacao_id', i.id,
    'paciente_id', i.paciente_id,
    'ativa', i.status IN ('admitido', 'em_observacao', 'internado'),
    'data_admissao', i.data_admissao,
    'dih', greatest(1, v_hoje - (coalesce(i.internado_em, i.data_admissao) AT TIME ZONE 'America/Sao_Paulo')::date + 1),
    'hoje', v_hoje,
    'cid_principal', i.cid_principal,
    'pode_registrar', i.status IN ('admitido', 'em_observacao', 'internado') AND private.evoluo_internacao(i)
                      AND private.pode_registrar_evolucao(i.unidade_id, 'evolucao'),
    -- antimicrobianos em curso na prescrição da internação; o início é o do
    -- primeiro item do mesmo medicamento nesta internação (troca de dose não
    -- zera o dia de uso)
    'antimicrobianos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')
                              || coalesce(' ' || nullif(btrim(it.via), ''), '') || coalesce(' ' || nullif(btrim(it.posologia), ''), '')),
               'inicio', (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date,
               'dia', v_hoje - (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1)
             ORDER BY ini.inicio)
        FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
        CROSS JOIN LATERAL (
          SELECT min(i2.created_at) AS inicio FROM public.prescricoes p2 JOIN public.prescricao_itens i2 ON i2.prescricao_id = p2.id
           WHERE p2.internacao_id = i.id AND p2.status <> 'rascunho'
             AND coalesce(i2.medicamento_id::text, private.norm(i2.descricao)) = coalesce(it.medicamento_id::text, private.norm(it.descricao))) ini
       WHERE pr.internacao_id = i.id AND pr.status = 'ativa' AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- dispositivos: registrados pela enfermagem (onda 7). Enquanto não houver
    -- a tabela, a lista vem vazia e a tela diz "Nenhum registrado."
    'dispositivos', '[]'::jsonb,
    'sv_enfermagem', v_sv,
    -- a evolução médica do dia do usuário (se já houver, a próxima é complemento)
    'minha_do_dia', (
      SELECT jsonb_build_object('documento_id', dv.id, 'raiz_id', e.documento_raiz_id, 'criado_em', r.created_at, 'versao', dv.versao,
                                'estruturada', private.eh_estruturada(ev.dados), 'dados', ev.dados)
        FROM public.evolucoes_estruturadas e
        JOIN public.documentos_clinicos r ON r.id = e.documento_raiz_id
        JOIN public.documentos_clinicos dv ON dv.documento_raiz_id = e.documento_raiz_id AND dv.estado = 'ativo'
        LEFT JOIN public.evolucoes_estruturadas ev ON ev.documento_id = dv.id
       WHERE e.internacao_id = i.id AND e.tipo_documento = 'evolucao' AND e.autor_id = v_perfil
         AND e.dia = v_hoje AND e.papel = 'do_dia' AND e.versao = 1
       LIMIT 1),
    -- a última evolução estruturada vigente (qualquer autor): o formulário
    -- herda lista de problemas, antimicrobianos incluídos à mão e o CID
    'ultima_estruturada', (
      SELECT jsonb_build_object('documento_id', ev.documento_id, 'criado_em', dv.created_at, 'dados', ev.dados)
        FROM public.evolucoes_estruturadas ev
        JOIN public.documentos_clinicos dv ON dv.id = ev.documento_id AND dv.estado = 'ativo'
       WHERE ev.internacao_id = i.id AND ev.tipo_documento = 'evolucao' AND private.eh_estruturada(ev.dados)
       ORDER BY dv.created_at DESC LIMIT 1)
  ) INTO v;
  RETURN v;
END $function$;

-- ── registrar_evolucao: a evolução médica pela mesma regra ──────────────────
CREATE OR REPLACE FUNCTION public.registrar_evolucao(p_internacao uuid, p_tipo text, p_conteudo text, p_estruturado jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_id uuid;
  v_dia date := private.data_atual();
  v_papel text;
  v_principal public.documentos_clinicos;
  v_conteudo text;
  v_dados jsonb := coalesce(p_estruturado, '{}'::jsonb);
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  -- ponto 9 (regra B do RT): a evolução médica vale também para o plantão no
  -- setor do cadastro do paciente; os demais tipos seguem o setor da internação
  IF NOT (private.cuido_da_internacao(i) OR (p_tipo = 'evolucao' AND private.evoluo_internacao(i))) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.';
  END IF;
  IF p_tipo NOT IN ('admissao_anamnese', 'evolucao', 'evolucao_enfermagem', 'anotacao_enfermagem',
                    'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros') THEN
    RAISE EXCEPTION 'Tipo desconhecido.';
  END IF;
  IF NOT private.pode_registrar_evolucao(i.unidade_id, p_tipo) THEN
    RAISE EXCEPTION '%', CASE WHEN p_tipo IN ('evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros')
      THEN 'Esta categoria profissional ainda não tem papel no sistema: o registro abre quando o papel for criado.'
      ELSE 'Acesso negado: este tipo de registro não é do seu papel na unidade.' END;
  END IF;
  PERFORM private.validar_estruturado(p_estruturado, p_tipo);

  v_conteudo := CASE WHEN private.eh_estruturada(p_estruturado) THEN private.evolucao_texto(p_estruturado, v_dia) ELSE p_conteudo END;
  IF length(btrim(coalesce(v_conteudo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o registro.'; END IF;
  IF p_tipo = 'admissao_anamnese' AND EXISTS (
       SELECT 1 FROM public.documentos_clinicos WHERE internacao_id = i.id AND tipo_documento = 'admissao_anamnese') THEN
    RAISE EXCEPTION 'A admissão desta internação já foi registrada. Para mudar, corrija a admissão.';
  END IF;

  -- uma por dia por profissional: a segunda do dia vira complemento da primeira
  IF p_tipo NOT IN ('admissao_anamnese', 'anotacao_enfermagem') THEN
    SELECT d.* INTO v_principal
      FROM public.evolucoes_estruturadas e
      JOIN public.documentos_clinicos d ON d.id = e.documento_raiz_id
     WHERE e.internacao_id = i.id AND e.tipo_documento = p_tipo AND e.autor_id = v_perfil
       AND e.dia = v_dia AND e.papel = 'do_dia' AND e.versao = 1
     LIMIT 1;
    IF v_principal.id IS NOT NULL THEN
      v_papel := 'complemento';
      v_conteudo := 'COMPLEMENTO à evolução de ' || to_char(v_principal.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
                    || E'\n\n' || v_conteudo;
    ELSE
      v_papel := 'do_dia';
    END IF;
  ELSIF p_tipo = 'anotacao_enfermagem' THEN
    v_papel := 'anotacao';
  END IF;

  v_id := gen_random_uuid();
  INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    episodio_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado)
  VALUES (v_id, v_id, 1, i.organizacao_id, i.unidade_id, i.paciente_id, i.id, i.episodio_id, p_tipo, v_conteudo,
          encode(sha256(convert_to(v_conteudo, 'UTF8')), 'hex'), v_perfil, 'ativo');
  IF v_papel IS NOT NULL THEN
    INSERT INTO public.evolucoes_estruturadas (documento_id, documento_raiz_id, versao, tipo_documento, unidade_id, paciente_id,
      internacao_id, autor_id, dia, papel, complemento_de, dados)
    VALUES (v_id, v_id, 1, p_tipo, i.unidade_id, i.paciente_id, i.id, v_perfil, v_dia, v_papel,
            CASE WHEN v_papel = 'complemento' THEN v_principal.documento_raiz_id END, v_dados);
  END IF;
  RETURN v_id;
END $$;
