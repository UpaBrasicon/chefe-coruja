-- ════════════════════════════════════════════════════════════════════════════
-- VD4 do lote "Virada de data" (BACKLOG.md, decisão do RT em 01/11/2026, P0
-- clínico): neonato no pedido de regulação pelo dia UTC.
--
-- regulacao_solicitar decide se o paciente é recém-nascido (transferência pede
-- incubadora, Portaria 2.048/2002) com `data_nascimento > current_date - 28`.
-- O banco roda em UTC: das 21h às 24h de Brasília current_date já é amanhã, e
-- um RN de 27 dias passava por não neonato: a incubadora deixava de ser pedida.
--
-- Correção: current_date → private.data_atual() (dia de Brasília) nesse
-- trecho, o único current_date da função. Como em
-- 20261124000001_rn_vinculado_mae.sql, o trecho é trocado na definição atual
-- (que já tem a troca do RN vinculado à mãe), procurado sem \r. Corpo
-- conferido (md5) igual na homologação e na produção em 01/11/2026.
-- Expand: mesma assinatura e grants. Idempotente: se já trocado, não faz nada.
-- Teste: supabase/tests/fase4_regulacao_solicitacao.sql (seção 5)
--
-- Rollback: o mesmo bloco com os trechos invertidos (antigo ↔ novo).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  def text;
  antigo text := 'v_neonato := pa.data_nascimento IS NOT NULL AND pa.data_nascimento > current_date - 28;';
  novo text := 'v_neonato := pa.data_nascimento IS NOT NULL AND pa.data_nascimento > private.data_atual() - 28;';
BEGIN
  def := replace(pg_get_functiondef('public.regulacao_solicitar(uuid, uuid, jsonb)'::regprocedure), E'\r', '');
  IF position(novo IN def) > 0 THEN RETURN; END IF;
  IF position(antigo IN def) = 0 THEN
    RAISE EXCEPTION 'regulacao_solicitar mudou: trecho do recém-nascido não encontrado';
  END IF;
  EXECUTE replace(def, antigo, novo);
END $$;
