-- ════════════════════════════════════════════════════════════════════════════
-- VD9 do lote "Virada de data" (BACKLOG.md, RT em 01/11/2026, P2): avisos com
-- current_date.
--
-- notificacoes_plantonista tem um aviso por (perfil, unidade, data, tipo). As
-- funções abaixo gravavam a data com current_date, que no banco (UTC) já é
-- amanhã das 21h às 24h de Brasília: o aviso diário (prazo da regulação, NIR)
-- se repetia às 21h, e os avisos dessa faixa saíam com a data de amanhã.
--
-- Correção: current_date → private.data_atual() (dia de Brasília). Em todas
-- elas o único uso de current_date é a data do aviso (conferido na produção em
-- 01/11/2026). Como em 20270209000003, a troca é feita na definição atual de
-- cada função, lida sem o CR do fim de linha. Mesma assinatura, dono e grants.
-- Idempotente: função já sem current_date e com data_atual não muda.
-- Teste: supabase/tests/vd9_avisos_data.sql
--
-- Rollback: o mesmo bloco com a troca invertida (nenhuma destas funções usava
-- data_atual antes).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  f regprocedure;
  def text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.enviar_mensagem(uuid, text)',
    'public.nir_cobrar(uuid, text, uuid)',
    'public.regulacao_atualizar_evolucao(uuid, text, text)',
    'public.regulacao_responder_pendencia(uuid, text)',
    'private.regulacao_avisar(public.regulacao_solicitacoes, text, text)',
    'private.regulacao_avisar_destino(public.regulacao_solicitacoes, text, text, boolean)',
    'private.regulacao_avisar_regulador(public.regulacao_solicitacoes, text, text)',
    'private.regulacao_sla_avisar()',
    'private.rnds_avisar(uuid[], text, text)',
    'private.webhook_manutencao()'
  ]::regprocedure[] LOOP
    def := replace(pg_get_functiondef(f), chr(13), '');
    IF position('current_date' IN lower(def)) = 0 THEN
      IF position('private.data_atual()' IN def) = 0 THEN
        RAISE EXCEPTION '% mudou: sem current_date nem data_atual', f;
      END IF;
      CONTINUE;
    END IF;
    IF position('current_date' IN lower(def)) > 0 AND position('current_date' IN def) = 0 THEN
      RAISE EXCEPTION '% mudou: current_date em maiúsculas', f;
    END IF;
    EXECUTE replace(def, 'current_date', 'private.data_atual()');
  END LOOP;
END $$;
