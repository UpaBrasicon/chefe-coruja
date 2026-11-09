-- Testes da migration 20270320000003 (item 05b do kit de desempenho): AIH e
-- APAC da unidade em páginas. A irmã "_pagina" devolve {total, itens} e tem
-- a mesma regra de acesso da original. A equivalência com a original, sobre
-- dados reais, foi conferida na homologação (docs/desempenho/ITEM-05-PAGINACAO.md).
BEGIN;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.erro(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.erro(text) TO authenticated;

-- ── só authenticated executa ────────────────────────────────────────────────
SELECT pg_temp.confere(
  NOT has_function_privilege('anon', 'public.aihs_da_unidade_pagina(uuid, text, integer, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.apacs_da_unidade_pagina(uuid, text, integer, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.aihs_da_unidade_pagina(uuid, text, integer, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.apacs_da_unidade_pagina(uuid, text, integer, integer)', 'EXECUTE'),
  'anon não executa as listas em página; authenticated executa');

-- ── mesma regra de acesso da original (quem não é regulador nem gestor) ─────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000006', 'role', 'authenticated')::text, true);
SELECT pg_temp.confere(
  pg_temp.erro($q$SELECT public.aihs_da_unidade_pagina('21000000-0000-4000-8000-000000000001')$q$)
    IS NOT DISTINCT FROM pg_temp.erro($q$SELECT public.aihs_da_unidade('21000000-0000-4000-8000-000000000001')$q$)
  AND pg_temp.erro($q$SELECT public.aihs_da_unidade('21000000-0000-4000-8000-000000000001')$q$) IS NOT NULL,
  'AIH em página recusa quem a original recusa, com a mesma mensagem');
SELECT pg_temp.confere(
  pg_temp.erro($q$SELECT public.apacs_da_unidade_pagina('21000000-0000-4000-8000-000000000001')$q$)
    IS NOT DISTINCT FROM pg_temp.erro($q$SELECT public.apacs_da_unidade('21000000-0000-4000-8000-000000000001')$q$),
  'APAC em página segue a mesma regra da original');
RESET ROLE;

-- ── formato: {total, itens}, padrão de 50, teto de 200 ──────────────────────
SELECT pg_temp.confere(pg_get_function_arguments('public.aihs_da_unidade_pagina(uuid, text, integer, integer)'::regprocedure)
  LIKE '%p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0%', 'página padrão de 50, a partir do começo');
SELECT pg_temp.confere(prosrc LIKE '%least(greatest(coalesce(p_limite, 50), 1), 200)%', 'página de no máximo 200')
  FROM pg_proc WHERE oid = 'public.aihs_da_unidade_pagina(uuid, text, integer, integer)'::regprocedure;

ROLLBACK;
