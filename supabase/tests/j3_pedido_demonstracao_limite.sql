-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270406000001_pedido_demonstracao_limite.sql (pedido 8,
-- J3). Tudo em transação com ROLLBACK.
--
-- 1. até 3 pedidos por chave na hora passam; o 4º não;
-- 2. outra chave tem a própria contagem;
-- 3. hora de mais de um dia é apagada na contagem seguinte;
-- 4. chave fora do formato (não é sha256 hex) é recusada;
-- 5. só o service_role executa a função; anon e authenticated, não;
-- 6. anon e authenticated não leem a tabela.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  a text := repeat('a', 64);
  b text := repeat('b', 64);
BEGIN
  -- 1
  IF NOT public.contar_pedido_demonstracao(a) THEN RAISE EXCEPTION '1º pedido devia passar'; END IF;
  IF NOT public.contar_pedido_demonstracao(a) THEN RAISE EXCEPTION '2º pedido devia passar'; END IF;
  IF NOT public.contar_pedido_demonstracao(a) THEN RAISE EXCEPTION '3º pedido devia passar'; END IF;
  IF public.contar_pedido_demonstracao(a) THEN RAISE EXCEPTION '4º pedido não devia passar'; END IF;
  -- 2
  IF NOT public.contar_pedido_demonstracao(b) THEN RAISE EXCEPTION 'outra chave tem contagem própria'; END IF;
  -- 3
  INSERT INTO private.pedido_demonstracao_limite (chave, hora, pedidos)
  VALUES (repeat('c', 64), date_trunc('hour', now()) - interval '2 days', 9);
  PERFORM public.contar_pedido_demonstracao(b);
  IF EXISTS (SELECT 1 FROM private.pedido_demonstracao_limite WHERE chave = repeat('c', 64)) THEN
    RAISE EXCEPTION 'hora de mais de um dia devia ter sido apagada';
  END IF;
  -- 4
  BEGIN
    PERFORM public.contar_pedido_demonstracao('10.0.0.1');
    RAISE EXCEPTION 'chave fora do formato devia ser recusada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Chave inválida.' THEN RAISE; END IF;
  END;
END $$;

-- 5 e 6
DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_function_privilege(papel, 'public.contar_pedido_demonstracao(text)', 'EXECUTE') THEN
      RAISE EXCEPTION '% não pode executar contar_pedido_demonstracao', papel;
    END IF;
    IF has_table_privilege(papel, 'private.pedido_demonstracao_limite', 'SELECT') THEN
      RAISE EXCEPTION '% não pode ler a contagem', papel;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.contar_pedido_demonstracao(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role precisa executar contar_pedido_demonstracao';
  END IF;
END $$;

SELECT 'j3_pedido_demonstracao_limite: ok' AS resultado;
ROLLBACK;
