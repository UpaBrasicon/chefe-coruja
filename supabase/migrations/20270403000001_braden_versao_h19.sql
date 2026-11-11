-- H19 da revisão PubMed (decisão A do RT, 11/11/2026): as faixas da Braden não
-- mudam, mas a ficha ganhou fonte para as faixas (Velozo 2026) e uma nota de
-- limitação (Hillier 2025). A versão da ficha subiu para 2026-11-11.1, e
-- private.escala_avaliacao grava essa versão em cada avaliação. Só a versão da
-- Braden muda; itens, pontos, faixas e as outras escalas ficam iguais.
--
-- Idempotente: troca o trecho só se ele ainda estiver lá e falha se não achar
-- nem o trecho antigo nem o novo.
-- Rollback: a mesma troca no sentido inverso ('2026-11-11.1' -> '2026-09-29.1'
-- no trecho da Braden).
DO $$
DECLARE
  v_def  text := pg_get_functiondef('private.escala_avaliacao(text)'::regprocedure);
  v_velho text := 'WHEN ''braden'' THEN ''{"publico":"adulto","versao":"2026-09-29.1",';
  v_novo  text := 'WHEN ''braden'' THEN ''{"publico":"adulto","versao":"2026-11-11.1",';
BEGIN
  IF position(v_novo IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF position(v_velho IN v_def) = 0 THEN
    RAISE EXCEPTION 'escala_avaliacao: trecho da Braden não encontrado';
  END IF;
  EXECUTE replace(v_def, v_velho, v_novo);
END
$$;
