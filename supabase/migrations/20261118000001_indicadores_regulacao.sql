-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 10 — indicadores de regulação (decisões do RT de 11/10/2026,
-- BACKLOG.md).
--
-- • Tempos (mediana e percentil 90): até a decisão da central (só o tempo com
--   ela), até o aceite do destino e até a chegada; por prioridade e por tipo.
-- • Fila atual por tipo e prioridade; volume por dia, origem, destino e tipo.
-- • Desfechos: autorização, negação (por motivo), devolução, recusa do
--   destino (por motivo), cancelamento e falta.
-- • Cumprimento dos prazos da tarefa 7 (fila, pendência, evolução, destino) e
--   gargalos por unidade, tipo de leito e motivo.
-- • Quem vê: a central (regulador e gestor) e a Secretaria/Regulação regional
--   veem a rede (as unidades liberadas, no caso dos papéis de rede); o gestor
--   vê a unidade dele como origem e como destino. Só números.
-- • Período: pedidos criados entre "de" e "até" (padrão: últimos 30 dias;
--   máximo de 366 dias). A fila atual não depende do período.
-- ════════════════════════════════════════════════════════════════════════════

-- mediana e percentil 90 de uma lista de segundos
CREATE OR REPLACE FUNCTION private.reg_estat(v double precision[])
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('n', count(x),
           'mediana', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY x))::bigint,
           'p90', round(percentile_cont(0.9) WITHIN GROUP (ORDER BY x))::bigint)
    FROM unnest(coalesce(v, '{}')) x
$$;

-- Escopo de quem consulta: a organização e, se não for a rede inteira, as unidades.
CREATE OR REPLACE FUNCTION private.reg_indicadores_escopo(p_unidade uuid, OUT org uuid, OUT unidades uuid[], OUT rede boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_central uuid;
BEGIN
  SELECT u.organizacao_id INTO org FROM public.unidades u WHERE u.id = p_unidade;
  IF org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c WHERE c.organizacao_id = org;
  IF p_unidade = v_central AND (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor')) THEN
    rede := true; unidades := NULL; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    PERFORM private.rede_exigir(p_unidade, ARRAY['secretaria', 'regulacao_regional']);
    rede := false; unidades := ARRAY(SELECT private.rede_unidades(org)); RETURN;
  END IF;
  IF private.tenho_papel(p_unidade, 'gestor') THEN
    rede := false; unidades := ARRAY[p_unidade]; RETURN;
  END IF;
  RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
END $$;
REVOKE ALL ON FUNCTION private.reg_indicadores_escopo(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_indicadores(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  e record;
  p public.regulacao_prazos;
  v_de date := coalesce(nullif(f->>'de', '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 29);
  v_ate date := coalesce(nullif(f->>'ate', '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_resultado jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM private.reg_indicadores_escopo(p_unidade);
  IF v_ate < v_de THEN RAISE EXCEPTION 'O fim do período vem depois do início.'; END IF;
  IF v_ate - v_de > 366 THEN RAISE EXCEPTION 'Período de até 366 dias.'; END IF;
  p := private.regulacao_prazos_de((SELECT c.unidade_id FROM public.centrais_regulacao c WHERE c.organizacao_id = e.org));

  WITH escopo AS (
    SELECT s.* FROM public.regulacao_solicitacoes s
     WHERE s.organizacao_id = e.org AND s.status <> 'excluida'
       AND (e.rede OR s.unidade_origem_id = ANY (e.unidades) OR s.destino_unidade_id = ANY (e.unidades))
       AND (NOT f ? 'tipo' OR s.tipo = f->>'tipo')
       AND (NOT f ? 'prioridade' OR coalesce(s.prioridade_regulador, s.prioridade) = f->>'prioridade')
       AND (NOT f ? 'origem_id' OR s.unidade_origem_id = (f->>'origem_id')::uuid)
       AND (NOT f ? 'destino_id' OR s.destino_unidade_id = (f->>'destino_id')::uuid)
  ), base AS (
    SELECT s.id, s.tipo, coalesce(s.prioridade_regulador, s.prioridade) AS pri, s.unidade_origem_id AS origem, s.destino_unidade_id AS destino,
           s.tipo_leito, s.status, s.criada_em, s.motivo_negacao,
           s.autorizada_em IS NOT NULL AS autorizada, s.status = 'negada' AS negada, s.devolvida_em IS NOT NULL AS devolvida,
           s.status = 'cancelada' AS cancelada, s.status = 'falta' AS falta, s.status = 'realizada' AS realizada,
           CASE WHEN s.autorizada_em IS NOT NULL OR s.negada_em IS NOT NULL THEN
             (SELECT sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio)) FROM public.regulacao_status_tempos t
               WHERE t.solicitacao_id = s.id AND t.status IN ('enviada', 'em_analise')) END AS dec_seg,
           CASE WHEN s.destino_resposta = 'aceita' AND s.destino_enviado_em IS NOT NULL
             THEN extract(epoch FROM s.destino_respondido_em - s.destino_enviado_em) END AS aceite_seg,
           CASE WHEN s.status = 'realizada' AND s.realizada_em IS NOT NULL THEN extract(epoch FROM s.realizada_em - s.criada_em) END AS chegada_seg,
           CASE coalesce(s.prioridade_regulador, s.prioridade) WHEN 'emergencia' THEN p.fila_emergencia_min WHEN 'urgencia' THEN p.fila_urgencia_min
                WHEN 'prioritaria' THEN p.fila_prioritaria_min WHEN 'eletiva' THEN p.fila_eletiva_min END AS prazo_fila_min,
           -- evolução: maior intervalo entre evoluções enquanto esperava decisão (leito e transferência)
           CASE WHEN s.tipo IN ('leito', 'transferencia') THEN (
             SELECT max(g) FROM (
               SELECT extract(epoch FROM lead(m) OVER (ORDER BY m) - m) AS g FROM (
                 SELECT s.criada_em AS m UNION SELECT s.reenviada_em WHERE s.reenviada_em IS NOT NULL
                 UNION SELECT ev.em FROM public.regulacao_evolucoes ev WHERE ev.solicitacao_id = s.id
                   AND ev.em <= coalesce(s.autorizada_em, s.negada_em, s.cancelada_em, now())
                 UNION SELECT coalesce(s.autorizada_em, s.negada_em, s.cancelada_em, now())) marcas) gaps) END AS evol_max_seg
      FROM escopo s
     WHERE s.criada_em >= (v_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND s.criada_em < ((v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), respostas AS (
    SELECT r.* FROM public.regulacao_destino_respostas r JOIN base b ON b.id = r.solicitacao_id
  ), pend AS (
    SELECT extract(epoch FROM t.fim - t.inicio) AS seg FROM public.regulacao_status_tempos t JOIN base b ON b.id = t.solicitacao_id
     WHERE t.status IN ('pendencia', 'devolvida') AND t.fim IS NOT NULL
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    'escopo', CASE WHEN e.rede THEN 'rede' ELSE 'unidades' END,
    'total', (SELECT count(*) FROM base),
    'tempos', jsonb_build_object(
      'decisao', jsonb_build_object(
        'geral', (SELECT private.reg_estat(array_agg(dec_seg)) FROM base WHERE dec_seg IS NOT NULL),
        'por_prioridade', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', pri) || private.reg_estat(v) ORDER BY pri)
            FROM (SELECT pri, array_agg(dec_seg) v FROM base WHERE dec_seg IS NOT NULL GROUP BY pri) x), '[]'::jsonb),
        'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', tipo) || private.reg_estat(v) ORDER BY tipo)
            FROM (SELECT tipo, array_agg(dec_seg) v FROM base WHERE dec_seg IS NOT NULL GROUP BY tipo) x), '[]'::jsonb)),
      'aceite', jsonb_build_object(
        'geral', (SELECT private.reg_estat(array_agg(aceite_seg)) FROM base WHERE aceite_seg IS NOT NULL),
        'por_prioridade', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', pri) || private.reg_estat(v) ORDER BY pri)
            FROM (SELECT pri, array_agg(aceite_seg) v FROM base WHERE aceite_seg IS NOT NULL GROUP BY pri) x), '[]'::jsonb),
        'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', tipo) || private.reg_estat(v) ORDER BY tipo)
            FROM (SELECT tipo, array_agg(aceite_seg) v FROM base WHERE aceite_seg IS NOT NULL GROUP BY tipo) x), '[]'::jsonb)),
      'chegada', jsonb_build_object(
        'geral', (SELECT private.reg_estat(array_agg(chegada_seg)) FROM base WHERE chegada_seg IS NOT NULL),
        'por_prioridade', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', pri) || private.reg_estat(v) ORDER BY pri)
            FROM (SELECT pri, array_agg(chegada_seg) v FROM base WHERE chegada_seg IS NOT NULL GROUP BY pri) x), '[]'::jsonb),
        'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', tipo) || private.reg_estat(v) ORDER BY tipo)
            FROM (SELECT tipo, array_agg(chegada_seg) v FROM base WHERE chegada_seg IS NOT NULL GROUP BY tipo) x), '[]'::jsonb))),
    -- fila agora (não depende do período)
    'fila_atual', jsonb_build_object(
      'por_tipo', coalesce((SELECT jsonb_object_agg(tipo, n) FROM (SELECT tipo, count(*) n FROM escopo
          WHERE status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') GROUP BY tipo) x), '{}'::jsonb),
      'por_prioridade', coalesce((SELECT jsonb_object_agg(pri, n) FROM (SELECT coalesce(prioridade_regulador, prioridade) pri, count(*) n FROM escopo
          WHERE status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') GROUP BY 1) x), '{}'::jsonb)),
    'volume', jsonb_build_object(
      'por_dia', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', dia, 'n', n) ORDER BY dia)
          FROM (SELECT (criada_em AT TIME ZONE 'America/Sao_Paulo')::date dia, count(*) n FROM base GROUP BY 1) x), '[]'::jsonb),
      'por_tipo', coalesce((SELECT jsonb_object_agg(tipo, n) FROM (SELECT tipo, count(*) n FROM base GROUP BY tipo) x), '{}'::jsonb),
      'por_origem', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'n', x.n) ORDER BY x.n DESC, u.nome)
          FROM (SELECT origem, count(*) n FROM base GROUP BY origem) x JOIN public.unidades u ON u.id = x.origem), '[]'::jsonb),
      'por_destino', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'n', x.n) ORDER BY x.n DESC, u.nome)
          FROM (SELECT destino, count(*) n FROM base WHERE destino IS NOT NULL GROUP BY destino) x JOIN public.unidades u ON u.id = x.destino), '[]'::jsonb)),
    'desfechos', jsonb_build_object(
      'autorizadas', (SELECT count(*) FILTER (WHERE autorizada) FROM base),
      'negadas', (SELECT count(*) FILTER (WHERE negada) FROM base),
      'devolvidas', (SELECT count(*) FILTER (WHERE devolvida) FROM base),
      'canceladas', (SELECT count(*) FILTER (WHERE cancelada) FROM base),
      'realizadas', (SELECT count(*) FILTER (WHERE realizada) FROM base),
      'faltas', (SELECT count(*) FILTER (WHERE falta) FROM base),
      'negacao_por_motivo', coalesce((SELECT jsonb_object_agg(motivo_negacao, n) FROM (SELECT motivo_negacao, count(*) n FROM base
          WHERE negada AND motivo_negacao IS NOT NULL GROUP BY 1) x), '{}'::jsonb),
      'respostas_destino', (SELECT count(*) FROM respostas),
      'recusas_destino', (SELECT count(*) FROM respostas WHERE resposta = 'recusada'),
      'recusa_por_motivo', coalesce((SELECT jsonb_object_agg(motivo, n) FROM (SELECT motivo, count(*) n FROM respostas
          WHERE resposta = 'recusada' AND motivo IS NOT NULL GROUP BY 1) x), '{}'::jsonb)),
    'prazos', jsonb_build_object(
      'fila', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE dec_seg <= prazo_fila_min * 60)) FROM base
                WHERE dec_seg IS NOT NULL AND prazo_fila_min IS NOT NULL),
      'pendencia', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE seg <= p.pendencia_h * 3600)) FROM pend),
      'evolucao', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE evol_max_seg <= p.evolucao_h * 3600)) FROM base
                    WHERE evol_max_seg IS NOT NULL),
      'destino', (SELECT jsonb_build_object('n', count(*), 'no_prazo', count(*) FILTER (WHERE r.em - s.destino_enviado_em <= make_interval(hours => p.destino_h)))
                    FROM respostas r JOIN public.regulacao_solicitacoes s ON s.id = r.solicitacao_id
                   WHERE s.destino_enviado_em IS NOT NULL AND r.em >= s.destino_enviado_em),
      'valores', jsonb_build_object('pendencia_h', p.pendencia_h, 'evolucao_h', p.evolucao_h, 'destino_h', p.destino_h,
                   'fila_min', jsonb_build_object('emergencia', p.fila_emergencia_min, 'urgencia', p.fila_urgencia_min,
                                                  'prioritaria', p.fila_prioritaria_min, 'eletiva', p.fila_eletiva_min))),
    'gargalos', jsonb_build_object(
      'por_origem', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'n', x.n, 'decisao_mediana', (x.est->>'mediana')::bigint,
                                'devolvidas', x.dev, 'negadas', x.neg) ORDER BY (x.est->>'mediana')::bigint DESC NULLS LAST, x.n DESC)
          FROM (SELECT origem, count(*) n, private.reg_estat(array_agg(dec_seg) FILTER (WHERE dec_seg IS NOT NULL)) est,
                       count(*) FILTER (WHERE devolvida) dev, count(*) FILTER (WHERE negada) neg
                  FROM base GROUP BY origem) x JOIN public.unidades u ON u.id = x.origem), '[]'::jsonb),
      'por_destino', coalesce((SELECT jsonb_agg(jsonb_build_object('unidade', u.nome, 'respostas', x.n, 'recusas', x.rec,
                                'aceite_mediana', (x.est->>'mediana')::bigint) ORDER BY x.rec DESC, x.n DESC)
          FROM (SELECT r.destino_unidade_id d, count(*) n, count(*) FILTER (WHERE r.resposta = 'recusada') rec,
                       (SELECT private.reg_estat(array_agg(b.aceite_seg)) FROM base b WHERE b.destino = r.destino_unidade_id AND b.aceite_seg IS NOT NULL) est
                  FROM respostas r WHERE r.destino_unidade_id IS NOT NULL GROUP BY r.destino_unidade_id) x
          JOIN public.unidades u ON u.id = x.d), '[]'::jsonb),
      'por_tipo_leito', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_leito', x.tl, 'n', x.n, 'decisao_mediana', (x.est->>'mediana')::bigint,
                                   'recusas', x.rec) ORDER BY x.n DESC)
          FROM (SELECT b.tipo_leito tl, count(*) n, private.reg_estat(array_agg(b.dec_seg) FILTER (WHERE b.dec_seg IS NOT NULL)) est,
                       (SELECT count(*) FROM respostas r JOIN base b2 ON b2.id = r.solicitacao_id WHERE b2.tipo_leito = b.tipo_leito AND r.resposta = 'recusada') rec
                  FROM base b WHERE b.tipo_leito IS NOT NULL GROUP BY b.tipo_leito) x), '[]'::jsonb)),
    'agora', now())
  INTO v_resultado;
  RETURN v_resultado;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_indicadores(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_indicadores(uuid, jsonb) TO authenticated;
