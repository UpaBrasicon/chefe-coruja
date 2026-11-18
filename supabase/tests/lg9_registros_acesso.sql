-- Testes da migration 20270418000093 (LG9: registros de acesso por 6 meses, gatilho em auth.sessions). ROLLBACK no fim.
BEGIN;
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;

-- R1: o gatilho em auth.sessions registra entrada, renovação e saída com o IP
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, ip, user_agent)
VALUES ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', now(), now(), '203.0.113.10', 'teste');
UPDATE auth.sessions SET refreshed_at = now()::timestamp, ip = '203.0.113.11' WHERE id = 'b0000000-0000-4000-8000-000000000001';
UPDATE auth.sessions SET updated_at = now() WHERE id = 'b0000000-0000-4000-8000-000000000001';
DELETE FROM auth.sessions WHERE id = 'b0000000-0000-4000-8000-000000000001';
SELECT pg_temp.confere((SELECT string_agg(acao || '@' || host(ip), ',' ORDER BY id) FROM private.registros_acesso_aplicacao
  WHERE sessao_id = 'b0000000-0000-4000-8000-000000000001') = 'entrada@203.0.113.10,renovacao@203.0.113.11,saida@203.0.113.11',
  'entrada, renovação e saída gravadas com o IP; atualização sem renovação não grava');

-- médico = ...002 (sem guarda); gestora = ...001 (com guarda); recepção = ...005 (guarda vencida)
INSERT INTO private.registros_acesso_aplicacao (usuario_id, acao, ip, em) VALUES
  ('10000000-0000-4000-8000-000000000002', 'entrada', '203.0.113.1', now() - interval '7 months'),
  ('10000000-0000-4000-8000-000000000002', 'renovacao', '203.0.113.2', now() - interval '1 month'),
  ('10000000-0000-4000-8000-000000000001', 'entrada', '203.0.113.3', now() - interval '7 months'),
  ('10000000-0000-4000-8000-000000000005', 'entrada', '203.0.113.4', now() - interval '7 months'),
  ('10000000-0000-4000-8000-000000000002', 'saida', '203.0.113.5', now() - interval '2 months');
INSERT INTO private.guardas_registros_acesso (usuario_id, ate, pedido) VALUES
  ('10000000-0000-4000-8000-000000000001', current_date + 30, 'Ofício teste 1'),
  ('10000000-0000-4000-8000-000000000005', current_date - 1, 'Ofício teste vencido');

-- R2: a rotina apaga só o vencido sem guarda, e nunca abaixo de 6 meses
SELECT pg_temp.confere(private.apagar_registros_acesso_vencidos(1) >= 2, 'a rotina devolve quantas linhas apagou');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM private.registros_acesso_aplicacao WHERE ip = '203.0.113.1'), 'registro de 7 meses apagado');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM private.registros_acesso_aplicacao WHERE ip = '203.0.113.2'), 'registro de 1 mês fica');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM private.registros_acesso_aplicacao WHERE ip = '203.0.113.5'), 'pedido de 1 mês na rotina não apaga 2 meses (piso de 6)');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM private.registros_acesso_aplicacao WHERE ip = '203.0.113.3'), 'usuário sob guarda: registro velho fica');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM private.registros_acesso_aplicacao WHERE ip = '203.0.113.4'), 'guarda vencida: registro velho apagado');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'apagar_registros_acesso_vencidos'
  AND (payload ->> 'quantidade')::int >= 2 AND (payload ->> 'limite')::int = 6), 'a rotina anota na auditoria quantas apagou');
SELECT pg_temp.confere(private.apagar_registros_acesso_vencidos(6) = 0, 'segunda rodada não apaga nada');

-- quem não é super admin não anota nem extrai
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.anotar_guarda_registros_acesso('10000000-0000-4000-8000-000000000002', current_date + 10, 'Ofício 9')$$,
  'Só o super admin anota', 'médico não anota guarda');
SELECT pg_temp.falha($$SELECT * FROM public.extrair_registros_acesso('10000000-0000-4000-8000-000000000002', now() - interval '1 year', now(), 'Processo 123')$$,
  'Só o super admin extrai', 'médico não extrai registros');
SELECT pg_temp.falha($$SELECT * FROM private.guardas_registros_acesso$$, 'permission denied', 'usuário não lê a tabela de guarda');
SELECT pg_temp.falha($$SELECT private.apagar_registros_acesso_vencidos(6)$$, 'permission denied', 'usuário não chama a rotina');

-- R3: o super admin anota a guarda e extrai por ordem judicial
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.anotar_guarda_registros_acesso('10000000-0000-4000-8000-000000000002', current_date, 'Ofício 9')$$,
  'A guarda vai até uma data futura', 'guarda precisa de data futura');
SELECT pg_temp.confere(public.anotar_guarda_registros_acesso('10000000-0000-4000-8000-000000000002', current_date + 90, 'Ofício 9') > 0, 'super admin anota a guarda');
SELECT pg_temp.falha($$SELECT * FROM public.extrair_registros_acesso('10000000-0000-4000-8000-000000000002', now() - interval '1 year', now(), '12')$$,
  'Escreva o número da ordem judicial', 'extração pede o número da ordem');
SELECT pg_temp.falha($$SELECT * FROM public.extrair_registros_acesso('10000000-0000-4000-8000-000000000002', now(), now() - interval '1 day', 'Processo 123')$$,
  'Diga o usuário e o período', 'período com início antes do fim');
SELECT pg_temp.confere((SELECT count(*) FROM public.extrair_registros_acesso('10000000-0000-4000-8000-000000000002', now() - interval '1 year', now() + interval '1 minute', 'Processo 123')) = 5,
  'extração devolve os registros do período');
SELECT pg_temp.confere((SELECT ip FROM public.extrair_registros_acesso('10000000-0000-4000-8000-000000000002', now() - interval '45 days', now() - interval '1 day', 'Processo 123')) = '203.0.113.2',
  'extração traz o IP');
RESET ROLE;

SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'extrair_registros_acesso'
  AND ator_id = '10000000-0000-4000-8000-000000000003' AND entidade_id = '10000000-0000-4000-8000-000000000002'
  AND payload ->> 'ordem' = 'Processo 123' AND (payload ->> 'quantidade')::int = 5), 'auditoria guarda quem extraiu, de quem, a ordem e quantas linhas');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'anotar_guarda_registros_acesso'
  AND payload ->> 'ordem' = 'Ofício 9'), 'auditoria guarda a anotação da guarda');
SELECT pg_temp.confere(NOT has_function_privilege('anon', 'public.extrair_registros_acesso(uuid,timestamptz,timestamptz,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.anotar_guarda_registros_acesso(uuid,date,text)', 'EXECUTE'), 'anônimo não chama as funções');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lg9-registros-acesso-6-meses' AND schedule = '45 6 * * *'), 'agendamento diário às 06:45 UTC');

ROLLBACK;
