-- Fase 0, tarefa 5 do BACKLOG.md: toda função SECURITY DEFINER do sistema
-- tem `search_path` vazio (migration 20261022000022). Guarda de regressão: o
-- CI falha se uma função nova nascer sem ele. Sem escrita; nada a desfazer.
DO $$
DECLARE v_lista text; v_n int;
BEGIN
  SELECT count(*), string_agg(n.nspname || '.' || p.proname || ' (' || coalesce(array_to_string(p.proconfig, ','), 'sem search_path') || ')', '; ')
    INTO v_n, v_lista
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.prosecdef
     AND n.nspname IN ('public', 'private', 'terminologia')
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c IN ('search_path=""', 'search_path='));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHOU: % função(ões) SECURITY DEFINER sem search_path vazio: %', v_n, v_lista;
  END IF;
  RAISE NOTICE 'OK  toda função SECURITY DEFINER de public/private/terminologia tem search_path vazio';
END $$;
