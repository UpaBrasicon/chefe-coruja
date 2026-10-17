-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5B, tarefa 5: pré-auditoria da conta (decisões do RT de 17/10/2026,
-- "1a 2a 3a 4a 5a 6a").
--
-- 1a. A pendência bloqueante trava a passagem de "em conferência" para
--     "fechada"; as outras só avisam.
-- 2a. Bloqueante pelas regras que já existem:
--     • porta: a crítica da linha do BPA que fica fora do arquivo (destino
--       "fora"); a linha que vai no BPA-C ou no BPA-I só avisa;
--     • internação: a crítica da AIH marcada como bloqueante (catálogo e
--       configuração da unidade, private.critica_bloqueante), a do lançamento
--       pela mesma regra, e a falta de AIH aprovada;
--     • aviso de medicamento e de APAC nunca bloqueia.
-- 3a. Só o gestor libera o fechamento com pendência bloqueante, com
--     justificativa. A liberação cobre as pendências daquele momento; se
--     aparecer outra, trava de novo. Voltar a aberta desfaz a liberação.
-- 4a. Painel de pendências no detalhe, agrupado (unidade, paciente,
--     profissional, procedimento, AIH/APAC, medicamento); na lista, o resumo
--     por conta para a marca e o filtro.
-- 5a. Checagens novas: CNES da unidade e CID da porta quando o procedimento
--     exige (o SIGTAP tem lista de CID para ele). Na internação o CID principal
--     já vem nas críticas da AIH.
-- 6a. No fechamento a lista fica guardada na conta e no histórico, com a
--     liberação, para auditoria.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS liberada_em           timestamptz,
  ADD COLUMN IF NOT EXISTS liberada_por          uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS liberacao_motivo      text,
  ADD COLUMN IF NOT EXISTS liberacao_pendencias  jsonb,
  ADD COLUMN IF NOT EXISTS pendencias_fechamento jsonb;
ALTER TABLE public.conta_eventos ADD COLUMN IF NOT EXISTS detalhes jsonb;

-- a linha da porta passa a levar o CID do atendimento (5a)
DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('private.conta_itens(public.contas)'::regprocedure), E'\r', '');
  antigo := '''criticas'', l.criticas, ''avisos'', l.avisos, ''destino'', l.destino,';
  novo := '''criticas'', l.criticas, ''avisos'', l.avisos, ''destino'', l.destino, ''cid'', l.cid,';
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'conta_itens mudou: trecho das linhas do BPA não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- grupo da pendência pelo código da crítica (o mesmo código pode ser do
-- paciente no BPA e do procedimento na AIH: "sexo" e "idade")
CREATE OR REPLACE FUNCTION private.grupo_pendencia(p_codigo text, p_origem text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_codigo IN ('cnes', 'sigtap_desatualizado') THEN 'unidade'
    WHEN p_codigo IN ('cns_profissional', 'cbo', 'cbo_enfermagem', 'cbo_nao_aceito') THEN 'profissional'
    WHEN p_codigo IN ('raca', 'etnia', 'nascimento', 'documento', 'endereco', 'nacionalidade', 'cns') THEN 'paciente'
    WHEN p_codigo IN ('sexo', 'idade') AND coalesce(p_origem, '') NOT IN ('aih', 'lancamento') THEN 'paciente'
    ELSE 'procedimento' END
$$;
REVOKE ALL ON FUNCTION private.grupo_pendencia(text, text) FROM PUBLIC, anon, authenticated;

-- pendências da conta a partir das partes já calculadas (itens, medicamentos,
-- documentos SUS); cada uma: grupo, código, texto, se bloqueia, quantas vezes
CREATE OR REPLACE FUNCTION private.conta_pendencias(c public.contas, p_itens jsonb, p_meds jsonb, p_docs jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH p AS (
    -- críticas dos procedimentos
    SELECT private.grupo_pendencia(x ->> 'codigo', it ->> 'origem') AS grupo, x ->> 'codigo' AS codigo, x ->> 'texto' AS texto,
           CASE WHEN it ->> 'origem' = 'aih' THEN coalesce((x ->> 'bloqueante')::boolean, private.critica_bloqueante(c.unidade_id, x ->> 'codigo'))
                WHEN it ->> 'origem' = 'lancamento' THEN private.critica_bloqueante(c.unidade_id, x ->> 'codigo')
                ELSE coalesce(it ->> 'destino', '') = 'fora' END AS bloqueia
      FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) it, jsonb_array_elements(coalesce(it -> 'criticas', '[]'::jsonb)) x
    UNION ALL
    SELECT private.grupo_pendencia(x ->> 'codigo', it ->> 'origem'), x ->> 'codigo', x ->> 'texto', false
      FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) it, jsonb_array_elements(coalesce(it -> 'avisos', '[]'::jsonb)) x
    UNION ALL
    -- 5a. CID da porta quando o procedimento exige
    SELECT 'procedimento', 'cid_exigido',
           'O procedimento ' || (it ->> 'procedimento') || ' exige CID e o atendimento não tem diagnóstico principal.', true
      FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) it
     WHERE c.tipo = 'ambulatorial' AND it ->> 'origem' IN ('atendimento', 'registro') AND it ->> 'procedimento' IS NOT NULL
       AND private.cid_normalizado(it ->> 'cid') IS NULL
       AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_cid r WHERE r.procedimento = it ->> 'procedimento')
    UNION ALL
    SELECT 'procedimento', 'cid_procedimento',
           'O CID ' || private.cid_normalizado(it ->> 'cid') || ' não é aceito pelo procedimento ' || (it ->> 'procedimento') || ' no SIGTAP.', true
      FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) it
     WHERE c.tipo = 'ambulatorial' AND it ->> 'origem' IN ('atendimento', 'registro') AND it ->> 'procedimento' IS NOT NULL
       AND private.cid_normalizado(it ->> 'cid') IS NOT NULL
       AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_cid r WHERE r.procedimento = it ->> 'procedimento')
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_cid r
                        WHERE r.procedimento = it ->> 'procedimento' AND r.cid = private.cid_normalizado(it ->> 'cid'))
    UNION ALL
    -- 5a. CNES da unidade
    SELECT 'unidade', 'cnes', 'CNES da unidade ausente ou fora do formato (7 dígitos).', true
      FROM public.unidades u WHERE u.id = c.unidade_id AND coalesce(u.cnes, '') !~ '^[0-9]{7}$'
    UNION ALL
    -- 2a. AIH: a falta de AIH aprovada bloqueia; APAC só avisa
    SELECT 'documento', CASE WHEN a LIKE 'APAC%' THEN 'apac' ELSE 'aih' END, a, a NOT LIKE 'APAC%'
      FROM jsonb_array_elements_text(coalesce(p_docs -> 'avisos', '[]'::jsonb)) a
    UNION ALL
    -- medicamentos: só aviso
    SELECT 'medicamento', 'medicamento', (m ->> 'medicamento') || ': ' || (m ->> 'aviso'), false
      FROM jsonb_array_elements(coalesce(p_meds, '[]'::jsonb)) m
     WHERE m ->> 'aviso' IS NOT NULL AND NOT coalesce((m ->> 'fora_da_conta')::boolean, false)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'chave', grupo || '|' || codigo || '|' || texto, 'grupo', grupo, 'codigo', codigo, 'texto', texto,
           'bloqueante', bloqueia, 'vezes', vezes)
         ORDER BY bloqueia DESC, array_position(ARRAY['unidade', 'paciente', 'profissional', 'procedimento', 'documento', 'medicamento'], grupo), texto),
         '[]'::jsonb)
    FROM (SELECT grupo, codigo, texto, bool_or(bloqueia) AS bloqueia, count(*) AS vezes FROM p
           WHERE texto IS NOT NULL GROUP BY grupo, codigo, texto) g
$$;
REVOKE ALL ON FUNCTION private.conta_pendencias(public.contas, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- bloqueantes que a liberação do gestor não cobre
CREATE OR REPLACE FUNCTION private.bloqueantes_sem_liberacao(c public.contas, p_pend jsonb)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(coalesce(p_pend, '[]'::jsonb)) x
   WHERE (x ->> 'bloqueante')::boolean
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(c.liberacao_pendencias, '[]'::jsonb)) l
                      WHERE l ->> 'chave' = x ->> 'chave')
$$;
REVOKE ALL ON FUNCTION private.bloqueantes_sem_liberacao(public.contas, jsonb) FROM PUBLIC, anon, authenticated;

-- pendências de agora (conta aberta ou em conferência)
CREATE OR REPLACE FUNCTION private.conta_pendencias_agora(c public.contas)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.conta_pendencias(c, private.conta_itens(c), private.conta_medicamentos(c), private.conta_documentos_sus(c))
$$;
REVOKE ALL ON FUNCTION private.conta_pendencias_agora(public.contas) FROM PUBLIC, anon, authenticated;

-- 1a/3a/6a. etapas: o fechamento confere as pendências; a lista e a liberação
-- ficam guardadas; voltar a aberta desfaz a liberação
CREATE OR REPLACE FUNCTION public.mudar_etapa_conta(p_conta uuid, p_para text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  c public.contas;
  v_eu uuid := private.meu_perfil_id();
  v_faturamento boolean;
  v_gestor boolean;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_evento text;
  v_pend jsonb;
  v_falta jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_faturamento := private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento');
  v_gestor := private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id);

  IF c.status = 'aberta' AND p_para = 'em_conferencia' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'A conferência é do faturamento.'; END IF;
    v_evento := 'conferencia';
  ELSIF c.status = 'em_conferencia' AND p_para = 'aberta' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'A conferência é do faturamento.'; END IF;
    IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que a conta volta a aberta (mínimo de 10 letras).'; END IF;
    v_evento := 'devolvida';
  ELSIF c.status = 'em_conferencia' AND p_para = 'fechada' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'Quem fecha a conta é o faturamento.'; END IF;
    IF NOT coalesce(private.conta_atendimento_terminou(c), false) THEN
      RAISE EXCEPTION '%', CASE c.tipo WHEN 'ambulatorial' THEN 'O atendimento ainda não terminou: a conta fecha depois do desfecho.'
                                      ELSE 'A internação ainda não teve alta: a conta fecha depois da alta.' END;
    END IF;
    -- Fase 5B, tarefa 5: pendência bloqueante sem liberação do gestor trava
    v_pend := private.conta_pendencias_agora(c);
    v_falta := private.bloqueantes_sem_liberacao(c, v_pend);
    IF jsonb_array_length(v_falta) > 0 THEN
      RAISE EXCEPTION 'A conta tem % pendência(s) bloqueante(s): % Corrija na origem ou peça ao gestor a liberação do fechamento.',
        jsonb_array_length(v_falta), (SELECT string_agg(x ->> 'texto', ' ') FROM jsonb_array_elements(v_falta) x);
    END IF;
    v_evento := 'fechada';
  ELSIF c.status = 'fechada' AND p_para = 'faturada' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'Quem marca a conta como faturada é o faturamento.'; END IF;
    v_evento := 'faturada';
  ELSIF c.status IN ('fechada', 'faturada') AND p_para = 'aberta' THEN
    IF NOT v_gestor THEN RAISE EXCEPTION 'Reabrir conta fechada é do gestor da unidade.'; END IF;
    IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que a conta é reaberta (mínimo de 10 letras).'; END IF;
    v_evento := 'reaberta';
  ELSE
    RAISE EXCEPTION 'Mudança de etapa não permitida: de % para %.', c.status, p_para;
  END IF;

  UPDATE public.contas SET status = p_para, status_em = now(), status_por = v_eu,
         -- Fase 5B, tarefa 2: a lista congela no fechamento e volta a acompanhar na reabertura
         itens_congelados = CASE WHEN p_para = 'fechada' THEN private.conta_itens(c) WHEN p_para = 'aberta' THEN NULL ELSE itens_congelados END,
         medicamentos_congelados = CASE WHEN p_para = 'fechada' THEN private.conta_medicamentos(c) WHEN p_para = 'aberta' THEN NULL ELSE medicamentos_congelados END,
         -- Fase 5B, tarefa 5: pendências do fechamento guardadas; voltar a aberta desfaz a liberação
         pendencias_fechamento = CASE WHEN p_para = 'fechada' THEN v_pend WHEN p_para = 'aberta' THEN NULL ELSE pendencias_fechamento END,
         liberada_em = CASE WHEN p_para = 'aberta' THEN NULL ELSE liberada_em END,
         liberada_por = CASE WHEN p_para = 'aberta' THEN NULL ELSE liberada_por END,
         liberacao_motivo = CASE WHEN p_para = 'aberta' THEN NULL ELSE liberacao_motivo END,
         liberacao_pendencias = CASE WHEN p_para = 'aberta' THEN NULL ELSE liberacao_pendencias END,
         congelada_em = CASE WHEN p_para = 'fechada' THEN now() WHEN p_para = 'aberta' THEN NULL ELSE congelada_em END
   WHERE id = c.id;
  INSERT INTO public.conta_eventos (conta_id, evento, de, para, motivo, por, detalhes)
  VALUES (c.id, v_evento, c.status, p_para, v_motivo, v_eu,
          CASE WHEN v_evento = 'fechada' THEN jsonb_build_object('pendencias', v_pend,
            'liberacao', CASE WHEN c.liberada_em IS NOT NULL THEN jsonb_build_object('em', c.liberada_em, 'por', c.liberada_por, 'motivo', c.liberacao_motivo) END) END);
  PERFORM private.registrar_auditoria('conta_' || v_evento, 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'de', c.status, 'para', p_para, 'motivo', v_motivo,
                       'pendencias_bloqueantes', CASE WHEN v_evento = 'fechada'
                         THEN (SELECT count(*) FROM jsonb_array_elements(v_pend) x WHERE (x ->> 'bloqueante')::boolean) END));
  RETURN public.conta_detalhe(c.id);
END $function$;

-- 3a. o gestor libera o fechamento com pendência bloqueante, com justificativa
CREATE OR REPLACE FUNCTION public.liberar_fechamento_conta(p_conta uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
        v_pend jsonb; v_bloq jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade libera o fechamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'em_conferencia' THEN RAISE EXCEPTION 'A liberação é para conta em conferência.'; END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Escreva a justificativa da liberação (mínimo de 10 letras).'; END IF;
  v_pend := private.conta_pendencias_agora(c);
  v_bloq := (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(v_pend) x WHERE (x ->> 'bloqueante')::boolean);
  IF jsonb_array_length(v_bloq) = 0 THEN RAISE EXCEPTION 'Não há pendência bloqueante para liberar.'; END IF;
  UPDATE public.contas SET liberada_em = now(), liberada_por = v_eu, liberacao_motivo = v_motivo, liberacao_pendencias = v_bloq
   WHERE id = c.id;
  INSERT INTO public.conta_eventos (conta_id, evento, de, para, motivo, por, detalhes)
  VALUES (c.id, 'liberada', c.status, c.status, v_motivo, v_eu, jsonb_build_object('pendencias', v_bloq));
  PERFORM private.registrar_auditoria('conta_fechamento_liberado', 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'motivo', v_motivo, 'pendencias', jsonb_array_length(v_bloq)));
  RETURN public.conta_detalhe(c.id);
END $$;
REVOKE ALL ON FUNCTION public.liberar_fechamento_conta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_fechamento_conta(uuid, text) TO authenticated;

-- detalhe com as pendências (substitui a versão da tarefa 4, acrescentando-as)
CREATE OR REPLACE FUNCTION public.conta_detalhe(p_conta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_itens jsonb; v_meds jsonb; v_docs jsonb; v_pend jsonb; v_aberta boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_aberta := c.status IN ('aberta', 'em_conferencia');
  v_itens := coalesce(c.itens_congelados, private.conta_itens(c));
  v_meds := coalesce(c.medicamentos_congelados, private.conta_medicamentos(c));
  v_docs := private.conta_documentos_sus(c);
  -- conta aberta: pendências de agora; fechada: as guardadas no fechamento
  v_pend := CASE WHEN v_aberta THEN private.conta_pendencias(c, v_itens, v_meds, v_docs) ELSE coalesce(c.pendencias_fechamento, '[]'::jsonb) END;
  RETURN private.conta_json(c) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('evento', ev.evento, 'de', ev.de, 'para', ev.para, 'motivo', ev.motivo,
                               'por', (SELECT nome_completo FROM public.perfis WHERE id = ev.por), 'em', ev.em) ORDER BY ev.em)
                          FROM public.conta_eventos ev WHERE ev.conta_id = c.id), '[]'::jsonb),
    'pode_conduzir', private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento'),
    'pode_reabrir', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id),
    'itens', v_itens,
    'congelada_em', c.congelada_em,
    'total_referencia', (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(v_itens) x),
    'itens_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_itens) x WHERE jsonb_array_length(coalesce(x -> 'criticas', '[]'::jsonb)) > 0),
    'medicamentos', v_meds,
    'medicamentos_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_meds) x WHERE x ->> 'aviso' IS NOT NULL AND NOT (x ->> 'fora_da_conta')::boolean),
    'documentos_sus', v_docs,
    'pendencias', v_pend,
    'pendencias_registradas', v_aberta OR c.pendencias_fechamento IS NOT NULL,
    'bloqueantes_sem_liberacao', CASE WHEN v_aberta THEN jsonb_array_length(private.bloqueantes_sem_liberacao(c, v_pend)) ELSE 0 END,
    'liberacao', CASE WHEN c.liberada_em IS NOT NULL THEN jsonb_build_object(
                   'em', c.liberada_em, 'por', (SELECT nome_completo FROM public.perfis WHERE id = c.liberada_por),
                   'motivo', c.liberacao_motivo, 'pendencias', c.liberacao_pendencias) END,
    'pode_liberar', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id));
END $$;

-- 4a. resumo de pendências por conta para a lista. As linhas do BPA saem de uma
-- chamada por competência para todas as contas da porta, não de uma por conta.
CREATE OR REPLACE FUNCTION private.contas_pendencias_resumo(p_unidade uuid, p_contas uuid[])
RETURNS TABLE (conta_id uuid, bloqueantes int, avisos int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_comp text; v_eps uuid[]; v_porta jsonb := '{}'::jsonb; v_pend jsonb; v_itens jsonb;
BEGIN
  SELECT array_agg(k.episodio_id) INTO v_eps FROM public.contas k
   WHERE k.id = ANY(p_contas) AND k.tipo = 'ambulatorial' AND k.status IN ('aberta', 'em_conferencia') AND k.episodio_id IS NOT NULL;
  IF v_eps IS NOT NULL THEN
    FOR v_comp IN
      SELECT DISTINCT to_char(m, 'YYYYMM')
        FROM public.contas k JOIN public.episodios e ON e.id = k.episodio_id,
             generate_series(date_trunc('month', (coalesce(e.chegada_em, k.aberta_em) AT TIME ZONE 'America/Sao_Paulo'))::date,
                             date_trunc('month', (coalesce(e.encerrado_em, e.desfecho_em, now()) AT TIME ZONE 'America/Sao_Paulo'))::date,
                             interval '1 month') m
       WHERE k.episodio_id = ANY(v_eps) AND k.tipo = 'ambulatorial'
    LOOP
      SELECT v_porta || coalesce(jsonb_object_agg(x.ep, x.itens), '{}'::jsonb) INTO v_porta FROM (
        SELECT l.episodio_id::text AS ep,
               coalesce(v_porta -> l.episodio_id::text, '[]'::jsonb)
                 || jsonb_agg(jsonb_build_object('origem', l.origem, 'procedimento', l.procedimento, 'cid', l.cid,
                                                 'criticas', l.criticas, 'avisos', l.avisos, 'destino', l.destino)) AS itens
          FROM private.bpa_linhas(p_unidade, v_comp) l WHERE l.episodio_id = ANY(v_eps) GROUP BY l.episodio_id) x;
    END LOOP;
  END IF;
  FOR c IN SELECT * FROM public.contas k WHERE k.id = ANY(p_contas) LOOP
    IF c.status IN ('aberta', 'em_conferencia') THEN
      v_itens := CASE WHEN c.tipo = 'ambulatorial' THEN coalesce(v_porta -> c.episodio_id::text, '[]'::jsonb) ELSE private.conta_itens(c) END;
      v_pend := private.conta_pendencias(c, v_itens, private.conta_medicamentos(c), private.conta_documentos_sus(c));
      conta_id := c.id;
      bloqueantes := jsonb_array_length(private.bloqueantes_sem_liberacao(c, v_pend));
    ELSE
      v_pend := coalesce(c.pendencias_fechamento, '[]'::jsonb);
      conta_id := c.id;
      bloqueantes := (SELECT count(*) FROM jsonb_array_elements(v_pend) x WHERE (x ->> 'bloqueante')::boolean);
    END IF;
    avisos := (SELECT count(*) FROM jsonb_array_elements(v_pend) x WHERE NOT (x ->> 'bloqueante')::boolean);
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.contas_pendencias_resumo(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.contas_da_unidade(p_unidade uuid, p_status text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_ids uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT array_agg(c.id) INTO v_ids FROM (
    SELECT c.id FROM public.contas c
     WHERE c.unidade_id = p_unidade AND (p_status IS NULL OR c.status = p_status) AND (p_tipo IS NULL OR c.tipo = p_tipo)
     ORDER BY c.aberta_em DESC LIMIT 500) c;
  RETURN jsonb_build_object(
    'contas', coalesce((SELECT jsonb_agg(private.conta_json(c)
                                 || jsonb_build_object('pendencias', jsonb_build_object('bloqueantes', r.bloqueantes, 'avisos', r.avisos))
                                 ORDER BY c.aberta_em DESC)
                          FROM public.contas c
                          LEFT JOIN private.contas_pendencias_resumo(p_unidade, v_ids) r ON r.conta_id = c.id
                         WHERE c.id = ANY(v_ids)), '[]'::jsonb),
    'totais', (SELECT jsonb_object_agg(s, (SELECT count(*) FROM public.contas c WHERE c.unidade_id = p_unidade AND c.status = s
                                             AND (p_tipo IS NULL OR c.tipo = p_tipo)))
                 FROM unnest(ARRAY['aberta', 'em_conferencia', 'fechada', 'faturada']) s));
END $function$;
