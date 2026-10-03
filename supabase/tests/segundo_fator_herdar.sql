-- Desbloqueio herda o segundo fator (RT, 03/10/2026).
BEGIN;
DO $$
DECLARE
  v_eu uuid := gen_random_uuid();
  v_outro uuid := gen_random_uuid();
  v_antiga uuid := gen_random_uuid();
  v_nova uuid := gen_random_uuid();
  v_alheia uuid := gen_random_uuid();
  v_quando timestamptz := now() - interval '3 hours';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_eu, 'herdar-eu@exemplo.invalido'), (v_outro, 'herdar-outro@exemplo.invalido');
  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em)
  VALUES (v_antiga, v_eu, v_quando), (v_alheia, v_outro, now());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_eu, 'session_id', v_nova, 'role', 'authenticated')::text, true);

  IF public.herdar_segundo_fator(v_alheia) IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: herdou a confirmação de outra pessoa';
  END IF;
  IF private.segundo_fator_sessao_valida() THEN
    RAISE EXCEPTION 'FALHOU: sessão nova não deveria valer antes de herdar';
  END IF;
  IF public.herdar_segundo_fator(v_antiga) IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: não herdou da própria sessão confirmada';
  END IF;
  IF private.segundo_fator_sessao_valida() IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: sessão nova deveria valer depois de herdar';
  END IF;
  IF (SELECT verificado_em FROM private.segundo_fator_sessao_ok WHERE session_id = v_nova) <> v_quando THEN
    RAISE EXCEPTION 'FALHOU: herdar não pode esticar o prazo (mantém a hora original)';
  END IF;

  UPDATE private.segundo_fator_sessao_ok SET verificado_em = now() - interval '25 hours' WHERE session_id = v_antiga;
  DELETE FROM private.segundo_fator_sessao_ok WHERE session_id = v_nova;
  IF public.herdar_segundo_fator(v_antiga) IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: confirmação vencida (25 h) não pode ser herdada';
  END IF;
  IF public.herdar_segundo_fator(v_nova) IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: a própria sessão não herda de si';
  END IF;
  RAISE NOTICE 'OK  desbloqueio herda só a própria confirmação, dentro de 24 h, sem esticar o prazo';
END $$;
ROLLBACK;
