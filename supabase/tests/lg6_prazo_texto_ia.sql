-- Testes da migration 20270414000083 (LG6, I3: texto para a IA com prazo de 30 dias). ROLLBACK no fim.
BEGIN;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;

CREATE TEMP TABLE ids ON COMMIT DROP AS
SELECT (SELECT id FROM public.perfis ORDER BY id LIMIT 1) AS perfil,
       (SELECT id FROM auth.users ORDER BY id LIMIT 1) AS usuario,
       (SELECT id FROM public.unidades ORDER BY id LIMIT 1) AS unidade;

INSERT INTO public.hermes_sessions (user_id, phone, messages, updated_at)
SELECT perfil, '5500000000001', '[{"role":"user","content":"texto velho"}]'::jsonb, now() - interval '31 days' FROM ids
UNION ALL
SELECT perfil, '5500000000002', '[{"role":"user","content":"texto novo"}]'::jsonb, now() - interval '2 days' FROM ids;

INSERT INTO public.hermes_audit_log (user_id, phone, direction, tool_result_summary, created_at)
SELECT perfil, '5500000000001', 'in', 'msg recebida: texto velho', now() - interval '31 days' FROM ids
UNION ALL
SELECT perfil, '5500000000002', 'in', 'msg recebida: texto novo', now() - interval '2 days' FROM ids;

INSERT INTO public.clinical_search_logs (request_id, user_id, unidade_id, mode, query_redacted, created_at)
SELECT 'lg6-velha', usuario, unidade, 'ask', 'pergunta velha', now() - interval '31 days' FROM ids
UNION ALL
SELECT 'lg6-nova', usuario, unidade, 'ask', 'pergunta nova', now() - interval '2 days' FROM ids;
INSERT INTO public.clinical_search_feedback (request_id, user_id, util, comentario, created_at)
SELECT 'lg6-velha', usuario, true, 'comentário velho', now() - interval '31 days' FROM ids
UNION ALL
SELECT 'lg6-nova', usuario, false, 'comentário novo', now() - interval '2 days' FROM ids;

SELECT pg_temp.confere((private.apagar_texto_ia_vencido(30) ->> 'sessoes')::int >= 1, 'a rotina devolve as contagens');

SELECT pg_temp.confere((SELECT messages FROM public.hermes_sessions WHERE phone = '5500000000001') = '[]'::jsonb, 'sessão velha sem texto');
SELECT pg_temp.confere((SELECT messages FROM public.hermes_sessions WHERE phone = '5500000000002') <> '[]'::jsonb, 'sessão nova intacta');
SELECT pg_temp.confere((SELECT tool_result_summary FROM public.hermes_audit_log WHERE phone = '5500000000001')
  = 'sha256:' || encode(sha256(convert_to('msg recebida: texto velho', 'UTF8')), 'hex'), 'auditoria velha vira sha256');
SELECT pg_temp.confere((SELECT tool_result_summary FROM public.hermes_audit_log WHERE phone = '5500000000002') = 'msg recebida: texto novo', 'auditoria nova intacta');
SELECT pg_temp.confere((SELECT query_redacted FROM public.clinical_search_logs WHERE request_id = 'lg6-velha') = '[apagada após 30 dias]', 'pergunta velha apagada');
SELECT pg_temp.confere((SELECT query_redacted FROM public.clinical_search_logs WHERE request_id = 'lg6-nova') = 'pergunta nova', 'pergunta nova intacta');
SELECT pg_temp.confere((SELECT comentario FROM public.clinical_search_feedback WHERE request_id = 'lg6-velha') IS NULL, 'comentário velho apagado');
SELECT pg_temp.confere((SELECT util FROM public.clinical_search_feedback WHERE request_id = 'lg6-velha'), 'o útil sim/não fica');
SELECT pg_temp.confere((SELECT comentario FROM public.clinical_search_feedback WHERE request_id = 'lg6-nova') = 'comentário novo', 'comentário novo intacto');

-- segunda rodada não muda nada (o hash não é refeito)
SELECT pg_temp.confere((r ->> 'auditoria')::int = 0 AND (r ->> 'perguntas')::int = 0 AND (r ->> 'sessoes')::int = 0, 'segunda rodada não refaz')
  FROM (SELECT private.apagar_texto_ia_vencido(30) AS r) x;

SELECT pg_temp.confere(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lg6-texto-ia-30-dias' AND schedule = '30 6 * * *'), 'agendamento diário às 06:30 UTC');
SELECT pg_temp.confere(NOT has_function_privilege('authenticated', 'private.apagar_texto_ia_vencido(int)', 'EXECUTE'), 'usuário não chama a rotina');

ROLLBACK;
