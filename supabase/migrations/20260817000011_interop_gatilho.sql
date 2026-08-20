-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4A — Gatilhos de enfileiramento na outbox
--
-- Alta hospitalar (internacoes.status → alta_*) e fechamento de atendimento
-- gravam um item na interop_outbox. A GRAVAÇÃO NUNCA FALHA o fluxo clínico:
-- o gatilho enfileira um payload provisório; o processador TS
-- (scripts/interop/processar-outbox.ts) monta o Bundle real via mappers puros
-- e atualiza o payload (ou marca 'erro' se o mapper falhar).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.enfileirar_na_alta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tipo text;
BEGIN
  -- status de ALTA (saída do episódio) → Sumário de Alta
  IF NEW.status IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_tipo := 'sumario_alta';
      PERFORM private.enfileirar_documento(
        NEW.unidade_id,
        v_tipo,
        NEW.id,
        jsonb_build_object(
          'resourceType', 'Bundle',
          'marcador', true, -- placeholder: processador TS substitui pelo Bundle real
          'tipo_provisorio', v_tipo,
          'internacao_id', NEW.id,
          'paciente_id', NEW.paciente_id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outbox_alta ON public.internacoes;
CREATE TRIGGER trg_outbox_alta
  AFTER UPDATE OF status ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.enfileirar_na_alta();

-- ===========================================================================
-- DOWN
--   DROP TRIGGER IF EXISTS trg_outbox_alta ON public.internacoes;
--   DROP FUNCTION IF EXISTS private.enfileirar_na_alta();
-- ===========================================================================
