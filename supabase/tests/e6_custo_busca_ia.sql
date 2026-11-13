-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270413000001_custo_busca_ia.sql (trilha Hermes /
-- Evidências, E6). Tudo em transação com ROLLBACK.
--
-- 1. pico da DeepSeek: segunda 02:30 UTC é pico; sábado e segunda 12:00 UTC, não;
-- 2. custo do mês: 1 milhão de tokens de cada tipo no pico custa 1,506 USD e,
--    fora do pico, metade (0,753); pergunta sem tokens conta à parte e fica
--    fora do custo; busca simples (search) não entra;
-- 3. quem não é super admin recebe 42501;
-- 4. anon não executa; authenticated não lê a tabela de preço.
-- Os perfis e a unidade vêm do próprio banco (seed local ou homologação): um
-- perfil vira super admin dentro da transação; o outro não é super admin.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

SELECT set_config('e6.admin', (SELECT p.id::text FROM public.perfis p JOIN auth.users u ON u.id = p.id ORDER BY p.id LIMIT 1), true),
       set_config('e6.outro', (SELECT p.id::text FROM public.perfis p JOIN auth.users u ON u.id = p.id
                                WHERE NOT EXISTS (SELECT 1 FROM public.super_admins s WHERE s.perfil_id = p.id)
                                ORDER BY p.id DESC LIMIT 1), true),
       set_config('e6.unidade', (SELECT id::text FROM public.unidades ORDER BY id LIMIT 1), true);
INSERT INTO public.super_admins (perfil_id) VALUES (current_setting('e6.admin')::uuid) ON CONFLICT DO NOTHING;

-- dezembro de 2026, depois da data do preço (13/11/2026); o mês fica só com as
-- perguntas do teste (o DELETE é desfeito no ROLLBACK)
DELETE FROM public.clinical_search_logs WHERE created_at >= '2026-12-01 03:00+00' AND created_at < '2027-01-01 03:00+00';
INSERT INTO public.clinical_search_logs (request_id, created_at, user_id, unidade_id, mode, query_redacted, status,
                                         modelo, tokens_entrada_cache, tokens_entrada, tokens_saida)
SELECT v.rid, v.em::timestamptz, current_setting('e6.outro')::uuid, current_setting('e6.unidade')::uuid, v.modo, 'x', v.st, v.modelo, v.c, v.e, v.s
  FROM (VALUES
    ('e6-pico',      '2026-12-07 02:30:00+00', 'ask',    200, 'deepseek-v4-flash', 1000000, 1000000, 1000000),
    ('e6-fora',      '2026-12-12 15:00:00+00', 'ask',    200, 'deepseek-flash',    1000000, 1000000, 1000000),
    ('e6-sem-token', '2026-12-08 15:00:00+00', 'ask',    422, NULL,                NULL,    NULL,    NULL),
    ('e6-busca',     '2026-12-08 15:00:00+00', 'search', 200, 'deepseek-flash',    1000000, 1000000, 1000000)
  ) AS v(rid, em, modo, st, modelo, c, e, s);

DO $$
BEGIN
  -- 1
  IF NOT private.ia_hora_de_pico('2026-12-07 02:30:00+00') THEN RAISE EXCEPTION 'FALHOU: segunda 02:30 UTC é pico'; END IF;
  IF private.ia_hora_de_pico('2026-12-12 02:30:00+00') THEN RAISE EXCEPTION 'FALHOU: sábado não é pico'; END IF;
  IF private.ia_hora_de_pico('2026-12-07 12:00:00+00') THEN RAISE EXCEPTION 'FALHOU: 12:00 UTC não é pico'; END IF;
  IF NOT private.ia_hora_de_pico('2026-12-07 09:59:00+00') THEN RAISE EXCEPTION 'FALHOU: 09:59 UTC é pico'; END IF;
  RAISE NOTICE 'OK  horário de pico';
END $$;

-- 2
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('e6.admin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.ia_custo_busca_mes('2026-12-15');
  IF r.mes <> '2026-12-01' THEN RAISE EXCEPTION 'FALHOU: mês %', r.mes; END IF;
  IF r.perguntas <> 3 THEN RAISE EXCEPTION 'FALHOU: perguntas % (esperado 3, sem a busca simples)', r.perguntas; END IF;
  IF r.perguntas_sem_tokens <> 1 THEN RAISE EXCEPTION 'FALHOU: sem tokens %', r.perguntas_sem_tokens; END IF;
  IF r.tokens_saida <> 2000000 THEN RAISE EXCEPTION 'FALHOU: tokens de saída %', r.tokens_saida; END IF;
  IF r.usd_estimado <> 2.259 THEN RAISE EXCEPTION 'FALHOU: custo % (esperado 1,506 + 0,753)', r.usd_estimado; END IF;
  RAISE NOTICE 'OK  custo do mês: % USD, modelos %', r.usd_estimado, r.modelos;
END $$;
RESET ROLE;

-- 3
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('e6.outro'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.ia_custo_busca_mes('2026-12-15');
    RAISE EXCEPTION 'FALHOU: quem não é super admin viu o custo';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  quem não é super admin recebe 42501';
  END;
END $$;
RESET ROLE;

-- 4
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.ia_custo_busca_mes(date)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  IF has_table_privilege('authenticated', 'private.ia_preco_modelo', 'SELECT') THEN RAISE EXCEPTION 'FALHOU: authenticated lê o preço'; END IF;
  IF has_function_privilege('authenticated', 'private.ia_hora_de_pico(timestamptz)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: authenticated executa a função de pico'; END IF;
  RAISE NOTICE 'OK  privilégios';
END $$;

ROLLBACK;
