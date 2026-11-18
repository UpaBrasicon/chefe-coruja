-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U13, PR 2 (plano em docs/ubs/U13-PLANO.md; U13 = A): gestão
-- ambulatorial da UBS, com as seis frentes do diagnóstico, por período.
--
-- public.gestao_ubs(unidade, de, ate) devolve:
-- - producao: atendimentos de médico e enfermeiro encerrados no período, por
--   tipo de atendimento, por profissional, por turno e por faixa etária; escutas
--   por cor; consultas de gestante (pré-natal), de criança até 2 anos, de
--   hipertensos e de diabéticos;
-- - agenda: consultas marcadas por situação e por profissional, comparecimento;
-- - espera: da chegada à escuta e até o início da consulta (média e mediana em
--   minutos); quem não aguardou e fichas vencidas;
-- - medicamentos: dispensações (itens e pacientes), os 10 mais dispensados,
--   retiradas sem farmacêutico, estoque crítico e em falta, administrações
--   registradas na UBS;
-- - rede: envios à UPA por situação e retornos recebidos;
-- - vigilancia: notificações compulsórias pendentes.
-- Médico e enfermeiro pelo papel na unidade (G2 = A, private.aps_atendeu).
--
-- Idempotente. Teste: supabase/tests/ubs_u13_gestao_ambulatorial.sql
-- Rollback: DROP FUNCTION public.gestao_ubs(uuid, date, date);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.gestao_ubs(p_unidade uuid, p_de date DEFAULT NULL, p_ate date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ate date := coalesce(p_ate, private.data_atual());
  v_de date := coalesce(p_de, coalesce(p_ate, private.data_atual()) - 29);
  v_ini timestamptz; v_fim timestamptz;
  v_prod jsonb; v_agenda jsonb; v_espera jsonb; v_med jsonb; v_rede jsonb; v_vig jsonb;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.sou_gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'A gestão da UBS é vista pelo gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'A gestão ambulatorial é da UBS.';
  END IF;
  IF v_de > v_ate OR v_ate - v_de > 366 THEN RAISE EXCEPTION 'Período: de até um ano, com o início antes do fim.'; END IF;
  v_ini := v_de::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- ── produção ─────────────────────────────────────────────────────────────
  WITH at AS (
    SELECT e.*, coalesce(e.desfecho_por, e.encerrado_por) AS quem,
           date_part('year', age((e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date, pa.data_nascimento))::int AS idade,
           extract(hour FROM e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::int AS hora
      FROM public.episodios e JOIN public.pacientes pa ON pa.id = e.paciente_id
     WHERE e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL AND e.etapa = 'encerrado'
       AND e.encerrado_em >= v_ini AND e.encerrado_em < v_fim
       AND private.aps_atendeu(coalesce(e.desfecho_por, e.encerrado_por), p_unidade))
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM at),
    'por_tipo', coalesce((SELECT jsonb_object_agg(tipo_atendimento_aps, n) FROM (SELECT tipo_atendimento_aps, count(*) n FROM at GROUP BY 1) x), '{}'::jsonb),
    'por_turno', jsonb_build_object('manha', (SELECT count(*) FROM at WHERE hora < 12),
                                    'tarde', (SELECT count(*) FROM at WHERE hora >= 12 AND hora < 18),
                                    'noite', (SELECT count(*) FROM at WHERE hora >= 18)),
    'por_faixa', jsonb_build_object('ate_1', (SELECT count(*) FROM at WHERE idade < 2), 'de_2_a_11', (SELECT count(*) FROM at WHERE idade BETWEEN 2 AND 11),
                                    'de_12_a_17', (SELECT count(*) FROM at WHERE idade BETWEEN 12 AND 17),
                                    'de_18_a_59', (SELECT count(*) FROM at WHERE idade BETWEEN 18 AND 59),
                                    'de_60_mais', (SELECT count(*) FROM at WHERE idade >= 60),
                                    'sem_idade', (SELECT count(*) FROM at WHERE idade IS NULL)),
    'por_profissional', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', p.nome_completo, 'n', x.n) ORDER BY x.n DESC)
                                    FROM (SELECT quem, count(*) n FROM at GROUP BY quem) x JOIN public.perfis p ON p.id = x.quem), '[]'::jsonb),
    'gestantes', (SELECT count(*) FROM at WHERE 'pre_natal' = ANY (coalesce(problemas_aps, '{}'))),
    'criancas_ate_2', (SELECT count(*) FROM at WHERE idade < 2),
    'hipertensos', (SELECT count(*) FROM at WHERE 'hipertensao' = ANY (private.hiperdia_programas_da_consulta(problemas_aps, cid_aps, ciap_aps))),
    'diabeticos', (SELECT count(*) FROM at WHERE 'diabetes' = ANY (private.hiperdia_programas_da_consulta(problemas_aps, cid_aps, ciap_aps))),
    'escutas_por_cor', coalesce((SELECT jsonb_object_agg(cor, n) FROM (
        SELECT c.cor, count(*) n FROM public.classificacoes_risco c JOIN public.episodios e ON e.id = c.episodio_id
         WHERE e.unidade_id = p_unidade AND c.protocolo = 'cab28' AND c.criado_em >= v_ini AND c.criado_em < v_fim GROUP BY c.cor) x), '{}'::jsonb))
    INTO v_prod;

  -- ── agenda ───────────────────────────────────────────────────────────────
  WITH ag AS (
    SELECT a.* FROM public.agendamentos a
     WHERE a.unidade_id = p_unidade AND a.tipo = 'consulta' AND a.inicio >= v_ini AND a.inicio < v_fim)
  SELECT jsonb_build_object(
    'por_situacao', coalesce((SELECT jsonb_object_agg(situacao, n) FROM (SELECT situacao, count(*) n FROM ag GROUP BY 1) x), '{}'::jsonb),
    'comparecimento', (SELECT CASE WHEN count(*) FILTER (WHERE situacao NOT IN ('cancelado', 'agendado')) > 0
                                   THEN round(100.0 * count(*) FILTER (WHERE situacao IN ('presente', 'realizado'))
                                              / count(*) FILTER (WHERE situacao NOT IN ('cancelado', 'agendado')), 1) END FROM ag),
    'por_profissional', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', p.nome_completo, 'marcadas', x.marcadas, 'faltas', x.faltas) ORDER BY x.marcadas DESC)
                                    FROM (SELECT perfil_id, count(*) FILTER (WHERE situacao <> 'cancelado') marcadas,
                                                 count(*) FILTER (WHERE situacao = 'nao_compareceu') faltas FROM ag GROUP BY perfil_id) x
                                    JOIN public.perfis p ON p.id = x.perfil_id), '[]'::jsonb))
    INTO v_agenda;

  -- ── espera ───────────────────────────────────────────────────────────────
  WITH ep AS (
    SELECT e.* FROM public.episodios e
     WHERE e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL AND e.chegada_em >= v_ini AND e.chegada_em < v_fim),
  t AS (
    SELECT extract(epoch FROM (e.classificado_em - e.chegada_em)) / 60 AS ate_escuta,
           extract(epoch FROM (e.atendimento_iniciado_em - coalesce(e.classificado_em, e.chegada_em))) / 60 AS ate_consulta
      FROM ep e)
  SELECT jsonb_build_object(
    'escuta_media_min', (SELECT round(avg(ate_escuta)::numeric) FROM t WHERE ate_escuta >= 0),
    'escuta_mediana_min', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ate_escuta))::numeric) FROM t WHERE ate_escuta >= 0),
    'consulta_media_min', (SELECT round(avg(ate_consulta)::numeric) FROM t WHERE ate_consulta >= 0),
    'consulta_mediana_min', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ate_consulta))::numeric) FROM t WHERE ate_consulta >= 0),
    'nao_aguardou', (SELECT count(*) FROM ep WHERE desfecho = 'evasao' AND coalesce((desfecho_detalhes ->> 'vencida')::boolean, false) IS FALSE),
    'fichas_vencidas', (SELECT count(*) FROM ep WHERE coalesce((desfecho_detalhes ->> 'vencida')::boolean, false)))
    INTO v_espera;

  -- ── medicamentos ─────────────────────────────────────────────────────────
  WITH d AS (
    SELECT x.* FROM public.dispensacoes x WHERE x.unidade_id = p_unidade AND x.dispensada_em >= v_ini AND x.dispensada_em < v_fim)
  SELECT jsonb_build_object(
    'itens', (SELECT count(*) FROM d),
    'pacientes', (SELECT count(DISTINCT paciente_id) FROM d),
    'sem_farmaceutico', (SELECT count(*) FROM d WHERE sem_farmaceutico),
    'mais_dispensados', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', coalesce(m.principio_ativo, '?'), 'quantidade', x.q) ORDER BY x.q DESC)
                                   FROM (SELECT medicamento_id, sum(quantidade) q FROM d GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x
                                   LEFT JOIN public.medicamento m ON m.id = x.medicamento_id), '[]'::jsonb),
    'estoque_critico', (SELECT count(*) FROM public.estoque_medicamento em WHERE em.unidade_id = p_unidade
                          AND em.limite_critico IS NOT NULL AND em.quantidade <= em.limite_critico),
    'estoque_falta', (SELECT count(*) FROM public.estoque_medicamento em WHERE em.unidade_id = p_unidade
                        AND em.limite_falta IS NOT NULL AND em.quantidade <= em.limite_falta),
    'administracoes', (SELECT count(*) FROM public.procedimentos_realizados pr
                        WHERE pr.unidade_id = p_unidade AND pr.cancelado_em IS NULL AND pr.realizado_em >= v_ini AND pr.realizado_em < v_fim
                          AND pr.procedimento IN ('0301100209', '0301100225', '0301100217', '0301100233')))
    INTO v_med;

  -- ── rede ─────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'envios_upa', coalesce((SELECT jsonb_object_agg(situacao, n) FROM (
        SELECT situacao, count(*) n FROM public.encaminhamentos_upa
         WHERE unidade_origem_id = p_unidade AND enviado_em >= v_ini AND enviado_em < v_fim GROUP BY 1) x), '{}'::jsonb),
    'retornos', (SELECT count(*) FROM public.contrarreferencias WHERE unidade_ubs_id = p_unidade AND situacao <> 'cancelada'
                  AND saida_em >= v_ini AND saida_em < v_fim),
    'retornos_a_ver', (SELECT count(*) FROM public.contrarreferencias WHERE unidade_ubs_id = p_unidade AND situacao = 'a_ver'))
    INTO v_rede;

  -- ── vigilância ───────────────────────────────────────────────────────────
  SELECT jsonb_build_object('pendentes', count(*) FILTER (WHERE x.situacao IN ('sugerido', 'a_registrar', 'reaberto')), 'total', count(*))
    INTO v_vig
    FROM public.notificacao_compulsoria_periodo(p_unidade, v_de, v_ate, NULL) x;

  RETURN jsonb_build_object('de', v_de, 'ate', v_ate, 'producao', v_prod, 'agenda', v_agenda, 'espera', v_espera,
                            'medicamentos', v_med, 'rede', v_rede, 'vigilancia', v_vig);
END $$;
REVOKE ALL ON FUNCTION public.gestao_ubs(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestao_ubs(uuid, date, date) TO authenticated;
