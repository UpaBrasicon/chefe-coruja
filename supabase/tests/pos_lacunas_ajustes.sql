-- Teste da migration 20270401000001_pos_lacunas_ajustes.sql: a mensagem das
-- 24 h do cancelar_alta não manda mais "falar com o gestor" (o servidor também
-- o recusa) e o cancelar_documento recusa o documento de transferência depois
-- da saída registrada. Confere o texto das funções: não depende do seed.
-- ROLLBACK no fim.
BEGIN;
DO $$
DECLARE ca text := pg_get_functiondef('public.cancelar_alta(uuid, text)'::regprocedure);
        cd text := pg_get_functiondef('public.cancelar_documento(uuid, text)'::regprocedure);
BEGIN
  IF position('fale com o gestor' IN ca) > 0 OR position('faça uma nova admissão' IN ca) = 0 THEN
    RAISE EXCEPTION 'FALHOU: mensagem das 24 h do cancelar_alta';
  END IF;
  IF position('o documento acompanhou o paciente e não se cancela mais' IN cd) = 0
     OR position('transferencia_externa' IN cd) = 0 THEN
    RAISE EXCEPTION 'FALHOU: cancelar_documento sem a trava do documento de transferência';
  END IF;
  RAISE NOTICE 'OK  mensagem das 24 h e trava do documento de transferência';
END $$;
ROLLBACK;
