-- Confirmação da sessão vale 24 h (RT, 03/10/2026).
BEGIN;
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_sessao uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'teste-24h@exemplo.invalido');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'session_id', v_sessao, 'role', 'authenticated')::text, true);

  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (v_sessao, v_user, now() - interval '20 hours');
  IF private.segundo_fator_sessao_valida() IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: confirmação de 20 h atrás deveria valer';
  END IF;

  UPDATE private.segundo_fator_sessao_ok SET verificado_em = now() - interval '25 hours' WHERE session_id = v_sessao;
  IF private.segundo_fator_sessao_valida() IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: confirmação de 25 h atrás não deveria valer';
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'session_id', gen_random_uuid(), 'role', 'authenticated')::text, true);
  UPDATE private.segundo_fator_sessao_ok SET verificado_em = now() WHERE session_id = v_sessao;
  IF private.segundo_fator_sessao_valida() IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: outra sessão não herda a confirmação';
  END IF;
  RAISE NOTICE 'OK  confirmação da sessão vale 24 h e só na mesma sessão';
END $$;
ROLLBACK;
