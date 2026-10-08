-- Fase 1, tarefa 6 do BACKLOG.md — evasão e abandono.
--
-- Decisões do RT (07/10/2026):
--   • evasão agrupada pelo MOMENTO em que o paciente saiu (antes da triagem,
--     esperando o médico, durante o atendimento, na observação), pela cor e
--     pelo turno; e, a partir de agora, por um MOTIVO de lista curta pedido ao
--     registrar a evasão (demora, melhorou, foi a outro serviço, sem
--     informação, outro) — a justificativa escrita continua;
--   • alta a pedido em taxa SEPARADA (não soma com evasão);
--   • lista dos casos COM NOME, acesso registrado na auditoria (15 min);
--   • tela Indicadores (cartão completo) e resumo "evasões hoje" na tela Porta.
-- O motivo fica nos detalhes do desfecho: desfecho_detalhes.motivo_evasao (porta,
-- pelo médico ou pela retirada da fila) e alta_detalhes.motivo_evasao
-- (observação). Evasão antiga, sem motivo, conta como "sem informação".
-- Só aditiva: funções novas; porta_agora ganha o resumo de hoje.
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.indicador_evasao(uuid, date, date),
--   public.registrar_motivo_evasao(uuid, text); reaplicar porta_agora de 20261029000004.

-- ── motivo da evasão na retirada da fila (retirar_da_fila não tem detalhes) ─
CREATE OR REPLACE FUNCTION public.registrar_motivo_evasao(p_episodio uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_motivo IS NULL OR p_motivo NOT IN ('demora', 'melhorou', 'outro_servico', 'sem_informacao', 'outro') THEN
    RAISE EXCEPTION 'Motivo da evasão: demora, melhorou, outro serviço, sem informação ou outro.';
  END IF;
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND OR private.membro_da_unidade(e.unidade_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Atendimento não encontrado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.desfecho IS DISTINCT FROM 'evasao' THEN RAISE EXCEPTION 'Este atendimento não terminou em evasão.'; END IF;
  IF e.encerrado_em < now() - interval '2 hours' THEN
    RAISE EXCEPTION 'O motivo da evasão é registrado logo depois da evasão (até 2 horas).';
  END IF;
  UPDATE public.episodios
     SET desfecho_detalhes = coalesce(desfecho_detalhes, '{}'::jsonb) || jsonb_build_object('motivo_evasao', p_motivo),
         updated_at = now()
   WHERE id = e.id;
  PERFORM private.registrar_auditoria('registrar_motivo_evasao', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('motivo', p_motivo));
END $$;
REVOKE ALL ON FUNCTION public.registrar_motivo_evasao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_motivo_evasao(uuid, text) TO authenticated;

-- ── indicador do período ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.indicador_evasao(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_res  jsonb;
  v_ator uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;

  WITH ep AS (
    SELECT e.*, pa.nome AS paciente_nome, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo') AS local,
           i.id AS internacao_id, i.status AS obs_status, i.data_alta AS obs_alta,
           i.alta_detalhes, i.alta_observacoes
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
      LEFT JOIN LATERAL (
        SELECT x.* FROM public.internacoes x WHERE x.episodio_id = e.id ORDER BY x.created_at DESC LIMIT 1) i ON true
     WHERE e.unidade_id = p_unidade
       AND e.chegada_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND e.chegada_em <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), c AS (
    SELECT ep.*,
           ep.local::date AS dia,
           CASE WHEN ep.local::time >= time '07:00' AND ep.local::time < time '13:00' THEN 'manha'
                WHEN ep.local::time >= time '13:00' AND ep.local::time < time '19:00' THEN 'tarde'
                ELSE 'noite' END AS turno,
           (ep.desfecho = 'evasao' OR ep.obs_status = 'alta_evasao') AS evadiu,
           (ep.desfecho = 'alta_a_pedido' OR ep.obs_status = 'alta_pedido') AS a_pedido,
           (SELECT k.cor FROM public.classificacoes_risco k WHERE k.episodio_id = ep.id ORDER BY k.criado_em DESC LIMIT 1) AS cor,
           EXISTS (SELECT 1 FROM public.classificacoes_risco k WHERE k.episodio_id = ep.id) AS triado
      FROM ep
  ), ev AS (
    SELECT c.*,
           CASE WHEN c.obs_status = 'alta_evasao' THEN 'observacao'
                WHEN NOT c.triado THEN 'antes_triagem'
                WHEN c.atendimento_iniciado_em IS NULL THEN 'aguardando_medico'
                ELSE 'durante_atendimento' END AS momento,
           CASE WHEN coalesce(c.desfecho_detalhes ->> 'motivo_evasao', c.alta_detalhes ->> 'motivo_evasao')
                       IN ('demora', 'melhorou', 'outro_servico', 'sem_informacao', 'outro')
                  THEN coalesce(c.desfecho_detalhes ->> 'motivo_evasao', c.alta_detalhes ->> 'motivo_evasao')
                ELSE 'sem_informacao' END AS motivo,
           coalesce(CASE WHEN c.obs_status = 'alta_evasao' THEN c.obs_alta END, c.encerrado_em) AS saiu_em,
           coalesce(CASE WHEN c.obs_status = 'alta_evasao' THEN c.alta_observacoes END,
                    regexp_replace(c.desfecho_motivo, '^evasao:\s*', '')) AS justificativa
      FROM c WHERE c.evadiu
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate,
    'chegadas', (SELECT count(*) FROM c),
    'evasoes', (SELECT count(*) FROM ev),
    'alta_a_pedido', (SELECT count(*) FROM c WHERE c.a_pedido),
    'por_momento', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ev WHERE ev.momento = m))
                      FROM unnest(ARRAY['antes_triagem', 'aguardando_medico', 'durante_atendimento', 'observacao']) m),
    'por_motivo', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ev WHERE ev.motivo = m))
                     FROM unnest(ARRAY['demora', 'melhorou', 'outro_servico', 'sem_informacao', 'outro']) m),
    'por_cor', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ev WHERE coalesce(ev.cor, 'sem_classificacao') = m))
                  FROM unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'sem_classificacao']) m),
    'por_turno', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ev WHERE ev.turno = m))
                    FROM unnest(ARRAY['manha', 'tarde', 'noite']) m),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', d.dia, 'chegadas', d.chegadas, 'evasoes', d.evasoes, 'alta_a_pedido', d.ap) ORDER BY d.dia)
        FROM (SELECT x.dia, count(*) AS chegadas, count(*) FILTER (WHERE x.evadiu) AS evasoes,
                     count(*) FILTER (WHERE x.a_pedido) AS ap
                FROM c x GROUP BY x.dia) d), '[]'::jsonb),
    'casos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'nome', ev.paciente_nome, 'chegada_em', ev.chegada_em, 'saiu_em', ev.saiu_em, 'cor', ev.cor,
               'momento', ev.momento, 'motivo', ev.motivo, 'justificativa', ev.justificativa) ORDER BY ev.chegada_em DESC)
        FROM (SELECT * FROM ev ORDER BY ev.chegada_em DESC LIMIT 300) ev), '[]'::jsonb))
    INTO v_res;

  -- nome de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_res -> 'casos') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_evasoes'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_evasoes', 'episodios', NULL, p_unidade,
      jsonb_build_object('de', p_de, 'ate', p_ate, 'pacientes', jsonb_array_length(v_res -> 'casos')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_evasao(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_evasao(uuid, date, date) TO authenticated;

-- ── tela Porta: resumo de hoje (evasões e alta a pedido sobre as chegadas) ──
CREATE OR REPLACE FUNCTION public.porta_agora(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje   timestamptz := private.data_atual()::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_tempos jsonb;
  v_lista  jsonb;
  v_etapas jsonb;
  v_cores  jsonb;
  v_altas  int;
  v_obs6h  int;
  v_hoje_ev jsonb;
  v_ator   uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade vê a porta.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- tempo-alvo até o médico, por cor (ajuste da unidade › protocolo › Manchester)
  v_tempos := private.tempos_alvo_unidade(p_unidade);

  WITH ativos AS (
    -- porta: triagem e atendimento
    SELECT e.id AS episodio_id, pa.nome, e.cor_atual AS cor,
           CASE WHEN e.etapa = 'triagem' THEN 'triagem'
                WHEN e.atendimento_iniciado_em IS NULL THEN 'aguardando_medico'
                ELSE 'em_atendimento' END AS etapa,
           s.nome AS setor, NULL::text AS leito,
           CASE WHEN e.etapa = 'triagem' THEN e.chegada_em
                -- desde a 1ª classificação (decisão do RT, tarefa 4): a reclassificação não zera a espera
                WHEN e.atendimento_iniciado_em IS NULL THEN coalesce(
                  (SELECT min(c.criado_em) FROM public.classificacoes_risco c WHERE c.episodio_id = e.id AND NOT c.reclassificacao),
                  e.classificado_em, e.chegada_em)
                ELSE e.atendimento_iniciado_em END AS desde,
           NULL::timestamptz AS prazo
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
      LEFT JOIN public.setores s ON s.id = e.setor_id
     WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento')
    UNION ALL
    -- observação: setor e leito/poltrona atuais; prazo de 6 h da pendência
    SELECT i.episodio_id, pa.nome, ep.cor_atual, 'observacao',
           s.nome, l.identificador,
           coalesce(po.criada_em, i.data_entrada_setor, i.data_admissao),
           coalesce(po.prazo, coalesce(po.criada_em, i.data_entrada_setor, i.data_admissao) + interval '6 hours')
      FROM public.internacoes i
      JOIN public.pacientes pa ON pa.id = i.paciente_id
      LEFT JOIN public.episodios ep ON ep.id = i.episodio_id
      LEFT JOIN public.setores s ON s.id = i.setor_atual_id
      LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
      LEFT JOIN LATERAL (
        SELECT x.criada_em, x.prazo FROM public.pendencias x
         WHERE x.internacao_id = i.id AND x.tipo = 'observacao'
         ORDER BY (x.situacao = 'aberta') DESC, x.criada_em DESC LIMIT 1) po ON true
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao')
       AND private.setor_de_observacao(i.setor_atual_id)
  ), marcados AS (
    SELECT a.*,
           floor(extract(epoch FROM now() - a.desde) / 60)::int AS espera_min,
           CASE WHEN a.etapa = 'aguardando_medico' AND a.cor IS NOT NULL AND v_tempos ? a.cor
                  -- minutos inteiros, como espera_min: o vermelho (alvo 0) atrasa com 1 min completo
                  THEN floor(extract(epoch FROM now() - a.desde) / 60) > (v_tempos ->> a.cor)::int
                WHEN a.etapa = 'observacao' THEN now() > a.prazo
                ELSE false END AS fora_alvo,
           a.episodio_id IS NOT NULL AND a.etapa IN ('em_atendimento', 'aguardando_medico', 'observacao')
             AND cardinality(coalesce(private.medicacao_sem_checagem(a.episodio_id), '{}')) > 0 AS medicacao_pendente
      FROM ativos a
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'nome', m.nome, 'etapa', m.etapa, 'cor', m.cor, 'setor', m.setor, 'leito', m.leito,
      'espera_min', m.espera_min, 'fora_alvo', m.fora_alvo, 'medicacao_pendente', m.medicacao_pendente)
      ORDER BY CASE m.etapa WHEN 'triagem' THEN 1 WHEN 'aguardando_medico' THEN 2 WHEN 'em_atendimento' THEN 3 ELSE 4 END,
               m.fora_alvo DESC, m.espera_min DESC), '[]'::jsonb),
    jsonb_build_object(
      'triagem',            jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'triagem'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'triagem')),
      'aguardando_medico',  jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'aguardando_medico'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'aguardando_medico'),
                                               'fora_alvo', count(*) FILTER (WHERE m.etapa = 'aguardando_medico' AND m.fora_alvo)),
      'em_atendimento',     jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'em_atendimento'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'em_atendimento')),
      'medicacao_pendente', jsonb_build_object('n', count(*) FILTER (WHERE m.medicacao_pendente)),
      'observacao',         jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'observacao'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'observacao'),
                                               'acima_6h', count(*) FILTER (WHERE m.etapa = 'observacao' AND m.fora_alvo))),
    (SELECT coalesce(jsonb_object_agg(c.cor, jsonb_build_object(
              'n', (SELECT count(*) FROM marcados x WHERE x.etapa = 'aguardando_medico' AND x.cor = c.cor),
              'fora_alvo', (SELECT count(*) FROM marcados x WHERE x.etapa = 'aguardando_medico' AND x.cor = c.cor AND x.fora_alvo),
              'alvo_min', (v_tempos ->> c.cor)::int)), '{}'::jsonb)
       FROM unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul']) AS c(cor)),
    count(*) FILTER (WHERE m.etapa = 'observacao' AND m.fora_alvo)
    INTO v_lista, v_etapas, v_cores, v_obs6h
    FROM marcados m;

  -- altas de hoje: na porta e de observação/internação da unidade
  SELECT (SELECT count(*) FROM public.episodios e
           WHERE e.unidade_id = p_unidade AND e.desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido')
             AND e.desfecho_em >= v_hoje)
       + (SELECT count(*) FROM public.internacoes i
           WHERE i.unidade_id = p_unidade AND i.status IN ('alta_melhorada', 'alta_pedido')
             AND i.data_alta >= v_hoje)
    INTO v_altas;
  v_etapas := v_etapas || jsonb_build_object('altas_hoje', jsonb_build_object('n', v_altas));

  -- evasões e altas a pedido de hoje, sobre as chegadas de hoje (tarefa 6)
  SELECT jsonb_build_object(
           'chegadas', count(*),
           'evasoes', count(*) FILTER (WHERE e.desfecho = 'evasao'
                        OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.episodio_id = e.id AND i.status = 'alta_evasao')),
           'alta_a_pedido', count(*) FILTER (WHERE e.desfecho = 'alta_a_pedido'
                        OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.episodio_id = e.id AND i.status = 'alta_pedido')))
    INTO v_hoje_ev
    FROM public.episodios e
   WHERE e.unidade_id = p_unidade AND e.chegada_em >= v_hoje;

  -- dado de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_lista) > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_porta_agora'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_porta_agora', 'episodios', NULL, p_unidade,
      jsonb_build_object('pacientes', jsonb_array_length(v_lista)));
  END IF;

  RETURN jsonb_build_object('gerado_em', now(), 'tempos', v_tempos, 'etapas', v_etapas,
                            'aguardando_por_cor', v_cores, 'observacao_acima_6h', v_obs6h, 'hoje', v_hoje_ev,
                            'pacientes', v_lista);
END; $$;
REVOKE ALL ON FUNCTION public.porta_agora(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.porta_agora(uuid) TO authenticated;
