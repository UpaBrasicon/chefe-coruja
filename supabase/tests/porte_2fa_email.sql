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
  v_codigo := public.solicitar_codigo_2fa();
  IF v_codigo !~ '^\d{6}$' THEN RAISE EXCEPTION 'FALHOU: código não tem 6 dígitos (%)', v_codigo; END IF;
  PERFORM set_config('teste.codigo', v_codigo, true);  -- reusa no bloco 3 (evita cooldown)
  BEGIN
    PERFORM public.verificar_codigo_2fa('999999', false, NULL);
    RAISE EXCEPTION 'FALHOU: código inválido aceito';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%não confere%' THEN RAISE EXCEPTION 'FALHOU: erro inesperado: %', SQLERRM; END IF;
  END;
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
