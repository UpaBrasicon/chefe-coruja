-- Testes da migration 20270320000004 (item 05c do kit de desempenho):
-- procedimentos do paciente em páginas. A irmã "_pagina" devolve {total,
-- itens} e tem a mesma regra de acesso da original. A equivalência com a
-- original, sobre dados reais, foi conferida na homologação.
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

SELECT pg_temp.confere(
  NOT has_function_privilege('anon', 'public.procedimentos_do_paciente_pagina(uuid, integer, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.procedimentos_do_paciente_pagina(uuid, integer, integer)', 'EXECUTE'),
  'anon não executa; authenticated executa');

-- paciente que não existe: a irmã responde como a original
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000006', 'role', 'authenticated')::text, true);
SELECT pg_temp.confere(
  pg_temp.erro($q$SELECT public.procedimentos_do_paciente_pagina('ffffffff-ffff-4fff-8fff-ffffffffffff')$q$)
    IS NOT DISTINCT FROM pg_temp.erro($q$SELECT public.procedimentos_do_paciente('ffffffff-ffff-4fff-8fff-ffffffffffff')$q$),
  'mesma resposta da original para paciente inexistente');
RESET ROLE;

SELECT pg_temp.confere(pg_get_function_arguments('public.procedimentos_do_paciente_pagina(uuid, integer, integer)'::regprocedure)
  LIKE '%p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0%', 'página padrão de 20, a partir do começo');

ROLLBACK;
