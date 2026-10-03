-- ════════════════════════════════════════════════════════════════════════════
-- Maestro: POR QUE o gateway bloqueou — só por TIPO, nunca texto
-- (decisão do RT 03/10/2026).
--
-- 1. ia_gateway_log.tipos_bloqueio (jsonb, opcional): mapa tipo → quantidade
--    que o gateway (hermes/src/gateway/gateway.ts, registrar) grava quando
--    levanta ChamadaBloqueada (regex de resíduo ou NER achou nome). As chaves
--    são os Residuo.tipo fixos do sistema ('sequência de 11 dígitos',
--    'sequência de 15 dígitos', 'data completa', 'e-mail', 'nome próprio (NER)');
--    o trecho NUNCA é gravado. CHECK: objeto com valores numéricos ≥ 0.
-- 2. hermes_maestro_totais() ganha, por linha do gateway, 'tipos_bloqueio':
--    soma por chave NORMALIZADA numa lista fixa {nome_ner, data_completa,
--    digitos_11, digitos_15, email, outro}. Qualquer chave fora da lista vira
--    'outro' — a chave crua nunca sai. Resto da função igual à 20261022000008.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ia_gateway_log ADD COLUMN IF NOT EXISTS tipos_bloqueio jsonb;

ALTER TABLE public.ia_gateway_log DROP CONSTRAINT IF EXISTS ia_gateway_log_tipos_bloqueio_objeto;
ALTER TABLE public.ia_gateway_log ADD CONSTRAINT ia_gateway_log_tipos_bloqueio_objeto CHECK (
  tipos_bloqueio IS NULL
  OR (jsonb_typeof(tipos_bloqueio) = 'object'
      AND NOT jsonb_path_exists(tipos_bloqueio, '$.* ? (@.type() != "number" || @ < 0)'))
);

COMMENT ON COLUMN public.ia_gateway_log.tipos_bloqueio IS
  'Por que bloqueou: tipo do resíduo → quantidade (só o tipo fixo do sistema, nunca o trecho). NULL quando não houve bloqueio por resíduo/NER.';

CREATE OR REPLACE FUNCTION public.hermes_maestro_totais()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH janela AS (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date - 6 AS desde,
           (now() AT TIME ZONE 'America/Sao_Paulo')::date     AS ate
  ), gw AS (
    SELECT (g.criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           CASE WHEN g.origem ~ '^[a-z0-9_]{1,32}:[a-z0-9_]{1,32}$' THEN g.origem ELSE 'outra' END AS origem,
           g.bloqueado,
           g.residuos,
           g.tipos_bloqueio,
           g.erro IS NOT NULL AS com_erro,
           CASE
             WHEN g.erro IS NULL OR NOT g.bloqueado THEN NULL
             WHEN substring(g.erro FROM '^gateway: desidentificação indisponível \(([a-z_]+)')
                  IN ('sem_configuracao', 'timeout', 'rede', 'http', 'resposta_invalida', 'ner_inativo')
               THEN substring(g.erro FROM '^gateway: desidentificação indisponível \(([a-z_]+)')
             ELSE 'outro'
           END AS motivo
      FROM public.ia_gateway_log g, janela j
     WHERE g.criado_em >= (j.desde::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), gw_dia AS (
    SELECT dia, origem,
           count(*)                                     AS chamadas,
           count(*) FILTER (WHERE bloqueado)            AS bloqueados,
           count(*) FILTER (WHERE com_erro)             AS com_erro,
           count(*) FILTER (WHERE com_erro AND bloqueado)     AS erros_desidentificacao,
           count(*) FILTER (WHERE com_erro AND NOT bloqueado) AS erros_modelo,
           coalesce(sum(residuos), 0)                   AS residuos
      FROM gw GROUP BY dia, origem
  ), gw_motivo AS (
    SELECT dia, origem, jsonb_object_agg(motivo, n) AS motivos
      FROM (SELECT dia, origem, motivo, count(*) AS n FROM gw WHERE motivo IS NOT NULL GROUP BY 1, 2, 3) m
     GROUP BY dia, origem
  ), gw_tipo AS (
    -- Chave normalizada para uma lista FIXA; o texto cru da chave nunca sai.
    SELECT dia, origem, jsonb_object_agg(chave, n) AS tipos
      FROM (SELECT gw.dia, gw.origem,
                   CASE e.key
                     WHEN 'nome próprio (NER)'      THEN 'nome_ner'
                     WHEN 'data completa'           THEN 'data_completa'
                     WHEN 'sequência de 11 dígitos' THEN 'digitos_11'
                     WHEN 'sequência de 15 dígitos' THEN 'digitos_15'
                     WHEN 'e-mail'                  THEN 'email'
                     ELSE 'outro'
                   END AS chave,
                   sum(greatest(floor((e.value #>> '{}')::numeric), 0))::bigint AS n
              FROM gw, jsonb_each(gw.tipos_bloqueio) e
             WHERE gw.tipos_bloqueio IS NOT NULL AND jsonb_typeof(gw.tipos_bloqueio) = 'object'
               AND jsonb_typeof(e.value) = 'number'
             GROUP BY 1, 2, 3) t
     GROUP BY dia, origem
  ), inc AS (
    SELECT i.patrulha, i.severidade, i.status, count(*) AS total
      FROM public.cerbero_incidentes i, janela j
     WHERE i.detectado_em >= (j.desde::timestamp AT TIME ZONE 'America/Sao_Paulo')
     GROUP BY 1, 2, 3
  ), alr AS (
    SELECT a.status,
           count(*) AS total,
           count(*) FILTER (WHERE a.criado_em >= (j.desde::timestamp AT TIME ZONE 'America/Sao_Paulo')) AS criados_na_janela
      FROM public.chronos_alertas_escala a, janela j
     GROUP BY a.status
  ), ntf AS (
    SELECT (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           CASE WHEN n.tipo ~ '^[a-z0-9_]{1,48}$' THEN n.tipo ELSE 'outro' END AS tipo,
           count(*) AS total
      FROM public.notificacoes_plantonista n, janela j
     WHERE n.created_at >= (j.desde::timestamp AT TIME ZONE 'America/Sao_Paulo')
     GROUP BY 1, 2
  )
  SELECT jsonb_build_object(
    'janela_dias', 7,
    'desde', (SELECT desde FROM janela),
    'ate', (SELECT ate FROM janela),
    'gateway', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dia', d.dia, 'origem', d.origem, 'total', d.chamadas, 'bloqueados', d.bloqueados,
               'com_erro', d.com_erro, 'erros_desidentificacao', d.erros_desidentificacao,
               'erros_modelo', d.erros_modelo, 'residuos', d.residuos,
               'motivos_desidentificacao', coalesce(m.motivos, '{}'::jsonb),
               'tipos_bloqueio', coalesce(t.tipos, '{}'::jsonb))
             ORDER BY d.dia, d.origem)
        FROM gw_dia d LEFT JOIN gw_motivo m USING (dia, origem)
                      LEFT JOIN gw_tipo t USING (dia, origem)), '[]'::jsonb),
    'incidentes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('patrulha', patrulha, 'severidade', severidade, 'status', status, 'total', total)
             ORDER BY patrulha, severidade, status) FROM inc), '[]'::jsonb),
    'alertas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', status, 'total', total, 'criados_na_janela', criados_na_janela)
             ORDER BY status) FROM alr), '[]'::jsonb),
    'notificacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', dia, 'tipo', tipo, 'total', total) ORDER BY dia, tipo) FROM ntf),
      '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.hermes_maestro_totais() IS
  'Maestro (Coruja Lab): totais agregados dos últimos 7 dias de Brasília (gateway de IA por origem, com tipos de bloqueio normalizados, incidentes, alertas do Sentinela, notificações). Só contagens, sem pessoa nem texto livre. Só hermes_job/service_role.';

REVOKE ALL ON FUNCTION public.hermes_maestro_totais() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_maestro_totais() TO hermes_job;
GRANT EXECUTE ON FUNCTION public.hermes_maestro_totais() TO service_role;
