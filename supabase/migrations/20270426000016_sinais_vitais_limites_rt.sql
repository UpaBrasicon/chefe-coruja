-- ════════════════════════════════════════════════════════════════════════════
-- Sinais vitais: limites do possível (decisão do RT em 25/11/2026, segunda
-- rodada do item A-1 do teste de fluxo A).
--
-- Junto com dor de 0 a 10 e Glasgow de 3 a 15 (migration 20270426000013), todo
-- registro de sinal vital passa a recusar valor impossível:
--   temperatura           de 25 a 45 °C
--   saturação de O2       de 0 a 100 %
--   frequência cardíaca   de 0 a 300 bpm
-- Vale para a triagem, a escuta, os sinais da UBS, a consulta e a evolução,
-- porque a conferência fica no gatilho de public.observacao.
--
-- O alerta de temperatura (hipotermia abaixo de 35 °C, febre acima de 37,5 °C)
-- é só texto na tela e não impede o registro: o servidor não grava marca nem
-- faixa no sinal vital. Nenhum outro sinal ganha limite.
--
-- Os registros existentes cabem nos limites (conferido na homologação:
-- temperatura de 35,4 a 39,6; saturação de 82 a 99; FC de 52 a 178).
--
-- Expand/contract: troca de trecho no corpo de private.validar_observacao.
-- Idempotente.
-- Rollback: a troca invertida (tirar os três WHEN acrescentados).
-- ════════════════════════════════════════════════════════════════════════════

DO $m$
DECLARE
  f regprocedure := 'private.validar_observacao()'::regprocedure;
  def text := replace(pg_get_functiondef(f), chr(13), '');
  ancora text := $a$          RAISE EXCEPTION 'Glasgow vai de 3 a 15.';
        END IF;
$a$;
  bloco text := $b$      -- limites do possível (RT, 25/11/2026)
      WHEN 'temperatura' THEN
        IF NEW.valor_num < 25 OR NEW.valor_num > 45 THEN
          RAISE EXCEPTION 'Temperatura impossível: o registro aceita de 25 a 45 °C.';
        END IF;
      WHEN 'saturacao-o2' THEN
        IF NEW.valor_num < 0 OR NEW.valor_num > 100 THEN
          RAISE EXCEPTION 'Saturação impossível: vai de 0 a 100 %%.';
        END IF;
      WHEN 'frequencia-cardiaca' THEN
        IF NEW.valor_num < 0 OR NEW.valor_num > 300 THEN
          RAISE EXCEPTION 'Frequência cardíaca impossível: o registro aceita de 0 a 300 bpm.';
        END IF;
$b$;
BEGIN
  IF position('limites do possível (RT, 25/11/2026)' IN def) > 0 THEN RETURN; END IF;
  IF position(ancora IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho não encontrado (aplique antes a 20270426000013): %', f, ancora; END IF;
  EXECUTE replace(def, ancora, ancora || bloco);
END $m$;
