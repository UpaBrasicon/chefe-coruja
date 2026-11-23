-- ════════════════════════════════════════════════════════════════════════════
-- Teste da migration 20270415000037_lg8_contrato_teleinterconsulta.sql (LG8,
-- contrato). Só leitura de permissões; tudo em transação com ROLLBACK.
--
-- 1. authenticated e anon não chamam mais a solicitar_teleinterconsulta antiga;
-- 2. authenticated continua chamando a _com_termo, que é SECURITY DEFINER.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.solicitar_teleinterconsulta(uuid, text, text, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated ainda chama a solicitar_teleinterconsulta antiga';
  END IF;
  IF has_function_privilege('anon', 'public.solicitar_teleinterconsulta(uuid, text, text, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon chama a solicitar_teleinterconsulta antiga';
  END IF;
  RAISE NOTICE 'OK  1. a antiga não é mais do usuário';
  IF NOT has_function_privilege('authenticated', 'public.solicitar_teleinterconsulta_com_termo(uuid, text, text, text, text, text, text, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated perdeu a _com_termo';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.solicitar_teleinterconsulta_com_termo(uuid, text, text, text, text, text, text, text, uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'FALHOU: a _com_termo precisa ser SECURITY DEFINER para chamar a antiga';
  END IF;
  RAISE NOTICE 'OK  2. a _com_termo continua do usuário';
END $$;
ROLLBACK;
