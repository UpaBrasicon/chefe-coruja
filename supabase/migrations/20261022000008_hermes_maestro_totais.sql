-- ════════════════════════════════════════════════════════════════════════════
-- Maestro (Coruja Lab) — totais agregados dos agentes, decisão do RT 03/10/2026.
--
-- O Lab vira o "maestro" que acompanha Corujinha, Gestora, Clínica e Suporte,
-- mas NÃO tem acesso ao banco: os números chegam a ele num arquivo JSON que o
-- script maestro_numeros.py (cron do Nous, sem IA, papel hermes_app_job) monta
-- com esta função. Por isso aqui só saem CONTAGENS, nunca:
--   • perfil_id, nome, e-mail, id de pessoa ou de paciente;
--   • hash_entrada, título/evidência/diagnóstico de incidente, detalhe de
--     alerta, mensagem de notificação ou qualquer texto livre.
--
-- ia_gateway_log.erro NÃO é agrupado pelo texto: no gateway (hermes/src/gateway/
-- gateway.ts, registrar) ele recebe a mensagem de erro do provedor de IA, que é
-- texto livre. Só a falha de desidentificação tem mensagem fixa do sistema
-- ("gateway: desidentificação indisponível (<motivo>…)"); dela sai apenas o
-- motivo, conferido contra a lista fixa de MotivoIndisponivel. O resto vira
-- só contagem (erros_modelo). origem e tipo de notificação também passam por
-- um formato fixo; fora dele viram 'outra'/'outro'.
--
-- Janela: os últimos 7 dias civis de Brasília (hoje incluído).
-- Só hermes_job (e service_role) executa.
-- ════════════════════════════════════════════════════════════════════════════

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
               'motivos_desidentificacao', coalesce(m.motivos, '{}'::jsonb))
             ORDER BY d.dia, d.origem)
        FROM gw_dia d LEFT JOIN gw_motivo m USING (dia, origem)), '[]'::jsonb),
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
  'Maestro (Coruja Lab): totais agregados dos últimos 7 dias de Brasília (gateway de IA por origem, incidentes, alertas do Sentinela, notificações). Só contagens, sem pessoa nem texto livre. Só hermes_job/service_role.';

REVOKE ALL ON FUNCTION public.hermes_maestro_totais() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_maestro_totais() TO hermes_job;
GRANT EXECUTE ON FUNCTION public.hermes_maestro_totais() TO service_role;
