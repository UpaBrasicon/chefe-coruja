-- Trilha de segurança, S3: segundo fator uniforme (migration 20270414000054).
-- 1. Guarda de regressão: toda tabela de public legível pelo authenticated com
--    coluna de paciente ou de atendimento tem a política RESTRICTIVE
--    segundo_fator_ok(), salvo as exceções justificadas abaixo. O chat também.
-- 2. As duas views do gestor filtram por segundo_fator_ok().
-- 3. O hook do Auth recusa o primeiro cadastro de TOTP sem o código por e-mail
--    nos últimos 15 minutos (só com o segundo fator exigido).
-- Tudo em transação desfeita.
BEGIN;
DO $$
DECLARE
  v_lista text;
  v_n int;
  v_eu uuid := gen_random_uuid();
  v_fator uuid := gen_random_uuid();
  v_r jsonb;
BEGIN
  -- ── 1. Tabelas ─────────────────────────────────────────────────────────────
  WITH t AS (
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       AND has_table_privilege('authenticated', c.oid, 'SELECT')
       AND EXISTS (SELECT 1 FROM information_schema.columns k
                    WHERE k.table_schema = 'public' AND k.table_name = c.relname
                      AND k.column_name IN ('paciente_id', 'atendimento_id', 'episodio_id', 'internacao_id',
                                            'conta_id', 'dispensacao_id', 'prescricao_id'))
       AND NOT EXISTS (SELECT 1 FROM pg_policies p
                        WHERE p.schemaname = 'public' AND p.tablename = c.relname
                          AND p.permissive = 'RESTRICTIVE' AND p.qual LIKE '%segundo_fator_ok%')
       AND c.relname NOT IN (
         -- protegidas de forma indireta: a política de leitura consulta uma tabela com o 2FA
         'prescricao_itens', 'links_publicos_receita', 'notificacoes_whatsapp', 'receitas_retidas',  -- por prescricoes
         'pacientes_identidade_provisoria',                                                          -- por pacientes
         -- sem política de leitura (a RLS não devolve linha a ninguém)
         'admissao_fichas'
       ))
  SELECT count(*), string_agg(relname, ', ' ORDER BY relname) INTO v_n, v_lista FROM t;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHOU: % tabela(s) com dado de paciente legíveis sem a política segundo_fator: %', v_n, v_lista;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'chat_mensagens'
                    AND p.permissive = 'RESTRICTIVE' AND p.qual LIKE '%segundo_fator_ok%') THEN
    RAISE EXCEPTION 'FALHOU: chat_mensagens sem a política segundo_fator';
  END IF;
  RAISE NOTICE 'OK  tabelas com dado de paciente e o chat exigem o segundo fator na leitura';

  -- ── 2. Views ───────────────────────────────────────────────────────────────
  IF pg_get_viewdef('public.vw_censo_unidade'::regclass) NOT LIKE '%segundo_fator_ok%'
     OR pg_get_viewdef('public.vw_indicadores_unidade'::regclass) NOT LIKE '%segundo_fator_ok%' THEN
    RAISE EXCEPTION 'FALHOU: views do gestor sem o filtro segundo_fator_ok()';
  END IF;
  RAISE NOTICE 'OK  views do gestor exigem o segundo fator';

  -- ── 3. Hook: primeiro cadastro do TOTP ─────────────────────────────────────
  INSERT INTO public.configuracao_plataforma (chave, valor) VALUES ('exigir_segundo_fator', true)
  ON CONFLICT (chave) DO UPDATE SET valor = true;
  INSERT INTO auth.users (id, email) VALUES (v_eu, 's3-totp@exemplo.invalido');
  INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  VALUES (v_fator, v_eu, 'app', 'totp', 'unverified', now(), now());

  v_r := public.hook_segundo_fator_tentativa(jsonb_build_object('factor_id', v_fator, 'factor_type', 'totp', 'user_id', v_eu, 'valid', true));
  IF v_r->>'decision' <> 'reject' OR v_r->>'message' NOT LIKE 'SEGUNDO_FATOR_EMAIL_ANTES%' THEN
    RAISE EXCEPTION 'FALHOU: primeiro cadastro de TOTP sem e-mail deveria ser recusado (%)', v_r;
  END IF;

  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (gen_random_uuid(), v_eu, now() - interval '20 minutes');
  v_r := public.hook_segundo_fator_tentativa(jsonb_build_object('factor_id', v_fator, 'factor_type', 'totp', 'user_id', v_eu, 'valid', true));
  IF v_r->>'decision' <> 'reject' THEN
    RAISE EXCEPTION 'FALHOU: e-mail confirmado há 20 min não basta para o primeiro cadastro (%)', v_r;
  END IF;

  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (gen_random_uuid(), v_eu, now() - interval '5 minutes');
  v_r := public.hook_segundo_fator_tentativa(jsonb_build_object('factor_id', v_fator, 'factor_type', 'totp', 'user_id', v_eu, 'valid', true));
  IF v_r->>'decision' <> 'continue' THEN
    RAISE EXCEPTION 'FALHOU: com o e-mail confirmado há 5 min o cadastro deveria passar (%)', v_r;
  END IF;

  -- Fator já cadastrado: a verificação de sempre não pede e-mail.
  DELETE FROM private.segundo_fator_sessao_ok WHERE user_id = v_eu;
  UPDATE auth.mfa_factors SET status = 'verified' WHERE id = v_fator;
  v_r := public.hook_segundo_fator_tentativa(jsonb_build_object('factor_id', v_fator, 'factor_type', 'totp', 'user_id', v_eu, 'valid', true));
  IF v_r->>'decision' <> 'continue' THEN
    RAISE EXCEPTION 'FALHOU: fator já cadastrado não deveria pedir e-mail (%)', v_r;
  END IF;

  -- Segundo fator desligado na plataforma: nada muda.
  UPDATE auth.mfa_factors SET status = 'unverified' WHERE id = v_fator;
  UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
  v_r := public.hook_segundo_fator_tentativa(jsonb_build_object('factor_id', v_fator, 'factor_type', 'totp', 'user_id', v_eu, 'valid', true));
  IF v_r->>'decision' <> 'continue' THEN
    RAISE EXCEPTION 'FALHOU: com o 2FA desligado o cadastro não muda (%)', v_r;
  END IF;

  -- O bloqueio por erros continua igual: código errado conta e não recusa.
  v_r := public.hook_segundo_fator_tentativa(jsonb_build_object('factor_id', v_fator, 'factor_type', 'totp', 'user_id', v_eu, 'valid', false));
  IF v_r->>'decision' <> 'continue' OR NOT EXISTS (SELECT 1 FROM private.segundo_fator_tentativas WHERE user_id = v_eu AND falhas = 1) THEN
    RAISE EXCEPTION 'FALHOU: contagem de erros mudou (%)', v_r;
  END IF;
  RAISE NOTICE 'OK  primeiro cadastro de TOTP exige o código por e-mail dos últimos 15 minutos';
END $$;
ROLLBACK;
