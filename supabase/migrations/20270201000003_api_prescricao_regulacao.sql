-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 4 (Webhooks), etapa 4.2: leitura de prescrição e regulação
-- na API v1 (decisão do RT em 27/10/2026: "inclua na 4.2 as rotas de leitura
-- de prescrição e regulação"). O webhook manda só o id; o receptor busca aqui.
--
--   GET /prescricoes/{id}   recurso novo "prescricoes"
--   GET /regulacao/{id}     recurso novo "regulacao"
--
-- Do paciente vai o mesmo resumo das outras rotas (private.api_paciente_resumo).
-- Nenhum texto livre clínico (quadro clínico, sinais vitais, hipótese,
-- observações): só os campos estruturados.
-- A chave precisa liberar a unidade: a da prescrição; na regulação, a de
-- origem ou a de destino.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.api_v1_leitura(text, text, text, text, jsonb),
--     private.api_prescricao(public.prescricoes), private.api_regulacao(public.regulacao_solicitacoes);
--   ALTER TABLE public.api_chaves DROP CONSTRAINT api_chaves_recursos_check;
--   ALTER TABLE public.api_chaves ADD CONSTRAINT api_chaves_recursos_check CHECK (cardinality(recursos) >= 1
--     AND recursos <@ ARRAY['pacientes', 'atendimentos', 'leitos', 'producao', 'laboratorio', 'imagem', 'financeiro']::text[]) NOT VALID;
--   (NOT VALID: chave já criada com os recursos novos fica como está; revogue-a)
--   (a mensagem de api_criar_chave volta trocando o trecho novo pelo antigo, como no bloco DO abaixo)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.api_chaves DROP CONSTRAINT IF EXISTS api_chaves_recursos_check;
ALTER TABLE public.api_chaves ADD CONSTRAINT api_chaves_recursos_check CHECK (cardinality(recursos) >= 1
  AND recursos <@ ARRAY['pacientes', 'atendimentos', 'leitos', 'producao', 'laboratorio', 'imagem', 'financeiro',
                        'prescricoes', 'regulacao']::text[]);

DO $$
DECLARE def text;
  antigo text := 'os recursos (pacientes, atendimentos, leitos, producao, laboratorio, imagem, financeiro)';
  novo text := 'os recursos (pacientes, atendimentos, leitos, producao, laboratorio, imagem, financeiro, prescricoes, regulacao)';
BEGIN
  def := replace(pg_get_functiondef('public.api_criar_chave(text, text, uuid[], text[], text[], integer, integer)'::regprocedure), E'\r', '');
  IF position(novo IN def) > 0 THEN RETURN; END IF;  -- já aplicada
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'api_criar_chave mudou: trecho "%" não encontrado', antigo; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- Itens vigentes: a versão que foi alterada sai (fica a nova); o suspenso aparece com a data.
CREATE OR REPLACE FUNCTION private.api_prescricao(p public.prescricoes)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'unidade_id', p.unidade_id, 'paciente', private.api_paciente_resumo(p.paciente_id),
    'atendimento_id', p.episodio_id, 'internacao_id', p.internacao_id,
    'status', p.status, 'assinada_em', p.assinada_em, 'valida_ate', p.valida_ate, 'encerrada_em', p.encerrada_em,
    'medico', (SELECT jsonb_build_object('nome', m.nome_completo, 'crm', m.crm, 'uf_crm', m.uf_crm)
                 FROM public.perfis m WHERE m.id = p.medico_id),
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'tipo', i.tipo, 'descricao', i.descricao, 'dose', i.dose, 'via', i.via,
        'posologia', i.posologia, 'horarios', to_jsonb(i.horarios), 'duracao', i.duracao,
        'se_necessario', i.se_necessario, 'diluicao', i.diluicao_texto, 'versao', i.versao,
        'suspenso_em', i.suspenso_em) ORDER BY i.ordem, i.created_at)
      FROM public.prescricao_itens i
     WHERE i.prescricao_id = p.id
       AND NOT EXISTS (SELECT 1 FROM public.prescricao_itens n WHERE n.substitui_item_id = i.id)), '[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION private.api_regulacao(r public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'numero', r.numero, 'unidade_origem_id', r.unidade_origem_id, 'cnes_solicitante', r.cnes_solicitante,
    'paciente', CASE WHEN r.paciente_id IS NOT NULL AND NOT r.paciente_nao_identificado THEN private.api_paciente_resumo(r.paciente_id) END,
    'paciente_nao_identificado', r.paciente_nao_identificado,
    'atendimento_id', r.episodio_id, 'internacao_id', r.internacao_id,
    'tipo', r.tipo, 'procedimento', r.procedimento, 'especialidade', r.especialidade, 'cbo', r.cbo,
    'tipo_leito', r.tipo_leito, 'isolamento', CASE WHEN r.isolamento THEN r.isolamento_tipo END,
    'carater', r.carater, 'prioridade', coalesce(r.prioridade_regulador, r.prioridade_central, r.prioridade),
    'cid', r.cid, 'transporte', coalesce(r.transporte_central, r.transporte),
    'destino', jsonb_build_object('tipo', r.destino_tipo, 'unidade_id', r.destino_unidade_id, 'externo', r.destino_externo,
                                  'resposta', r.destino_resposta),
    'status', r.status, 'motivo_negacao', r.motivo_negacao, 'cancelamento_origem', r.cancelamento_origem,
    'externo', CASE WHEN r.externo_protocolo IS NOT NULL THEN jsonb_build_object('sistema', r.externo_sistema, 'protocolo', r.externo_protocolo) END,
    'criada_em', r.criada_em, 'autorizada_em', r.autorizada_em, 'data_prevista', r.data_prevista,
    'saida_em', r.saida_em, 'realizada_em', r.realizada_em, 'negada_em', r.negada_em, 'cancelada_em', r.cancelada_em)
$$;
REVOKE ALL ON FUNCTION private.api_prescricao(public.prescricoes), private.api_regulacao(public.regulacao_solicitacoes)
  FROM PUBLIC, anon, authenticated;

-- Porta das leituras por id (só service_role: a Edge Function `api` chama com a chave).
-- p_recurso: prescricao | regulacao; p_params {id}
CREATE OR REPLACE FUNCTION public.api_v1_leitura(p_chave text, p_ip text, p_requisicao text, p_recurso text, p_params jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.api_chaves; q jsonb := coalesce(p_params, '{}'::jsonb); v_ip inet; v_usados int; v_limite jsonb;
  v_status int := 200; v_corpo jsonb; v_unidade uuid; v_id uuid; v_rec text;
  p public.prescricoes; r public.regulacao_solicitacoes;
BEGIN
  BEGIN v_ip := nullif(p_ip, '')::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  SELECT * INTO c FROM public.api_chaves WHERE hash = private.api_hash(p_chave);
  IF NOT FOUND OR c.revogada_em IS NOT NULL OR c.expira_em <= now() THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, p_recurso, 401, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 401, 'codigo', 'chave_invalida',
      'detalhe', CASE WHEN c.id IS NULL THEN 'A chave não existe.' WHEN c.revogada_em IS NOT NULL THEN 'A chave foi revogada.' ELSE 'A chave venceu.' END);
  END IF;
  SELECT count(*) INTO v_usados FROM public.api_acessos WHERE chave_id = c.id AND em > clock_timestamp() - interval '60 seconds';
  v_limite := jsonb_build_object('limite', c.limite_por_minuto, 'restante', greatest(c.limite_por_minuto - v_usados - 1, 0), 'reinicio', 60);
  IF v_usados >= c.limite_por_minuto THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, p_recurso, 429, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 429, 'codigo', 'limite_excedido', 'detalhe', 'Limite de consultas por minuto excedido.',
                              'limite', v_limite || jsonb_build_object('restante', 0));
  END IF;
  IF cardinality(c.ips) > 0 AND (v_ip IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(c.ips) i WHERE v_ip <<= i)) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, p_recurso, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'IP de origem não liberado nesta chave.', 'limite', v_limite);
  END IF;
  UPDATE public.api_chaves SET ultimo_uso_em = now() WHERE id = c.id;

  BEGIN
    v_id := (q ->> 'id')::uuid;
    v_rec := CASE p_recurso WHEN 'prescricao' THEN 'prescricoes' WHEN 'regulacao' THEN 'regulacao' END;
    IF v_rec IS NULL THEN
      v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Recurso inexistente.');
    ELSIF p_recurso = 'prescricao' THEN
      SELECT * INTO p FROM public.prescricoes WHERE id = v_id;
      v_unidade := p.unidade_id;
      IF p.id IS NULL OR NOT p.unidade_id = ANY (c.unidades) OR p.status = 'rascunho' THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Não encontrado.');
      END IF;
    ELSE
      SELECT * INTO r FROM public.regulacao_solicitacoes WHERE id = v_id;
      v_unidade := CASE WHEN r.unidade_origem_id = ANY (c.unidades) THEN r.unidade_origem_id
                        WHEN r.destino_unidade_id = ANY (c.unidades) THEN r.destino_unidade_id END;
      IF r.id IS NULL OR v_unidade IS NULL OR r.status IN ('rascunho', 'excluida') THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Não encontrado.');
      END IF;
    END IF;
    IF v_status = 200 AND NOT v_rec = ANY (c.recursos) THEN
      v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera o recurso ' || v_rec || '.');
    END IF;
    IF v_status = 200 THEN
      v_corpo := CASE p_recurso WHEN 'prescricao' THEN private.api_prescricao(p) ELSE private.api_regulacao(r) END;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Não encontrado.');
  END;

  INSERT INTO public.api_acessos (chave_id, recurso, unidade_id, status, ip, requisicao)
  VALUES (c.id, p_recurso, v_unidade, v_status, v_ip, p_requisicao);
  IF v_status = 200 THEN
    RETURN jsonb_build_object('status', 200, 'corpo', v_corpo, 'limite', v_limite);
  END IF;
  RETURN jsonb_build_object('status', v_status, 'codigo', v_corpo ->> 'codigo', 'detalhe', v_corpo ->> 'detalhe', 'limite', v_limite);
END $$;
REVOKE ALL ON FUNCTION public.api_v1_leitura(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_v1_leitura(text, text, text, text, jsonb) TO service_role;
