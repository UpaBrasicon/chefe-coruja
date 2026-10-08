-- Fase 1, tarefa 7 do BACKLOG.md — filtros livres de BI.
--
-- Decisões do RT (07/10/2026):
--   • UMA barra de filtros no topo da tela Indicadores vale para todos os
--     cartões: período, setor de entrada, cor (final), turno da chegada,
--     adulto/pediátrico e o MÉDICO QUE ATENDEU; os filtros ficam no endereço da
--     página (dá para salvar e mandar o link);
--   • a unidade é a ativa (comparar unidades fica para a Fase 4).
-- private.episodios_filtrados() é o recorte único: as chegadas do período que
-- passam nos filtros. Os quatro indicadores passam a usá-lo e ganham os
-- parâmetros opcionais (sem filtro = como antes; o site antigo continua
-- funcionando). opcoes_filtros_bi() lista setores e médicos para a barra.
-- "Etapa" do backlog não entra aqui: os indicadores do período já são, cada
-- um, de uma etapa; o "agora" por etapa é a tela Porta.
--
-- ROLLBACK: reaplicar as quatro funções das migrations 20261029000002, 4, 5 e 6
--   (assinaturas antigas) e DROP das novas assinaturas, de
--   private.episodios_filtrados e de public.opcoes_filtros_bi.

CREATE OR REPLACE FUNCTION private.episodios_filtrados(
  p_unidade uuid, p_de date, p_ate date,
  p_setor uuid DEFAULT NULL, p_cor text DEFAULT NULL, p_turno text DEFAULT NULL,
  p_publico text DEFAULT NULL, p_medico uuid DEFAULT NULL)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_cor IS NOT NULL AND p_cor NOT IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul') THEN RAISE EXCEPTION 'Cor inválida.'; END IF;
  IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;
  IF p_publico IS NOT NULL AND p_publico NOT IN ('adulto', 'pediatrico') THEN RAISE EXCEPTION 'Grupo inválido.'; END IF;
  RETURN QUERY
  SELECT e.id
    FROM public.episodios e
    LEFT JOIN LATERAL (
      SELECT c.cor, c.publico FROM public.classificacoes_risco c
       WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) ult ON true
   WHERE e.unidade_id = p_unidade
     AND e.chegada_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND e.chegada_em <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND (p_setor IS NULL OR e.setor_id = p_setor)
     AND (p_cor IS NULL OR ult.cor = p_cor)
     AND (p_publico IS NULL OR ult.publico = p_publico)
     AND (p_medico IS NULL OR e.atendimento_medico_id = p_medico)
     AND (p_turno IS NULL OR p_turno = CASE
            WHEN (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time <  time '13:00' THEN 'manha'
            WHEN (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '13:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time <  time '19:00' THEN 'tarde'
            ELSE 'noite' END);
END $$;
REVOKE ALL ON FUNCTION private.episodios_filtrados(uuid, date, date, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.episodios_filtrados(uuid, date, date, uuid, text, text, text, uuid) TO authenticated;

-- opções da barra: setores de entrada e médicos que atenderam no período
CREATE OR REPLACE FUNCTION public.opcoes_filtros_bi(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: filtros do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de OR p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  RETURN jsonb_build_object(
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) ORDER BY s.ordem, s.nome)
        FROM public.setores s
       WHERE s.unidade_id = p_unidade AND s.ativo
         AND EXISTS (SELECT 1 FROM public.episodios e WHERE e.setor_id = s.id)), '[]'::jsonb),
    'medicos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) ORDER BY m.nome)
        FROM (SELECT DISTINCT p.id, p.nome_completo AS nome
                FROM public.episodios e JOIN public.perfis p ON p.id = e.atendimento_medico_id
               WHERE e.id IN (SELECT private.episodios_filtrados(p_unidade, p_de, p_ate))) m), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.opcoes_filtros_bi(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opcoes_filtros_bi(uuid, date, date) TO authenticated;

-- ── os quatro indicadores com os filtros ───────────────────────────────────
DROP FUNCTION IF EXISTS public.indicador_espera_triagem(uuid, date, date);
CREATE OR REPLACE FUNCTION public.indicador_espera_triagem(
  p_unidade uuid, p_de date, p_ate date,
  p_setor uuid DEFAULT NULL, p_cor text DEFAULT NULL, p_turno text DEFAULT NULL,
  p_publico text DEFAULT NULL, p_medico uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_alvo int;
  v_res  jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  v_alvo := private.config_unidade_int(p_unidade, 'alvo_triagem_min', 10, 1, 240);

  WITH ep AS (
    SELECT e.id, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia, e.chegada_em,
           (SELECT min(c.criado_em) FROM public.classificacoes_risco c
             WHERE c.episodio_id = e.id AND NOT c.reclassificacao) AS triado_em,
           (SELECT min(ch.criado_em) FROM public.chamadas ch
             WHERE ch.episodio_id = e.id AND ch.etapa = 'triagem') AS chamado_em
      FROM public.episodios e
     WHERE e.id IN (SELECT private.episodios_filtrados(p_unidade, p_de, p_ate, p_setor, p_cor, p_turno, p_publico, p_medico))
  ), t AS (
    SELECT ep.*,
           extract(epoch FROM ep.triado_em - ep.chegada_em) / 60.0 AS min_triagem,
           extract(epoch FROM ep.chamado_em - ep.chegada_em) / 60.0 AS min_chamada
      FROM ep
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'alvo_min', v_alvo,
    'chegadas', count(*),
    'triados', count(*) FILTER (WHERE min_triagem IS NOT NULL),
    'sem_triagem', count(*) FILTER (WHERE min_triagem IS NULL),
    'media_min', round(avg(min_triagem)::numeric, 1),
    'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY min_triagem))::numeric, 1),
    'p90_min', round((percentile_cont(0.9) WITHIN GROUP (ORDER BY min_triagem))::numeric, 1),
    'fora_alvo', count(*) FILTER (WHERE min_triagem > v_alvo),
    'chamada', jsonb_build_object(
      'chamados', count(*) FILTER (WHERE min_chamada IS NOT NULL),
      'media_min', round(avg(min_chamada)::numeric, 1),
      'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY min_chamada))::numeric, 1)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dia', d.dia, 'chegadas', d.chegadas, 'triados', d.triados,
               'media_min', d.media, 'mediana_min', d.mediana, 'fora_alvo', d.fora,
               'chamada_mediana_min', d.ch_mediana) ORDER BY d.dia)
        FROM (SELECT t2.dia, count(*) AS chegadas, count(t2.min_triagem) AS triados,
                     round(avg(t2.min_triagem)::numeric, 1) AS media,
                     round((percentile_cont(0.5) WITHIN GROUP (ORDER BY t2.min_triagem))::numeric, 1) AS mediana,
                     count(*) FILTER (WHERE t2.min_triagem > v_alvo) AS fora,
                     round((percentile_cont(0.5) WITHIN GROUP (ORDER BY t2.min_chamada))::numeric, 1) AS ch_mediana
                FROM t t2 GROUP BY t2.dia) d), '[]'::jsonb))
    INTO v_res
    FROM t;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_espera_triagem(uuid, date, date, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_espera_triagem(uuid, date, date, uuid, text, text, text, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.indicador_espera_medico(uuid, date, date);
CREATE OR REPLACE FUNCTION public.indicador_espera_medico(
  p_unidade uuid, p_de date, p_ate date,
  p_setor uuid DEFAULT NULL, p_cor text DEFAULT NULL, p_turno text DEFAULT NULL,
  p_publico text DEFAULT NULL, p_medico uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tempos jsonb;
  v_res    jsonb;
  v_ator   uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  v_tempos := private.tempos_alvo_unidade(p_unidade);

  WITH ep AS (
    SELECT e.id, pa.nome, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia, e.chegada_em,
           e.atendimento_iniciado_em AS atendido_em, e.encerrado_em, e.desfecho,
           (SELECT min(c.criado_em) FROM public.classificacoes_risco c
             WHERE c.episodio_id = e.id AND NOT c.reclassificacao) AS classificado_em
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
     WHERE e.id IN (SELECT private.episodios_filtrados(p_unidade, p_de, p_ate, p_setor, p_cor, p_turno, p_publico, p_medico))
  ), t AS (
    SELECT ep.*,
           -- cor da classificação mais recente antes do médico (ou até agora)
           (SELECT c.cor FROM public.classificacoes_risco c
             WHERE c.episodio_id = ep.id AND c.criado_em <= coalesce(ep.atendido_em, now())
             ORDER BY c.criado_em DESC LIMIT 1) AS cor,
           extract(epoch FROM ep.atendido_em - ep.classificado_em) / 60.0 AS espera,
           -- sem médico: a espera vai até o encerramento (evasão…) ou até agora
           extract(epoch FROM coalesce(ep.atendido_em, ep.encerrado_em, now()) - ep.classificado_em) / 60.0 AS espera_ate_fim
      FROM ep
     WHERE ep.classificado_em IS NOT NULL
  ), m AS (
    SELECT t.*, (v_tempos ->> t.cor)::int AS alvo,
           -- em minutos inteiros: alvo imediato (0) só atrasa a partir de 1 min completo
           floor(t.espera_ate_fim) > coalesce((v_tempos ->> t.cor)::int, 1e9) AS atrasou
      FROM t
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'alvos', v_tempos,
    'classificados', count(*),
    'atendidos', count(*) FILTER (WHERE espera IS NOT NULL),
    'sem_medico', count(*) FILTER (WHERE espera IS NULL),
    'media_min', round(avg(espera)::numeric, 1),
    'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY espera))::numeric, 1),
    'fora_alvo', count(*) FILTER (WHERE atrasou),
    'por_cor', (SELECT jsonb_object_agg(c.cor, jsonb_build_object(
                  'alvo_min', (v_tempos ->> c.cor)::int,
                  'atendidos', (SELECT count(*) FROM m x WHERE x.cor = c.cor AND x.espera IS NOT NULL),
                  'mediana_min', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY x.espera))::numeric, 1) FROM m x WHERE x.cor = c.cor),
                  'media_min', (SELECT round(avg(x.espera)::numeric, 1) FROM m x WHERE x.cor = c.cor),
                  'fora_alvo', (SELECT count(*) FROM m x WHERE x.cor = c.cor AND x.atrasou),
                  'sem_medico', (SELECT count(*) FROM m x WHERE x.cor = c.cor AND x.espera IS NULL)))
                 FROM unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul']) AS c(cor)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', d.dia, 'atendidos', d.atendidos, 'mediana_min', d.mediana,
                                          'media_min', d.media, 'fora_alvo', d.fora) ORDER BY d.dia)
        FROM (SELECT x.dia, count(x.espera) AS atendidos,
                     round((percentile_cont(0.5) WITHIN GROUP (ORDER BY x.espera))::numeric, 1) AS mediana,
                     round(avg(x.espera)::numeric, 1) AS media,
                     count(*) FILTER (WHERE x.atrasou) AS fora
                FROM m x GROUP BY x.dia) d), '[]'::jsonb),
    'atrasados', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'nome', a.nome, 'cor', a.cor, 'chegada_em', a.chegada_em, 'classificado_em', a.classificado_em,
               'atendido_em', a.atendido_em, 'espera_min', floor(a.espera_ate_fim)::int, 'alvo_min', a.alvo,
               'sem_medico', a.espera IS NULL, 'desfecho', a.desfecho)
             ORDER BY a.espera_ate_fim - coalesce(a.alvo, 0) DESC)
        FROM (SELECT * FROM m WHERE atrasou ORDER BY espera_ate_fim - coalesce(alvo, 0) DESC LIMIT 200) a), '[]'::jsonb))
    INTO v_res
    FROM m;

  -- nome de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_res -> 'atrasados') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_atrasos_medico'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_atrasos_medico', 'episodios', NULL, p_unidade,
      jsonb_build_object('de', p_de, 'ate', p_ate, 'pacientes', jsonb_array_length(v_res -> 'atrasados')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_espera_medico(uuid, date, date, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_espera_medico(uuid, date, date, uuid, text, text, text, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.indicador_evasao(uuid, date, date);
CREATE OR REPLACE FUNCTION public.indicador_evasao(
  p_unidade uuid, p_de date, p_ate date,
  p_setor uuid DEFAULT NULL, p_cor text DEFAULT NULL, p_turno text DEFAULT NULL,
  p_publico text DEFAULT NULL, p_medico uuid DEFAULT NULL)
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
     WHERE e.id IN (SELECT private.episodios_filtrados(p_unidade, p_de, p_ate, p_setor, p_cor, p_turno, p_publico, p_medico))
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
REVOKE ALL ON FUNCTION public.indicador_evasao(uuid, date, date, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_evasao(uuid, date, date, uuid, text, text, text, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.pacientes_por_cor(uuid, date, date, uuid, text, text);
CREATE OR REPLACE FUNCTION public.pacientes_por_cor(
  p_unidade uuid, p_de date, p_ate date,
  p_setor uuid DEFAULT NULL, p_cor text DEFAULT NULL, p_turno text DEFAULT NULL,
  p_publico text DEFAULT NULL, p_medico uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_res jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  IF p_publico IS NOT NULL AND p_publico NOT IN ('adulto', 'pediatrico') THEN RAISE EXCEPTION 'Grupo inválido.'; END IF;
  IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;

  WITH ep AS (
    SELECT e.id, e.setor_id, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo') AS local,
           (SELECT c.cor FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em ASC LIMIT 1) AS cor_entrada,
           (SELECT c.cor FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) AS cor_final,
           (SELECT c.publico FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) AS publico,
           EXISTS (SELECT 1 FROM public.classificacoes_risco c WHERE c.episodio_id = e.id AND c.reclassificacao) AS reclassificado
      FROM public.episodios e
     WHERE e.id IN (SELECT private.episodios_filtrados(p_unidade, p_de, p_ate, p_setor, p_cor, p_turno, p_publico, p_medico))
  ), f AS (
    SELECT ep.*, ep.local::date AS dia,
           CASE WHEN ep.local::time >= time '07:00' AND ep.local::time < time '13:00' THEN 'manha'
                WHEN ep.local::time >= time '13:00' AND ep.local::time < time '19:00' THEN 'tarde'
                ELSE 'noite' END AS turno,
           -- gravidade: vermelho 5 … azul 1
           array_position(ARRAY['azul', 'verde', 'amarelo', 'laranja', 'vermelho'], ep.cor_entrada) AS g_entrada,
           array_position(ARRAY['azul', 'verde', 'amarelo', 'laranja', 'vermelho'], ep.cor_final) AS g_final
      FROM ep
  ), s AS (
    SELECT * FROM f
     WHERE (p_turno IS NULL OR f.turno = p_turno)
       AND (p_publico IS NULL OR f.publico = p_publico)
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor', p_setor, 'publico', p_publico, 'turno', p_turno,
    'total', count(*),
    'por_cor', jsonb_build_object(
      'vermelho', count(*) FILTER (WHERE cor_final = 'vermelho'),
      'laranja',  count(*) FILTER (WHERE cor_final = 'laranja'),
      'amarelo',  count(*) FILTER (WHERE cor_final = 'amarelo'),
      'verde',    count(*) FILTER (WHERE cor_final = 'verde'),
      'azul',     count(*) FILTER (WHERE cor_final = 'azul'),
      'sem_classificacao', count(*) FILTER (WHERE cor_final IS NULL)),
    'reclassificados', jsonb_build_object(
      'total',   count(*) FILTER (WHERE reclassificado),
      'subiram', count(*) FILTER (WHERE reclassificado AND g_final > g_entrada),
      'baixaram', count(*) FILTER (WHERE reclassificado AND g_final < g_entrada)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dia', d.dia, 'total', d.total, 'vermelho', d.vm, 'laranja', d.la, 'amarelo', d.am,
               'verde', d.ve, 'azul', d.az, 'sem_classificacao', d.sem) ORDER BY d.dia)
        FROM (SELECT x.dia, count(*) AS total,
                     count(*) FILTER (WHERE x.cor_final = 'vermelho') AS vm,
                     count(*) FILTER (WHERE x.cor_final = 'laranja') AS la,
                     count(*) FILTER (WHERE x.cor_final = 'amarelo') AS am,
                     count(*) FILTER (WHERE x.cor_final = 'verde') AS ve,
                     count(*) FILTER (WHERE x.cor_final = 'azul') AS az,
                     count(*) FILTER (WHERE x.cor_final IS NULL) AS sem
                FROM s x GROUP BY x.dia) d), '[]'::jsonb),
    -- setores de entrada da unidade, para o filtro
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', st.id, 'nome', st.nome) ORDER BY st.ordem, st.nome)
        FROM public.setores st
       WHERE st.unidade_id = p_unidade AND st.ativo
         AND EXISTS (SELECT 1 FROM public.episodios e2 WHERE e2.setor_id = st.id)), '[]'::jsonb))
    INTO v_res
    FROM s;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.pacientes_por_cor(uuid, date, date, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pacientes_por_cor(uuid, date, date, uuid, text, text, text, uuid) TO authenticated;
