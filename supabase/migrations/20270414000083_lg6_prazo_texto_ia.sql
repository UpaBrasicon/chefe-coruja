-- ════════════════════════════════════════════════════════════════════════════
-- LG6, decisão I3 = A do RT (17/11/2026,
-- docs/regulatorio/LG6-IA-DADO-SAUDE-DIAGNOSTICO.md): o texto escrito para a
-- IA não fica guardado sem prazo. Depois de 30 dias:
--   * hermes_sessions.messages (WhatsApp, texto cru) fica vazio;
--   * hermes_audit_log.tool_result_summary vira 'sha256:<hash>' (o Hermes já
--     grava só o resumo com hash nas linhas novas);
--   * clinical_search_logs.query_redacted vira '[apagada após 30 dias]'; os
--     números (modelo, tokens, latência) ficam para o custo do mês;
--   * clinical_search_feedback.comentario fica nulo (útil sim/não fica).
-- Roda todo dia às 03:30 de Brasília (06:30 UTC) pelo pg_cron.
--
-- Expand: cria uma função e um agendamento; não muda coluna.
-- Volta: SELECT cron.unschedule('lg6-texto-ia-30-dias');
--        DROP FUNCTION IF EXISTS private.apagar_texto_ia_vencido(int);
--   (o texto já apagado não volta: é o efeito pretendido.)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.apagar_texto_ia_vencido(p_dias int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_corte timestamptz := now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));
  n_sessoes int; n_auditoria int; n_perguntas int; n_comentarios int;
BEGIN
  UPDATE public.hermes_sessions SET messages = '[]'::jsonb
   WHERE updated_at < v_corte AND messages <> '[]'::jsonb;
  GET DIAGNOSTICS n_sessoes = ROW_COUNT;

  UPDATE public.hermes_audit_log
     SET tool_result_summary = 'sha256:' || encode(pg_catalog.sha256(convert_to(tool_result_summary, 'UTF8')), 'hex')
   WHERE created_at < v_corte AND coalesce(tool_result_summary, '') <> ''
     AND tool_result_summary NOT LIKE 'sha256:%';
  GET DIAGNOSTICS n_auditoria = ROW_COUNT;

  UPDATE public.clinical_search_logs SET query_redacted = '[apagada após 30 dias]'
   WHERE created_at < v_corte AND query_redacted NOT IN ('[não enviada]', '[apagada após 30 dias]');
  GET DIAGNOSTICS n_perguntas = ROW_COUNT;

  UPDATE public.clinical_search_feedback SET comentario = NULL
   WHERE created_at < v_corte AND comentario IS NOT NULL;
  GET DIAGNOSTICS n_comentarios = ROW_COUNT;

  RETURN jsonb_build_object('sessoes', n_sessoes, 'auditoria', n_auditoria,
                            'perguntas', n_perguntas, 'comentarios', n_comentarios);
END $$;

REVOKE ALL ON FUNCTION private.apagar_texto_ia_vencido(int) FROM PUBLIC, anon, authenticated;

-- idempotente: o pg_cron atualiza o agendamento de mesmo nome
SELECT cron.schedule('lg6-texto-ia-30-dias', '30 6 * * *', 'SELECT private.apagar_texto_ia_vencido(30);');
