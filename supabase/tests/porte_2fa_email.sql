-- Testes do segundo fator por email + dispositivo confiável (migration
-- 20261022000001). Simula o JWT via request.jwt.claims. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_2fa_email.sql
BEGIN;

-- usuário de teste + flag ligada
INSERT INTO auth.users (id, email) VALUES ('d2000000-0000-4000-8000-000000000001', 'teste-2fa@exemplo.com');
INSERT INTO public.configuracao_plataforma (chave, valor) VALUES ('exigir_segundo_fator', true)
  ON CONFLICT (chave) DO UPDATE SET valor = true;

-- sessão 1 do usuário (aal1, sem 2º fator ainda)
SELECT set_config('request.jwt.claims',
  json_build_object('sub','d2000000-0000-4000-8000-000000000001','role','authenticated',
                    'aal','aal1','session_id','5e550000-0000-4000-8000-000000000001')::text, true);

-- 1) sem prova nenhuma → gate falso
DO $$ BEGIN
  IF private.segundo_fator_valido() THEN RAISE EXCEPTION 'FALHOU: gate verdadeiro sem 2º fator'; END IF;
  RAISE NOTICE 'OK  gate falso sem prova';
END $$;

-- 2) solicitar código (1x) + código errado é recusado
DO $$ DECLARE v_codigo text; BEGIN
  v_codigo := public.solicitar_codigo_2fa('d2000000-0000-4000-8000-000000000001');
  IF v_codigo !~ '^\d{6}$' THEN RAISE EXCEPTION 'FALHOU: código não tem 6 dígitos (%)', v_codigo; END IF;
  PERFORM set_config('teste.codigo', v_codigo, true);  -- reusa no bloco 3 (evita cooldown)
  IF public.verificar_codigo_2fa(CASE WHEN v_codigo = '999999' THEN '000000' ELSE '999999' END, false, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: código inválido aceito';
  END IF;
  IF (SELECT tentativas FROM private.segundo_fator_email_codigo WHERE user_id = 'd2000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: tentativa errada não foi contada';
  END IF;
  RAISE NOTICE 'OK  solicita código + recusa código errado';
END $$;

-- 3) código certo marca a sessão e emite device token; gate passa a verdadeiro
DO $$ DECLARE v_codigo text; v_token text; BEGIN
  v_codigo := current_setting('teste.codigo', true);
  v_token := public.verificar_codigo_2fa(v_codigo, true, 'PC teste');
  IF length(v_token) < 32 THEN RAISE EXCEPTION 'FALHOU: device token não emitido'; END IF;
  IF NOT private.segundo_fator_valido() THEN RAISE EXCEPTION 'FALHOU: gate falso após código certo'; END IF;
  RAISE NOTICE 'OK  código certo marca sessão + emite token; gate verdadeiro';
  -- guarda o token p/ o próximo bloco
  PERFORM set_config('teste.device_token', v_token, true);
END $$;

-- 4) sessão NOVA (outro session_id) → gate falso de novo
SELECT set_config('request.jwt.claims',
  json_build_object('sub','d2000000-0000-4000-8000-000000000001','role','authenticated',
                    'aal','aal1','session_id','5e550000-0000-4000-8000-000000000002')::text, true);
DO $$ BEGIN
  IF private.segundo_fator_valido() THEN RAISE EXCEPTION 'FALHOU: sessão nova herdou verificação'; END IF;
  RAISE NOTICE 'OK  sessão nova precisa de 2º fator de novo';
END $$;

-- 5) dispositivo confiável marca a sessão nova (pula o email) → gate verdadeiro
DO $$ DECLARE v_token text; BEGIN
  v_token := current_setting('teste.device_token', true);
  IF NOT public.verificar_dispositivo_2fa(v_token) THEN RAISE EXCEPTION 'FALHOU: device token válido recusado'; END IF;
  IF NOT private.segundo_fator_valido() THEN RAISE EXCEPTION 'FALHOU: gate falso com dispositivo confiável'; END IF;
  IF public.verificar_dispositivo_2fa('token-invalido-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'FALHOU: device token inválido aceito';
  END IF;
  RAISE NOTICE 'OK  dispositivo confiável pula o email; token inválido recusado';
END $$;

-- 5b) segurança (migration 20261022000002): authenticated não pede código (ele
--     voltaria em claro); 5 erros matam o código; sessão verificada vence em 24 h (era 12 h até 03/10/2026)
DO $$ BEGIN
  IF has_function_privilege('authenticated', 'public.solicitar_codigo_2fa(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated executa solicitar_codigo_2fa';
  END IF;
  IF has_function_privilege('authenticated', 'public.hermes_sessao_carregar(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated executa funções do Hermes';
  END IF;
  RAISE NOTICE 'OK  pedir código e funções do Hermes só com a chave de serviço';
END $$;
DO $$ DECLARE v_codigo text; i int; BEGIN
  UPDATE private.segundo_fator_email_codigo SET enviado_em = now() - interval '2 minutes' WHERE user_id = 'd2000000-0000-4000-8000-000000000001';
  DELETE FROM private.segundo_fator_email_codigo WHERE user_id = 'd2000000-0000-4000-8000-000000000001';
  v_codigo := public.solicitar_codigo_2fa('d2000000-0000-4000-8000-000000000001');
  FOR i IN 1..5 LOOP
    PERFORM public.verificar_codigo_2fa(CASE WHEN v_codigo = '999999' THEN '000000' ELSE '999999' END, false, NULL);
  END LOOP;
  BEGIN
    PERFORM public.verificar_codigo_2fa(v_codigo, false, NULL);
    RAISE EXCEPTION 'FALHOU: código certo aceito depois de 5 erros';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  UPDATE private.segundo_fator_sessao_ok SET verificado_em = now() - interval '25 hours'
   WHERE session_id = '5e550000-0000-4000-8000-000000000002';
  IF private.segundo_fator_sessao_valida() THEN RAISE EXCEPTION 'FALHOU: sessão verificada há 25 h ainda vale'; END IF;
  RAISE NOTICE 'OK  5 erros matam o código; verificação vence em 24 h';
END $$;

-- 6) com a flag desligada, o gate é sempre verdadeiro (sessão limpa)
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
SELECT set_config('request.jwt.claims',
  json_build_object('sub','d2000000-0000-4000-8000-000000000001','role','authenticated',
                    'aal','aal1','session_id','5e550000-0000-4000-8000-000000000003')::text, true);
DO $$ BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'FALHOU: flag desligada mas gate barrou'; END IF;
  RAISE NOTICE 'OK  flag desligada = gate liberado';
END $$;

ROLLBACK;
