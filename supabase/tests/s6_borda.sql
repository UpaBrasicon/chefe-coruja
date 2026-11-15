-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S6: borda e API de integração (migration 20270414000061).
-- 1. B1: private.requisicao_ip usa o cf-connecting-ip e, sem ele, o último item
--    do x-forwarded-for; nunca o primeiro, que o cliente controla.
-- 2. B4: as quatro portas da API travam por chave antes de contar.
-- 3. B2: o segredo do motor curto ou errado não autoriza.
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.ip_com(p_cabecalhos jsonb) RETURNS inet LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.headers', p_cabecalhos::text, true);
  RETURN private.requisicao_ip();
END $$;

-- ── 1. B1: IP de origem ─────────────────────────────────────────────────────
SELECT pg_temp.ok(pg_temp.ip_com('{"x-forwarded-for": "203.0.113.77, 198.51.100.9"}') = '198.51.100.9'::inet,
  'x-forwarded-for com item falso na frente: vale o último');
SELECT pg_temp.ok(pg_temp.ip_com('{"x-forwarded-for": "203.0.113.77,198.51.100.9", "cf-connecting-ip": "192.0.2.10"}') = '192.0.2.10'::inet,
  'cf-connecting-ip vale antes do x-forwarded-for');
SELECT pg_temp.ok(pg_temp.ip_com('{"x-forwarded-for": "198.51.100.9"}') = '198.51.100.9'::inet,
  'x-forwarded-for com um item só');
SELECT pg_temp.ok(pg_temp.ip_com('{"x-forwarded-for": "2001:db8::1"}') = '2001:db8::1'::inet,
  'IPv6');
SELECT pg_temp.ok(pg_temp.ip_com('{"x-forwarded-for": "lixo"}') IS NULL,
  'cabeçalho malformado não quebra (NULL)');
SELECT pg_temp.ok(pg_temp.ip_com('{}') IS NULL,
  'sem cabeçalho: NULL');

-- ── 2. B4: trava por chave nas portas da API ────────────────────────────────
SELECT pg_temp.ok(
  (SELECT count(*) FROM unnest(ARRAY[
     'public.api_v1(text,text,text,text,jsonb)'::regprocedure,
     'public.api_v1_fhir(text,text,text,text,jsonb)'::regprocedure,
     'public.api_v1_financeiro(text,text,text,text,jsonb)'::regprocedure,
     'public.api_v1_leitura(text,text,text,text,jsonb)'::regprocedure]) f
    WHERE position('pg_advisory_xact_lock(hashtextextended(''api_limite:'' || c.id::text, 0))' IN pg_get_functiondef(f))
        < position('SELECT count(*) INTO v_usados' IN pg_get_functiondef(f))
      AND position('pg_advisory_xact_lock' IN pg_get_functiondef(f)) > 0) = 4,
  'as quatro portas travam por chave antes de contar');

-- ── 3. B2: segredo do motor ─────────────────────────────────────────────────
SELECT pg_temp.ok(public.webhook_motor_autorizado('curto') IS FALSE, 'segredo curto não autoriza');
SELECT pg_temp.ok(public.webhook_motor_autorizado(repeat('x', 40)) IS FALSE, 'segredo errado não autoriza');
SELECT pg_temp.ok(position('digest' IN pg_get_functiondef('public.webhook_motor_autorizado(text)'::regprocedure)) > 0,
  'comparação pelos resumos sha256');

ROLLBACK;
