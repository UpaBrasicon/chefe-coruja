-- Grade de ações do gestor (P1, pedido do RT em 21/10/2026; diagnóstico em
-- docs/gestor/GRADE-ACOES-DIAGNOSTICO.md, decisões D1–D5 aceitas pelo RT em 27/10/2026).
--
-- Uma linha por paciente da porta (triagem e atendimento) com a hora de cada
-- etapa: classificação, chamada, atendimento, exames, medicação, reavaliação e
-- desfecho, e se ela está feita, pendente ou atrasada. Só leitura; nenhuma
-- tabela nova. Molde: porta_agora (segundo fator, só o gestor, trilha a cada 15 min).
--
-- Atraso só onde há alvo:
--   * chamada, atendimento e "No PS" antes do médico: o alvo da cor da unidade
--     (private.tempos_alvo_unidade), contado desde a 1ª classificação, como em porta_agora;
--   * "No PS" depois do médico: alvo_permanencia_min da unidade (D3);
--   * classificação, exames e medicação: alvo_classificacao_min, alvo_exame_min e
--     alvo_medicacao_min da unidade (D4);
--   * reavaliação: a hora marcada pelo médico ("aguardar" com reavaliar_em).
--   Os alvos novos não têm valor padrão: sem a chave em configuracoes_unidade, nada fica atrasado.
--
-- Rollback: DROP FUNCTION IF EXISTS public.porta_grade(uuid);

CREATE OR REPLACE FUNCTION public.porta_grade(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_ator   uuid := private.meu_perfil_id();
  v_tempos jsonb;
  v_alvos  jsonb;
  v_lista  jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade vê a grade de ações.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_tempos := private.tempos_alvo_unidade(p_unidade);
  -- sem valor padrão (D3, D4): ausente, o alvo é nulo e a coluna nunca atrasa
  v_alvos := jsonb_build_object(
    'classificacao', private.config_unidade_int(p_unidade, 'alvo_classificacao_min', NULL, 1, 1440),
    'exame',         private.config_unidade_int(p_unidade, 'alvo_exame_min', NULL, 1, 1440),
    'medicacao',     private.config_unidade_int(p_unidade, 'alvo_medicacao_min', NULL, 1, 1440),
    'permanencia',   private.config_unidade_int(p_unidade, 'alvo_permanencia_min', NULL, 1, 1440));

  WITH base AS (
    SELECT e.id, e.etapa, e.cor_atual AS cor, e.chegada_em, e.atendimento_iniciado_em,
           e.desfecho, e.desfecho_em, pa.nome, s.nome AS setor, cl.em AS classificado_em,
           -- desde a 1ª classificação (decisão do RT, tarefa 4): a reclassificação não zera a espera
           coalesce(cl.em, e.classificado_em, e.chegada_em) AS espera_desde
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
      LEFT JOIN public.setores s ON s.id = e.setor_id
      LEFT JOIN LATERAL (
        SELECT coalesce(min(c.criado_em) FILTER (WHERE NOT c.reclassificacao), e.classificado_em) AS em
          FROM public.classificacoes_risco c WHERE c.episodio_id = e.id) cl ON true
     WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento')
  ), etapas AS (
    SELECT b.*,
           floor(extract(epoch FROM now() - b.chegada_em) / 60)::int AS no_ps_min,
           -- minutos inteiros, como porta_agora: o vermelho (alvo 0) atrasa com 1 min completo
           b.etapa = 'atendimento' AND b.atendimento_iniciado_em IS NULL AND b.cor IS NOT NULL AND v_tempos ? b.cor
             AND floor(extract(epoch FROM now() - b.espera_desde) / 60) > (v_tempos ->> b.cor)::int AS fora_alvo_medico,
           ch.vezes, ch.ultima_em,
           ex.total AS exames_total, ex.feitos AS exames_feitos, ex.pendente_desde AS exames_desde,
           md.pendentes AS med_pendentes, md.pendente_desde AS med_desde, md.ultima_em AS med_ultima_em,
           rv.feita_em AS reav_feita_em, rv.prevista_em AS reav_prevista_em
      FROM base b
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS vezes, max(c.criado_em) AS ultima_em
          FROM public.chamadas c WHERE c.episodio_id = b.id AND c.etapa = 'atendimento') ch ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE x.situacao = 'resultado')::int AS feitos,
               min(x.pedido_em) FILTER (WHERE x.situacao <> 'resultado') AS pendente_desde
          FROM public.exames_pedidos x WHERE x.episodio_id = b.id AND x.situacao <> 'cancelado') ex ON true
      LEFT JOIN LATERAL (
        -- pendente = a mesma regra de private.medicacao_sem_checagem (porta, medicamento,
        -- não suspenso, não "se necessário", sem administração feita)
        SELECT count(*) FILTER (WHERE NOT feito)::int AS pendentes,
               min(coalesce(pr_em, it_em)) FILTER (WHERE NOT feito) AS pendente_desde,
               max(feito_em) AS ultima_em
          FROM (
            SELECT pr.assinada_em AS pr_em, it.created_at AS it_em,
                   EXISTS (SELECT 1 FROM public.administracoes a WHERE a.item_id = it.id AND a.situacao = 'feito') AS feito,
                   (SELECT max(a.registrado_em) FROM public.administracoes a WHERE a.item_id = it.id AND a.situacao = 'feito') AS feito_em
              FROM public.prescricoes pr
              JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
             WHERE pr.episodio_id = b.id AND pr.internacao_id IS NULL
               AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL AND NOT it.se_necessario) i) md ON true
      LEFT JOIN LATERAL (
        -- reavaliação feita: a última do tipo reavaliacao; prevista: só se o último registro é um "aguardar"
        SELECT (SELECT max(r.criado_em) FROM public.atendimento_reavaliacoes r
                 WHERE r.episodio_id = b.id AND r.tipo = 'reavaliacao') AS feita_em,
               (SELECT CASE WHEN r.tipo = 'aguardar' THEN r.reavaliar_em END
                  FROM public.atendimento_reavaliacoes r WHERE r.episodio_id = b.id
                 ORDER BY r.criado_em DESC LIMIT 1) AS prevista_em) rv ON true
  ), marcadas AS (
    SELECT t.*,
           CASE WHEN t.atendimento_iniciado_em IS NULL THEN t.fora_alvo_medico
                ELSE (v_alvos ->> 'permanencia') IS NOT NULL AND t.no_ps_min > (v_alvos ->> 'permanencia')::int END AS no_ps_atrasado,
           t.etapa = 'triagem' AND (v_alvos ->> 'classificacao') IS NOT NULL
             AND t.no_ps_min > (v_alvos ->> 'classificacao')::int AS classificacao_atrasada,
           t.exames_desde IS NOT NULL AND (v_alvos ->> 'exame') IS NOT NULL
             AND floor(extract(epoch FROM now() - t.exames_desde) / 60) > (v_alvos ->> 'exame')::int AS exames_atrasados,
           t.med_desde IS NOT NULL AND (v_alvos ->> 'medicacao') IS NOT NULL
             AND floor(extract(epoch FROM now() - t.med_desde) / 60) > (v_alvos ->> 'medicacao')::int AS medicacao_atrasada,
           t.reav_prevista_em IS NOT NULL AND now() > t.reav_prevista_em AS reavaliacao_atrasada
      FROM etapas t
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'episodio_id', m.id, 'nome', m.nome, 'cor', m.cor, 'setor', m.setor, 'etapa', m.etapa,
           'chegada_em', m.chegada_em, 'no_ps_min', m.no_ps_min, 'no_ps_atrasado', m.no_ps_atrasado,
           'classificacao', jsonb_build_object('em', m.classificado_em, 'atrasada', m.classificacao_atrasada),
           'chamada', jsonb_build_object('em', m.ultima_em, 'vezes', m.vezes,
                        'atrasada', m.etapa = 'atendimento' AND m.vezes = 0 AND m.fora_alvo_medico),
           'atendimento', jsonb_build_object('em', m.atendimento_iniciado_em,
                        'atrasado', m.vezes > 0 AND m.fora_alvo_medico),
           'exames', jsonb_build_object('feitos', m.exames_feitos, 'total', m.exames_total,
                        'desde', m.exames_desde, 'atrasado', m.exames_atrasados),
           'medicacao', jsonb_build_object('ultima_em', m.med_ultima_em, 'pendentes', m.med_pendentes,
                        'desde', m.med_desde, 'atrasada', m.medicacao_atrasada),
           'reavaliacao', jsonb_build_object('feita_em', m.reav_feita_em, 'prevista_em', m.reav_prevista_em,
                        'atrasada', m.reavaliacao_atrasada),
           'desfecho', jsonb_build_object('tipo', m.desfecho, 'em', m.desfecho_em))
           -- quem passou do alvo primeiro; depois a cor mais grave; depois quem chegou antes
           ORDER BY m.no_ps_atrasado DESC,
                    array_position(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'], m.cor) NULLS LAST,
                    m.chegada_em), '[]'::jsonb)
    INTO v_lista
    FROM marcadas m;

  -- dado de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_lista) > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_porta_grade'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_porta_grade', 'episodios', NULL, p_unidade,
      jsonb_build_object('pacientes', jsonb_array_length(v_lista)));
  END IF;

  RETURN jsonb_build_object('gerado_em', now(), 'tempos', v_tempos, 'alvos', v_alvos, 'pacientes', v_lista);
END; $function$;

REVOKE ALL ON FUNCTION public.porta_grade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.porta_grade(uuid) TO authenticated;

COMMENT ON FUNCTION public.porta_grade(uuid) IS
  'Grade de ações do gestor: por paciente da porta, a hora e a situação de cada etapa. Só o gestor da unidade, com segundo fator; acesso auditado a cada 15 min.';
