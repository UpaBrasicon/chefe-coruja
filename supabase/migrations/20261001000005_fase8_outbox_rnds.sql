-- ════════════════════════════════════════════════════════════════════════════
-- Fase 8 — fila de envio à RNDS (interop_outbox): três correções.
--
-- 1. Sem duplicata: a mesma referência e o mesmo tipo não entram de novo
--    enquanto houver item pendente ou enviado (antes, cada mudança de status
--    de alta enfileirava outra vez).
-- 2. Alta cancelada descarta o item pendente daquela internação.
-- 3. RAC: o atendimento da porta (episódio) que se encerra sem virar
--    observação ou internação entra na fila como Registro de Atendimento
--    Clínico. Quem vira internação é coberto pelo Sumário de Alta.
-- O envio em si continua desligado: falta credenciamento, certificado e IP
-- fixo (docs/rnds/RESTRICOES-INFRA.md). A fila só guarda.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.enfileirar_documento(
  p_unidade_id   uuid,
  p_tipo         text,
  p_referencia_id uuid,
  p_payload      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_status text := 'pendente';
  v_erro   text := NULL;
BEGIN
  -- idempotência: já há item vivo para esta referência e este tipo
  IF EXISTS (SELECT 1 FROM public.interop_outbox o
             WHERE o.tipo_documento = p_tipo AND o.referencia_id = p_referencia_id
               AND o.status IN ('pendente', 'enviado')) THEN
    RETURN;
  END IF;

  IF p_payload IS NULL OR p_tipo IS NULL OR p_referencia_id IS NULL OR p_unidade_id IS NULL THEN
    v_status := 'erro';
    v_erro := 'payload/tipo/referencia/unidade ausentes';
  END IF;

  BEGIN
    IF v_status = 'pendente' AND NOT (
      p_tipo IN ('rac','sumario_alta')
      AND jsonb_typeof(p_payload) = 'object'
      AND p_payload->>'resourceType' = 'Bundle'
    ) THEN
      v_status := 'erro';
      v_erro := 'payload não é um Bundle FHIR válido';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'erro';
    v_erro := SQLERRM;
  END;

  INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
  VALUES (p_unidade_id, p_tipo, p_referencia_id, p_payload, v_status, v_erro);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
    VALUES (p_unidade_id, p_tipo, p_referencia_id, COALESCE(p_payload, '{}'::jsonb), 'erro', SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.enfileirar_na_alta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  altas text[] := ARRAY['alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito'];
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = ANY (altas) THEN
      PERFORM private.enfileirar_documento(NEW.unidade_id, 'sumario_alta', NEW.id,
        jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'sumario_alta',
                           'internacao_id', NEW.id, 'paciente_id', NEW.paciente_id));
    ELSIF OLD.status = ANY (altas) THEN
      -- alta cancelada: o sumário ainda não enviado sai da fila
      UPDATE public.interop_outbox SET status = 'descartado', ultimo_erro = 'alta cancelada'
       WHERE tipo_documento = 'sumario_alta' AND referencia_id = NEW.id AND status = 'pendente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enfileirar_rac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado'
     AND coalesce(NEW.desfecho, '') NOT IN ('internacao', 'observacao', 'cancelado') THEN
    PERFORM private.enfileirar_documento(NEW.unidade_id, 'rac', NEW.id,
      jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'rac',
                         'episodio_id', NEW.id, 'paciente_id', NEW.paciente_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outbox_rac ON public.episodios;
CREATE TRIGGER trg_outbox_rac
  AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.enfileirar_rac();
