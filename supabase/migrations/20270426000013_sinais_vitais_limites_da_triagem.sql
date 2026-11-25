-- ════════════════════════════════════════════════════════════════════════════
-- Sinais vitais: os mesmos limites da triagem em todo registro (decisão do RT em
-- 25/11/2026, teste de fluxo A, item A-1).
--
-- A triagem (classificar_risco) confere dois limites: dor de 0 a 10 e Glasgow de
-- 3 a 15. Os outros registros de sinal vital (escuta inicial e sinais vitais da
-- UBS, evolução, sincronização) não conferiam nada: dor 14 ou Glasgow 20
-- gravavam. A conferência passa para o gatilho de public.observacao, que vale
-- para todo caminho que grava sinal vital, com as mesmas mensagens da triagem.
--
-- Não cria limite novo: a triagem não tem limite para temperatura, saturação,
-- frequência ou pressão, e esses sinais continuam entrando crus (CLAUDE.md:
-- "vitais impressos crus"; sem fonte, não entra faixa).
--
-- Expand/contract: troca de trecho no corpo de private.validar_observacao.
-- Idempotente. Os registros existentes cabem nos limites (conferido na
-- homologação: dor de 0 a 9, Glasgow 13).
--
-- Rollback: a troca invertida (tirar o bloco "os mesmos limites da triagem").
-- ════════════════════════════════════════════════════════════════════════════

DO $m$
DECLARE
  f regprocedure := 'private.validar_observacao()'::regprocedure;
  def text := replace(pg_get_functiondef(f), chr(13), '');
  ancora text := '  -- sinal vital: cru. Sem faixa, sem marca.';
  bloco text := $b$  -- os mesmos limites da triagem (classificar_risco) em todo registro de sinal vital (RT, 25/11/2026)
  IF NEW.valor_num IS NOT NULL THEN
    CASE (SELECT c.nome FROM public.conceito c WHERE c.id = NEW.conceito_id)
      WHEN 'escala-dor' THEN
        IF NEW.valor_num <> trunc(NEW.valor_num) OR NEW.valor_num < 0 OR NEW.valor_num > 10 THEN
          RAISE EXCEPTION 'Dor pela escala numérica vai de 0 a 10.';
        END IF;
      WHEN 'glasgow' THEN
        IF NEW.valor_num <> trunc(NEW.valor_num) OR NEW.valor_num < 3 OR NEW.valor_num > 15 THEN
          RAISE EXCEPTION 'Glasgow vai de 3 a 15.';
        END IF;
      ELSE NULL;
    END CASE;
  END IF;

$b$;
BEGIN
  IF position('os mesmos limites da triagem' IN def) > 0 THEN RETURN; END IF;
  IF position(ancora IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho não encontrado: %', f, ancora; END IF;
  EXECUTE replace(def, ancora, bloco || ancora);
END $m$;
