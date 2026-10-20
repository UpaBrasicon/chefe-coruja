-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 2 (imagem/RIS/PACS), etapa 2.2: porta FHIR da imagem
-- (decisões do RT de 20/10/2026, "1a 2a 3a 4a 5a 6a").
--
-- A porta é a mesma do laboratório (5C-1), com o recurso novo "imagem" na chave
-- da unidade (decisão de 19/10/2026).
-- 1a. O RIS manda o ImagingStudy (exame feito, com o link do visualizador do
--     PACS) e o DiagnosticReport (laudo em texto e PDF), no padrão FHIR R4.
-- 2a. Com RIS, ele marca o "realizado"; a marcação à mão pela enfermagem
--     continua provisória onde não há RIS.
-- 3a. O ECG (02.11) entra pela porta quando o aparelho ou o RIS mandar; a
--     leitura do próprio médico na tela continua.
-- 4a. O link do visualizador só vale em https e de um domínio cadastrado pela
--     unidade. Vale para a porta e para o link digitado na tela.
-- 5a. Como no laboratório: exame não pedido é recusado, reenvio igual não
--     duplica, laudo corrigido vira versão nova.
--
-- A função nova public.api_v1_fhir atende os dois recursos. A antiga
-- public.api_v1_laboratorio fica até a Edge Function `api` nova estar no ar
-- (expandir antes de contrair); sai numa migration depois do deploy.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.api_chaves DROP CONSTRAINT api_chaves_recursos_check;
ALTER TABLE public.api_chaves ADD CONSTRAINT api_chaves_recursos_check CHECK (cardinality(recursos) >= 1
  AND recursos <@ ARRAY['pacientes', 'atendimentos', 'leitos', 'producao', 'laboratorio', 'imagem']::text[]);

-- o resultado pode vir do serviço de imagem
ALTER TABLE public.exame_resultados DROP CONSTRAINT exame_resultados_origem_check;
ALTER TABLE public.exame_resultados ADD CONSTRAINT exame_resultados_origem_check CHECK (origem IN ('manual', 'laboratorio', 'imagem'));
ALTER TABLE public.exame_resultados DROP CONSTRAINT exame_resultados_conteudo;
ALTER TABLE public.exame_resultados ADD CONSTRAINT exame_resultados_conteudo
  CHECK (texto IS NOT NULL OR pdf_caminho IS NOT NULL OR origem IN ('laboratorio', 'imagem'));
ALTER TABLE public.exames_pedidos DROP CONSTRAINT exames_pedidos_resultado_origem_check;
ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_resultado_origem_check
  CHECK (resultado_origem IN ('manual', 'laboratorio', 'imagem'));

-- 4a. domínios do visualizador de imagem que a unidade aceita
CREATE TABLE IF NOT EXISTS public.imagem_dominios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  dominio     text NOT NULL CHECK (dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  criado_por  uuid REFERENCES public.perfis(id),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, dominio)
);
ALTER TABLE public.imagem_dominios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.imagem_dominios FROM anon, authenticated;
COMMENT ON TABLE public.imagem_dominios IS
  'Domínios do visualizador de imagem (PACS) aceitos pela unidade (Fase 5C-2, decisão 4a). Acesso só pelas funções dominios_imagem, definir_dominio_imagem e retirar_dominio_imagem.';

-- o link vale? https, sem usuário/senha embutidos, e o servidor é um domínio
-- cadastrado pela unidade ou um subdomínio dele
CREATE OR REPLACE FUNCTION private.link_imagem_permitido(p_unidade uuid, p_url text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_aut text; v_host text;
BEGIN
  IF p_url IS NULL OR length(p_url) > 2000 OR p_url !~ '^https://' OR p_url ~ '[\s\\]' THEN RETURN false; END IF;
  v_aut := substring(p_url FROM '^https://([^/?#]*)');
  IF v_aut IS NULL OR v_aut = '' OR position('@' IN v_aut) > 0 THEN RETURN false; END IF;
  v_host := lower(split_part(v_aut, ':', 1));
  RETURN EXISTS (SELECT 1 FROM public.imagem_dominios d
                  WHERE d.unidade_id = p_unidade AND (v_host = d.dominio OR v_host LIKE '%.' || d.dominio));
END $$;
REVOKE ALL ON FUNCTION private.link_imagem_permitido(uuid, text) FROM PUBLIC, anon, authenticated;

-- lista, cadastro e retirada (lista: quem tem vínculo; mudança: gestor da unidade)
CREATE OR REPLACE FUNCTION public.dominios_imagem(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = p_unidade AND v.perfil_id = private.meu_perfil_id())) THEN
    RAISE EXCEPTION 'Acesso negado: unidade fora dos seus vínculos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('dominio', d.dominio, 'criado_em', d.criado_em,
                     'criado_por', (SELECT nome_completo FROM public.perfis WHERE id = d.criado_por)) ORDER BY d.dominio)
                     FROM public.imagem_dominios d WHERE d.unidade_id = p_unidade), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.dominios_imagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dominios_imagem(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_dominio_imagem(p_unidade uuid, p_dominio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := lower(btrim(coalesce(p_dominio, '')));
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os domínios do visualizador são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- aceita o endereço colado inteiro: tira o https://, o caminho e a porta
  v := regexp_replace(v, '^https?://', '');
  v := split_part(split_part(split_part(split_part(v, '/', 1), '?', 1), '#', 1), ':', 1);
  IF v !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' THEN
    RAISE EXCEPTION 'Domínio inválido: use só o nome do servidor, como pacs.hospital.com.br.';
  END IF;
  INSERT INTO public.imagem_dominios (unidade_id, dominio, criado_por) VALUES (p_unidade, v, private.meu_perfil_id())
  ON CONFLICT (unidade_id, dominio) DO NOTHING;
  IF FOUND THEN
    PERFORM private.registrar_auditoria('imagem_dominio_incluido', 'imagem_dominios', NULL, p_unidade, jsonb_build_object('dominio', v));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.definir_dominio_imagem(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_dominio_imagem(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_dominio_imagem(p_unidade uuid, p_dominio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os domínios do visualizador são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.imagem_dominios WHERE unidade_id = p_unidade AND dominio = lower(btrim(coalesce(p_dominio, '')));
  IF FOUND THEN
    PERFORM private.registrar_auditoria('imagem_dominio_retirado', 'imagem_dominios', NULL, p_unidade,
      jsonb_build_object('dominio', lower(btrim(p_dominio))));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.retirar_dominio_imagem(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_dominio_imagem(uuid, text) TO authenticated;

-- troca de trechos em funções, com guarda (o trecho tem de existir)
CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- 4a. o link digitado na tela segue a mesma regra
SELECT pg_temp.trocar('public.marcar_exame_realizado(uuid, text)'::regprocedure,
  'IF v_url IS NOT NULL AND v_url !~ ''^https://'' THEN RAISE EXCEPTION ''O link da imagem precisa começar com https://.''; END IF;',
  'IF v_url IS NOT NULL AND NOT private.link_imagem_permitido(e.unidade_id, v_url) THEN'
  || ' RAISE EXCEPTION ''O link da imagem precisa ser https:// e de um visualizador cadastrado pela unidade (Exames da unidade).''; END IF;');
SELECT pg_temp.trocar('public.definir_link_imagem(uuid, text)'::regprocedure,
  'IF v_url IS NULL OR v_url !~ ''^https://'' OR length(v_url) > 2000 THEN RAISE EXCEPTION ''O link da imagem precisa começar com https://.''; END IF;',
  'IF v_url IS NULL OR NOT private.link_imagem_permitido(e.unidade_id, v_url) THEN'
  || ' RAISE EXCEPTION ''O link da imagem precisa ser https:// e de um visualizador cadastrado pela unidade (Exames da unidade).''; END IF;');

-- o aviso de crítico não diz mais "laboratório": quem marca é quem laudou
SELECT pg_temp.trocar('private.avisar_resultado_exame(public.exames_pedidos, boolean, boolean)'::regprocedure,
  '''Resultado CRÍTICO (marcado pelo laboratório): ''', '''Resultado CRÍTICO (marcado por quem laudou): ''');

-- a mensagem de erro da criação da chave passa a citar o recurso novo
SELECT pg_temp.trocar('public.api_criar_chave(text, text, uuid[], text[], text[], integer, integer)'::regprocedure,
  'os recursos (pacientes, atendimentos, leitos, producao, laboratorio)',
  'os recursos (pacientes, atendimentos, leitos, producao, laboratorio, imagem)');

-- o pedido diz se é de laboratório ou de imagem (ServiceRequest.category, SNOMED CT)
SELECT pg_temp.trocar('private.fhir_service_request(public.exames_pedidos)'::regprocedure,
  '''intent'', ''order'',',
  '''intent'', ''order'','
  || ' ''category'', jsonb_build_array(jsonb_build_object(''coding'', jsonb_build_array(CASE WHEN e.tipo = ''imagem'''
  || ' THEN jsonb_build_object(''system'', ''http://snomed.info/sct'', ''code'', ''363679005'', ''display'', ''Imaging'')'
  || ' ELSE jsonb_build_object(''system'', ''http://snomed.info/sct'', ''code'', ''108252007'', ''display'', ''Laboratory procedure'') END))),');

-- porta FHIR do laboratório e da imagem (só service_role: a Edge Function `api`
-- chama com a chave do LIS ou do RIS). O recurso da chave decide o que entra:
-- "laboratorio" para os exames do grupo 02.02, "imagem" para os demais.
-- p_acao: pedidos | coleta | estudo | laudo
--   pedidos: p_dados {unidade_id?, desde?, limite?, cursor?}
--   coleta:  p_dados {exame_id, coletado_em}                    (laboratório)
--   estudo:  p_dados {exame_id, status, iniciado_em, link, identificador}  (imagem)
--   laudo:   p_dados {exame_id, status, identificador, nota, itens, pdf_caminho, pdf_nome, conteudo_hash}
CREATE OR REPLACE FUNCTION public.api_v1_fhir(p_chave text, p_ip text, p_requisicao text, p_acao text, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.api_chaves; d jsonb := coalesce(p_dados, '{}'::jsonb); v_ip inet; v_usados int; v_limite jsonb;
  v_status int := 200; v_corpo jsonb; v_unidade uuid; e public.exames_pedidos; v_ant public.exame_resultados;
  v_lim int := least(greatest(coalesce(nullif(d ->> 'limite', '')::int, 50), 1), 100); v_desloc int; v_desde timestamptz;
  v_quando timestamptz; v_st text; v_nota text; v_res uuid; v_rec text := 'fhir'; v_link text; v_quem text;
  v_lab boolean; v_img boolean;
BEGIN
  BEGIN v_ip := nullif(p_ip, '')::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  SELECT * INTO c FROM public.api_chaves WHERE hash = private.api_hash(p_chave);
  IF NOT FOUND OR c.revogada_em IS NOT NULL OR c.expira_em <= now() THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'fhir_' || p_acao, 401, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 401, 'codigo', 'chave_invalida',
      'detalhe', CASE WHEN c.id IS NULL THEN 'A chave não existe.' WHEN c.revogada_em IS NOT NULL THEN 'A chave foi revogada.' ELSE 'A chave venceu.' END);
  END IF;
  SELECT count(*) INTO v_usados FROM public.api_acessos WHERE chave_id = c.id AND em > clock_timestamp() - interval '60 seconds';
  v_limite := jsonb_build_object('limite', c.limite_por_minuto, 'restante', greatest(c.limite_por_minuto - v_usados - 1, 0), 'reinicio', 60);
  IF v_usados >= c.limite_por_minuto THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'fhir_' || p_acao, 429, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 429, 'codigo', 'limite_excedido', 'detalhe', 'Limite de chamadas por minuto excedido.',
                              'limite', v_limite || jsonb_build_object('restante', 0));
  END IF;
  IF cardinality(c.ips) > 0 AND (v_ip IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(c.ips) i WHERE v_ip <<= i)) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'fhir_' || p_acao, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'IP de origem não liberado nesta chave.', 'limite', v_limite);
  END IF;
  v_lab := 'laboratorio' = ANY (c.recursos);
  v_img := 'imagem' = ANY (c.recursos);
  IF NOT (v_lab OR v_img) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, 'fhir_' || p_acao, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera o recurso laboratorio nem o imagem.', 'limite', v_limite);
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
        -- pendentes de cada tipo: laboratório até o laudo; imagem pedida ou já feita
        WITH f AS (
          SELECT x.* FROM public.exames_pedidos x
           WHERE x.unidade_id = ANY (CASE WHEN v_unidade IS NULL THEN c.unidades ELSE ARRAY[v_unidade] END)
             AND ((v_lab AND x.tipo = 'laboratorio' AND x.situacao IN ('pedido', 'coletado', 'em_analise'))
               OR (v_img AND x.tipo = 'imagem' AND x.situacao IN ('pedido', 'realizado')))
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
      v_rec := coalesce(e.tipo, 'fhir');
      v_quem := CASE WHEN e.tipo = 'imagem' THEN 'serviço de imagem' ELSE 'laboratório' END;
      -- 5a: exame que não está pedido (ou é de outra unidade, ou é texto livre) não entra
      IF e.id IS NULL OR NOT e.unidade_id = ANY (c.unidades) OR e.tipo IS NULL THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Pedido de exame não encontrado.');
      ELSIF NOT e.tipo = ANY (c.recursos) THEN
        v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera o recurso ' || e.tipo || '.');

      ELSIF p_acao = 'coleta' THEN
        v_quando := coalesce(nullif(d ->> 'coletado_em', '')::timestamptz, now());
        IF e.tipo = 'imagem' THEN
          v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'Exame de imagem não tem coleta: mande o ImagingStudy.');
        ELSIF v_quando > now() + interval '5 minutes' THEN
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

      ELSIF p_acao = 'estudo' THEN
        -- 1a/2a: o RIS diz que o exame foi feito e manda o link do visualizador
        v_st := d ->> 'status';
        v_quando := coalesce(nullif(d ->> 'iniciado_em', '')::timestamptz, now());
        v_link := nullif(btrim(coalesce(d ->> 'link', '')), '');
        IF e.tipo <> 'imagem' THEN
          v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'ImagingStudy é só para exame de imagem ou método gráfico.');
        ELSIF v_quando > now() + interval '5 minutes' THEN
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'A hora do exame (started) está no futuro.');
        ELSIF v_link IS NOT NULL AND NOT private.link_imagem_permitido(e.unidade_id, v_link) THEN
          -- 4a
          v_status := 422; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida',
            'detalhe', 'O link do visualizador precisa ser https:// e de um domínio cadastrado pela unidade.');
        ELSIF e.situacao = 'cancelado' THEN
          v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O pedido foi cancelado.');
        ELSIF v_st = 'registered' THEN
          -- agendado no RIS: nada muda aqui
          v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao);
        ELSIF v_st = 'available' THEN
          IF e.situacao = 'pedido' THEN
            UPDATE public.exames_pedidos SET situacao = 'realizado', realizado_em = v_quando, realizado_por = NULL,
                   imagem_url = coalesce(v_link, imagem_url)
             WHERE id = e.id;
            PERFORM private.registrar_auditoria('exame_realizado_servico_imagem', 'exames_pedidos', e.id, e.unidade_id,
              jsonb_build_object('exame', e.exame, 'realizado_em', v_quando, 'com_link', v_link IS NOT NULL,
                                 'estudo', d ->> 'identificador', 'chave', c.prefixo));
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'realizado', 'realizado_em', v_quando);
          ELSE
            -- reenvio ou link novo para exame já feito (ou já laudado)
            IF v_link IS NOT NULL AND v_link IS DISTINCT FROM e.imagem_url THEN
              UPDATE public.exames_pedidos SET imagem_url = v_link WHERE id = e.id;
              PERFORM private.registrar_auditoria('exame_link_imagem', 'exames_pedidos', e.id, e.unidade_id,
                jsonb_build_object('exame', e.exame, 'chave', c.prefixo));
            END IF;
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao, 'realizado_em', e.realizado_em);
          END IF;
        ELSIF v_st = 'cancelled' THEN
          IF e.situacao IN ('pedido', 'realizado') THEN
            UPDATE public.exames_pedidos SET situacao = 'cancelado', resolvido_em = now(),
                   motivo_cancelamento = 'Cancelado pelo serviço de imagem.'
             WHERE id = e.id;
            PERFORM private.registrar_auditoria('exame_cancelado_servico_imagem', 'exames_pedidos', e.id, e.unidade_id,
              jsonb_build_object('exame', e.exame, 'chave', c.prefixo));
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'cancelado');
          ELSE
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O exame já tem laudo: para corrigir, mande o laudo como amended.');
          END IF;
        ELSE
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida',
            'detalhe', 'status do ImagingStudy: registered, available ou cancelled.');
        END IF;

      ELSIF p_acao = 'laudo' THEN
        v_st := d ->> 'status';
        v_nota := nullif(btrim(coalesce(d ->> 'nota', '')), '');
        SELECT * INTO v_ant FROM public.exame_resultados WHERE exame_id = e.id AND vigente;
        IF v_st IN ('registered', 'partial', 'preliminary') THEN
          IF e.situacao = 'cancelado' THEN
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O pedido foi cancelado.');
          ELSIF e.tipo = 'laboratorio' AND e.situacao IN ('pedido', 'coletado') THEN
            UPDATE public.exames_pedidos SET situacao = 'em_analise', em_analise_em = now() WHERE id = e.id;
            PERFORM private.registrar_auditoria('exame_em_analise', 'exames_pedidos', e.id, e.unidade_id,
              jsonb_build_object('exame', e.exame, 'chave', c.prefixo));
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', 'em_analise');
          ELSE
            -- a imagem não tem "em análise": o laudo preliminar não muda a situação
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao);
          END IF;
        ELSIF v_st = 'cancelled' THEN
          IF e.situacao IN ('pedido', 'coletado', 'em_analise', 'realizado') THEN
            UPDATE public.exames_pedidos SET situacao = 'cancelado', resolvido_em = now(),
                   motivo_cancelamento = left('Cancelado pelo ' || v_quem || coalesce(': ' || v_nota, '.'), 500)
             WHERE id = e.id;
            PERFORM private.registrar_auditoria(CASE WHEN e.tipo = 'imagem' THEN 'exame_cancelado_servico_imagem' ELSE 'exame_cancelado_laboratorio' END,
              'exames_pedidos', e.id, e.unidade_id, jsonb_build_object('exame', e.exame, 'nota', v_nota, 'chave', c.prefixo));
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
            -- 5a: o mesmo laudo reenviado
            v_corpo := jsonb_build_object('exame_id', e.id, 'situacao', e.situacao, 'versao', v_ant.versao, 'repetido', true);
          ELSIF v_ant.id IS NOT NULL AND v_st = 'final' THEN
            v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito', 'detalhe', 'O exame já tem resultado: para corrigir, mande o laudo como amended.');
          ELSE
            v_res := private.gravar_resultado_exame(e.id, e.tipo, v_nota, nullif(d ->> 'pdf_caminho', ''), nullif(d ->> 'pdf_nome', ''),
                       CASE WHEN jsonb_typeof(d -> 'itens') = 'array' THEN d -> 'itens' ELSE '[]'::jsonb END, false, nullif(d ->> 'identificador', ''),
                       CASE WHEN v_ant.id IS NOT NULL THEN 'Retificado pelo ' || v_quem || coalesce(': ' || v_nota, '.') END, NULL);
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
  VALUES (c.id, v_rec || '_' || p_acao, v_unidade, v_status, v_ip, p_requisicao);
  IF v_status = 200 THEN
    RETURN jsonb_build_object('status', 200, 'corpo', v_corpo, 'limite', v_limite);
  END IF;
  RETURN jsonb_build_object('status', v_status, 'codigo', v_corpo ->> 'codigo', 'detalhe', v_corpo ->> 'detalhe', 'limite', v_limite);
END $$;
REVOKE ALL ON FUNCTION public.api_v1_fhir(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_v1_fhir(text, text, text, text, jsonb) TO service_role;

-- antes de guardar o PDF do laudo: a chave vale para este pedido? (sem registro
-- de chamada; a gravação logo depois confere tudo de novo e registra)
CREATE OR REPLACE FUNCTION public.api_fhir_pode_anexar(p_chave text, p_exame uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.api_chaves c JOIN public.exames_pedidos e ON e.id = p_exame
     WHERE c.hash = private.api_hash(p_chave) AND c.revogada_em IS NULL AND c.expira_em > now()
       AND e.tipo IS NOT NULL AND e.tipo = ANY (c.recursos) AND e.unidade_id = ANY (c.unidades)
       AND e.situacao <> 'cancelado')
$$;
REVOKE ALL ON FUNCTION public.api_fhir_pode_anexar(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_fhir_pode_anexar(text, uuid) TO service_role;
