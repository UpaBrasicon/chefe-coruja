-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 1 (laboratório/LIS), etapa 1.3: porta FHIR R4 para o LIS
-- (decisões do RT de 19/10/2026, "1a 2a 3a 4a 5a 6a 7a").
--
-- 1a. O LIS usa a chave de API da unidade (Fase 3) com o recurso novo
--     "laboratorio": só lê pedidos de exame e só grava coleta, situação e
--     resultado. IPs liberados opcionais, limite por minuto e registro de cada
--     chamada, como a API de leitura.
-- 2a. O LIS consulta os pedidos pendentes (ServiceRequest) e devolve a coleta
--     (Specimen) e o laudo (DiagnosticReport com os analitos e o PDF). A Edge
--     Function `api` traduz o FHIR; aqui ficam as regras.
-- 3a. Do paciente vão nome, data de nascimento, sexo, CNS ou CPF quando houver
--     e o prontuário.
-- 4a. A coleta vem do laboratório quando há LIS; a marcação à mão pela
--     enfermagem continua provisória (o papel "laboratório" fica para depois).
-- 5a. Resultado de exame que não está pedido no sistema é recusado e fica só no
--     registro da chamada.
-- 6a. O mesmo laudo reenviado (mesmo identificador e conteúdo) não gera versão.
--     Laudo corrigido (amended/corrected) vira versão nova, com o motivo
--     "Retificado pelo laboratório" e a nota dele.
-- Só vão ao laboratório os exames com código (pedido pelo catálogo); o texto
-- livre não sai do sistema.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.api_chaves DROP CONSTRAINT api_chaves_recursos_check;
ALTER TABLE public.api_chaves ADD CONSTRAINT api_chaves_recursos_check CHECK (cardinality(recursos) >= 1
  AND recursos <@ ARRAY['pacientes', 'atendimentos', 'leitos', 'producao', 'laboratorio']::text[]);

-- 6a. conteúdo do laudo do laboratório, para reconhecer o reenvio
ALTER TABLE public.exame_resultados ADD COLUMN IF NOT EXISTS conteudo_hash text;

-- 2a/3a. o pedido como ServiceRequest FHIR R4, com o paciente contido
CREATE OR REPLACE FUNCTION private.fhir_service_request(e public.exames_pedidos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'resourceType', 'ServiceRequest',
    'id', e.id,
    'meta', jsonb_build_object('tag', jsonb_build_array(jsonb_build_object(
              'system', 'https://api.chefecoruja.com.br/fhir/situacao-exame', 'code', e.situacao))),
    'contained', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'resourceType', 'Patient', 'id', 'paciente',
      'identifier', (SELECT jsonb_agg(i) FROM (
          SELECT jsonb_build_object('system', 'https://saude.gov.br/fhir/sid/cns', 'value', pa.cns) AS i WHERE private.cns_valido(pa.cns)
          UNION ALL SELECT jsonb_build_object('system', 'https://saude.gov.br/fhir/sid/cpf', 'value', pa.cpf) WHERE private.cpf_valido(pa.cpf)
          UNION ALL SELECT jsonb_build_object('system', 'https://api.chefecoruja.com.br/fhir/prontuario', 'value', pa.prontuario) WHERE pa.prontuario IS NOT NULL) x),
      'name', jsonb_build_array(jsonb_build_object('text', pa.nome)),
      'gender', CASE pa.sexo WHEN 'M' THEN 'male' WHEN 'F' THEN 'female' ELSE 'unknown' END,
      'birthDate', pa.data_nascimento))),
    'status', 'active',
    'intent', 'order',
    'priority', CASE e.urgencia WHEN 'urgente' THEN 'urgent' ELSE 'routine' END,
    'code', jsonb_build_object(
      'coding', (SELECT jsonb_agg(c) FROM (
          SELECT jsonb_build_object('system', 'http://www.saude.gov.br/fhir/r4/CodeSystem/BRTabelaSUS', 'code', e.procedimento,
                                    'display', (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = e.procedimento)) AS c
          UNION ALL SELECT jsonb_build_object('system', 'http://loinc.org', 'code', e.loinc) WHERE e.loinc IS NOT NULL) x),
      'text', e.exame),
    'subject', jsonb_build_object('reference', '#paciente'),
    'authoredOn', e.pedido_em,
    'requester', jsonb_build_object('display', (SELECT nome_completo FROM public.perfis WHERE id = e.pedido_por)),
    'performer', jsonb_build_array(jsonb_build_object('display', (SELECT u.nome FROM public.unidades u WHERE u.id = e.unidade_id))),
    'note', CASE WHEN e.observacao IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', e.observacao)) END))
  FROM public.pacientes pa WHERE pa.id = e.paciente_id
$$;
REVOKE ALL ON FUNCTION private.fhir_service_request(public.exames_pedidos) FROM PUBLIC, anon, authenticated;

-- porta do laboratório (só service_role: a Edge Function `api` chama com a chave do LIS)
-- p_acao: pedidos | coleta | laudo
--   pedidos: p_dados {unidade_id?, desde?, limite?, cursor?}
--   coleta:  p_dados {exame_id, coletado_em}
--   laudo:   p_dados {exame_id, status, identificador, nota, itens, pdf_caminho, pdf_nome, conteudo_hash}
CREATE OR REPLACE FUNCTION public.api_v1_laboratorio(p_chave text, p_ip text, p_requisicao text, p_acao text, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.api_chaves; d jsonb := coalesce(p_dados, '{}'::jsonb); v_ip inet; v_usados int; v_limite jsonb;
  v_status int := 200; v_corpo jsonb; v_unidade uuid; e public.exames_pedidos; v_ant public.exame_resultados;
  v_lim int := least(greatest(coalesce(nullif(d ->> 'limite', '')::int, 50), 1), 100); v_desloc int; v_desde timestamptz;
  v_quando timestamptz; v_st text; v_nota text; v_res uuid;
BEGIN
  BEGIN v_ip := nullif(p_ip, '')::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  SELECT * INTO c FROM public.api_chaves WHERE hash = private.api_hash(p_chave);
  IF NOT FOUND OR c.revogada_em IS NOT NULL OR c.expira_em <= now() THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'laboratorio_' || p_acao, 401, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 401, 'codigo', 'chave_invalida',
      'detalhe', CASE WHEN c.id IS NULL THEN 'A chave não existe.' WHEN c.revogada_em IS NOT NULL THEN 'A chave foi revogada.' ELSE 'A chave venceu.' END);
  END IF;
  SELECT count(*) INTO v_usados FROM public.api_acessos WHERE chave_id = c.id AND em > clock_timestamp() - interval '60 seconds';
  v_limite := jsonb_build_object('limite', c.limite_por_minuto, 'restante', greatest(c.limite_por_minuto - v_usados - 1, 0), 'reinicio', 60);
  IF v_usados >= c.limite_por_minuto THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'laboratorio_' || p_acao, 429, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 429, 'codigo', 'limite_excedido', 'detalhe', 'Limite de chamadas por minuto excedido.',
                              'limite', v_limite || jsonb_build_object('restante', 0));
  END IF;
  IF cardinality(c.ips) > 0 AND (v_ip IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(c.ips) i WHERE v_ip <<= i)) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'laboratorio_' || p_acao, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'IP de origem não liberado nesta chave.', 'limite', v_limite);
  END IF;
  IF NOT 'laboratorio' = ANY (c.recursos) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'laboratorio_' || p_acao, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera o recurso laboratorio.', 'limite', v_limite);
  END IF;
  UPDATE public.api_chaves SET ultimo_uso_em = now() WHERE id = c.id;

  BEGIN
    IF p_acao = 'pedidos' THEN
      v_unidade := nullif(d ->> 'unidade_id', '')::uuid;
      v_desde := nullif(d ->> 'desde', '')::timestamptz;
      v_desloc := private.api_cursor(d ->> 'cursor');
      IF v_unidade IS NOT NULL AND NOT v_unidade = ANY (c.unidades) THEN
        v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera esta unidade.');
      ELSE
        WITH f AS (
          SELECT x.* FROM public.exames_pedidos x
           WHERE x.unidade_id = ANY (CASE WHEN v_unidade IS NULL THEN c.unidades ELSE ARRAY[v_unidade] END)
             AND x.situacao IN ('pedido', 'coletado', 'em_analise') AND x.procedimento IS NOT NULL
             AND (v_desde IS NULL OR x.pedido_em >= v_desde)
           ORDER BY x.pedido_em, x.id OFFSET v_desloc LIMIT v_lim + 1)
        SELECT jsonb_build_object('pedidos', coalesce((SELECT jsonb_agg(private.fhir_service_request(f) ORDER BY f.pedido_em, f.id)
                                                         FROM (SELECT * FROM f LIMIT v_lim) f), '[]'::jsonb),
                                  'total_pagina', least((SELECT count(*) FROM f), v_lim),
                                  'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM f)))
          INTO v_corpo;
      END IF;

    ELSE
      SELECT * INTO e FROM public.exames_pedidos WHERE id = nullif(d ->> 'exame_id', '')::uuid;
      v_unidade := e.unidade_id;
      -- 5a: exame que não está pedido (ou é de outra unidade) não entra
      IF e.id IS NULL OR NOT e.unidade_id = ANY (c.unidades) OR e.procedimento IS NULL THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Pedido de exame não encontrado.');
      ELSIF p_acao = 'coleta' THEN
        v_quando := coalesce(nullif(d ->> 'coletado_em', '')::timestamptz, now());
        IF v_quando > now() + interval '5 minutes' THEN
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'A hora da coleta está no futuro.');
        ELSIF e.situacao = 'pedido' THEN
          UPDATE public.exames_pedidos SET situacao = 'coletado', coletado_em = v_quando, coletado_por = NULL WHERE id = e.id;
          PERFORM private.registrar_auditoria('exame_coletado_laboratorio', 'exames_pedidos', e.id, e.unidade_id,
            jsonb_build_object('exame', e.exame, 'coletado_em', v_quando, 'chave', c.prefixo));
          v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'coletado', 'coletado_em', v_quando);
        ELSIF e.situacao = 'cancelado' THEN
          v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O pedido foi cancelado.');
        ELSE
          -- reenvio: já está coletado (ou adiante); nada muda
          v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao, 'coletado_em', e.coletado_em);
        END IF;

      ELSIF p_acao = 'laudo' THEN
        v_st := d ->> 'status';
        v_nota := nullif(btrim(coalesce(d ->> 'nota', '')), '');
        SELECT * INTO v_ant FROM public.exame_resultados WHERE exame_id = e.id AND vigente;
        IF v_st IN ('registered', 'partial', 'preliminary') THEN
          IF e.situacao IN ('pedido', 'coletado') THEN
            UPDATE public.exames_pedidos SET situacao = 'em_analise', em_analise_em = now() WHERE id = e.id;
            PERFORM private.registrar_auditoria('exame_em_analise', 'exames_pedidos', e.id, e.unidade_id,
              jsonb_build_object('exame', e.exame, 'chave', c.prefixo));
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'em_analise');
          ELSIF e.situacao = 'cancelado' THEN
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O pedido foi cancelado.');
          ELSE
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao);
          END IF;
        ELSIF v_st = 'cancelled' THEN
          IF e.situacao IN ('pedido', 'coletado', 'em_analise') THEN
            UPDATE public.exames_pedidos SET situacao = 'cancelado', resolvido_em = now(),
                   motivo_cancelamento = left('Cancelado pelo laboratório' || coalesce(': ' || v_nota, '.'), 500)
             WHERE id = e.id;
            PERFORM private.registrar_auditoria('exame_cancelado_laboratorio', 'exames_pedidos', e.id, e.unidade_id,
              jsonb_build_object('exame', e.exame, 'nota', v_nota, 'chave', c.prefixo));
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'cancelado');
          ELSIF e.situacao = 'cancelado' THEN
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'cancelado');
          ELSE
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O exame já tem resultado: para corrigir, mande o laudo como amended.');
          END IF;
        ELSIF v_st IN ('final', 'amended', 'corrected', 'appended') THEN
          IF e.situacao = 'cancelado' THEN
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O pedido foi cancelado.');
          ELSIF v_ant.id IS NOT NULL AND v_ant.laboratorio_ref IS NOT DISTINCT FROM (d ->> 'identificador')
                AND v_ant.conteudo_hash IS NOT DISTINCT FROM (d ->> 'conteudo_hash') THEN
            -- 6a: o mesmo laudo reenviado
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao, 'versao', v_ant.versao, 'repetido', true);
          ELSIF v_ant.id IS NOT NULL AND v_st = 'final' THEN
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O exame já tem resultado: para corrigir, mande o laudo como amended.');
          ELSE
            v_res := private.gravar_resultado_exame(e.id, 'laboratorio', v_nota, nullif(d ->> 'pdf_caminho', ''), nullif(d ->> 'pdf_nome', ''),
                       CASE WHEN jsonb_typeof(d -> 'itens') = 'array' THEN d -> 'itens' ELSE '[]'::jsonb END, false, nullif(d ->> 'identificador', ''),
                       CASE WHEN v_ant.id IS NOT NULL THEN 'Retificado pelo laboratório' || coalesce(': ' || v_nota, '.') END, NULL);
            UPDATE public.exame_resultados SET conteudo_hash = d ->> 'conteudo_hash' WHERE id = v_res;
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'resultado',
                                          'versao', (SELECT versao FROM public.exame_resultados WHERE id = v_res));
          END IF;
        ELSE
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida',
            'detalhe', 'status do DiagnosticReport: registered, partial, preliminary, final, amended, corrected, appended ou cancelled.');
        END IF;
      ELSE
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Ação inexistente.');
      END IF;
    END IF;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Parâmetro fora do formato.');
    WHEN raise_exception THEN
      v_status := 422; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', SQLERRM);
  END;

  INSERT INTO public.api_acessos (chave_id, recurso, unidade_id, status, ip, requisicao)
  VALUES (c.id, 'laboratorio_' || p_acao, v_unidade, v_status, v_ip, p_requisicao);
  IF v_status = 200 THEN
    RETURN jsonb_build_object('status', 200, 'corpo', v_corpo, 'limite', v_limite);
  END IF;
  RETURN jsonb_build_object('status', v_status, 'codigo', v_corpo ->> 'codigo', 'detalhe', v_corpo ->> 'detalhe', 'limite', v_limite);
END $$;
REVOKE ALL ON FUNCTION public.api_v1_laboratorio(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_v1_laboratorio(text, text, text, text, jsonb) TO service_role;

-- antes de guardar o PDF do laudo: a chave vale para este pedido? (sem registro
-- de chamada; a gravação logo depois confere tudo de novo e registra)
CREATE OR REPLACE FUNCTION public.api_laboratorio_pode_anexar(p_chave text, p_exame uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.api_chaves c JOIN public.exames_pedidos e ON e.id = p_exame
     WHERE c.hash = private.api_hash(p_chave) AND c.revogada_em IS NULL AND c.expira_em > now()
       AND 'laboratorio' = ANY (c.recursos) AND e.unidade_id = ANY (c.unidades)
       AND e.procedimento IS NOT NULL AND e.situacao <> 'cancelado')
$$;
REVOKE ALL ON FUNCTION public.api_laboratorio_pode_anexar(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_laboratorio_pode_anexar(text, uuid) TO service_role;

-- a mensagem de erro da criação da chave passa a citar o recurso novo
DO $$
DECLARE def text; antigo text := 'os recursos (pacientes, atendimentos, leitos, producao)';
BEGIN
  def := replace(pg_get_functiondef('public.api_criar_chave(text, text, uuid[], text[], text[], integer, integer)'::regprocedure), E'\r', '');
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'api_criar_chave mudou: mensagem não encontrada'; END IF;
  EXECUTE replace(def, antigo, 'os recursos (pacientes, atendimentos, leitos, producao, laboratorio)');
END $$;
