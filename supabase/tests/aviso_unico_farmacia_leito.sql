-- Teste da migration 20270323000002_aviso_unico_farmacia_leito.sql: o item
-- devolvido e o leito liberado avisam uma vez só (antes, em dobro). Confere o
-- texto das funções: não depende do seed. ROLLBACK no fim.
BEGIN;
DO $$
DECLARE
  dev int := (SELECT (length(d) - length(replace(d, 'avisar_item_devolvido(', ''))) / length('avisar_item_devolvido(')
                FROM (SELECT pg_get_functiondef('public.validar_item(uuid, boolean, text)'::regprocedure) d) x);
  lei int := (SELECT (length(d) - length(replace(d, 'avisar_leito_liberado(', ''))) / length('avisar_leito_liberado(')
                FROM (SELECT pg_get_functiondef('public.concluir_higienizacao(uuid)'::regprocedure) d) x);
BEGIN
  IF dev <> 1 THEN RAISE EXCEPTION 'FALHOU: validar_item chama o aviso do item devolvido % vezes', dev; END IF;
  IF lei <> 1 THEN RAISE EXCEPTION 'FALHOU: concluir_higienizacao chama o aviso do leito liberado % vezes', lei; END IF;
  RAISE NOTICE 'OK  item devolvido e leito liberado avisam uma vez só';
END $$;
ROLLBACK;
