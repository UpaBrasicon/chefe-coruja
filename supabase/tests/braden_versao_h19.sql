-- Teste da migration 20270403000001_braden_versao_h19.sql: a Braden passa a
-- gravar a versão 2026-11-11.1 da ficha (H19), com as mesmas faixas, e as
-- outras escalas não mudam. Não depende do seed. ROLLBACK no fim.
BEGIN;
DO $$
DECLARE
  b jsonb := private.escala_avaliacao('braden');
  m jsonb := private.escala_avaliacao('morse');
  f jsonb := private.escala_avaliacao('flacc');
BEGIN
  IF b ->> 'versao' <> '2026-11-11.1' THEN RAISE EXCEPTION 'FALHOU: versão da Braden %', b ->> 'versao'; END IF;
  IF jsonb_array_length(b -> 'faixas') <> 5 OR b -> 'faixas' -> 0 ->> 1 <> 'Risco muito alto (9 ou menos)'
     OR b -> 'faixas' -> 4 ->> 1 <> 'Sem risco (19 a 23)' THEN
    RAISE EXCEPTION 'FALHOU: faixas da Braden mudaram';
  END IF;
  IF m ->> 'versao' <> '2026-09-29.1' OR f ->> 'versao' <> '2026-09-29.1' THEN
    RAISE EXCEPTION 'FALHOU: a versão de outra escala mudou';
  END IF;
  RAISE NOTICE 'OK  Braden com a versão 2026-11-11.1 e as mesmas faixas';
END $$;
ROLLBACK;
