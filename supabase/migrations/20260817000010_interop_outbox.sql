-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4A — Fila de saída RNDS (interop_outbox)
--
-- NESTA FASE NÃO HÁ ENVIO: o payload é produzido e validado; nada sai do
-- status 'pendente' (os demais status existem para a Fase 4B).
-- Migração reversível (DOWN no final).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interop_outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE, -- tenant
  tipo_documento text NOT NULL
                 CHECK (tipo_documento IN ('rac','sumario_alta')),
  referencia_id  uuid NOT NULL,            -- id da internacao (ou outro agregado)
  payload        jsonb NOT NULL,           -- Bundle FHIR produzido pelos mappers
  status         text NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','enviado','erro','descartado')),
  tentativas     integer NOT NULL DEFAULT 0,
  ultimo_erro    text,
  id_rnds        text,                     -- preenchido pela Fase 4B após envio
  enviado_em     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- fila de pendentes (Fase 4B vai ler daqui)
CREATE INDEX IF NOT EXISTS outbox_pendente_idx ON public.interop_outbox (created_at)
  WHERE status = 'pendente';

-- RLS por tenant (unidade)
ALTER TABLE public.interop_outbox ENABLE ROW LEVEL SECURITY;

-- leitura: gestor da unidade / super (a outbox pode conter PII do Bundle — restrito)
DROP POLICY IF EXISTS "outbox_select" ON public.interop_outbox;
CREATE POLICY "outbox_select" ON public.interop_outbox
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- escrita: apenas via função SECURITY DEFINER (enfileiramento) ou service_role
DROP POLICY IF EXISTS "outbox_insert" ON public.interop_outbox;
CREATE POLICY "outbox_insert" ON public.interop_outbox
  FOR INSERT TO authenticated
  WITH CHECK (false); -- fail closed: ninguém insere direto via REST

DROP POLICY IF EXISTS "outbox_update" ON public.interop_outbox;
CREATE POLICY "outbox_update" ON public.interop_outbox
  FOR UPDATE TO authenticated
  USING (private.eh_super_admin())
  WITH CHECK (private.eh_super_admin());

GRANT SELECT ON public.interop_outbox TO authenticated;

-- ===========================================================================
-- Enfileiramento: função SECURITY DEFINER usada pelos gatilhos.
-- NUNCA falha o fluxo clínico: qualquer erro na montagem grava status='erro'
-- e o atendimento segue normalmente (sem RAISE).
-- ===========================================================================
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
  -- enfileiramento NUNCA derruba o fluxo clínico: registra erro e segue
  BEGIN
    INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
    VALUES (p_unidade_id, p_tipo, p_referencia_id, COALESCE(p_payload, '{}'::jsonb), 'erro', SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nem isso deu: ignora (o atendimento segue)
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION private.enfileirar_documento(uuid, text, uuid, jsonb) TO authenticated;

-- ===========================================================================
-- DOWN
--   DROP FUNCTION IF EXISTS private.enfileirar_documento(uuid, text, uuid, jsonb);
--   DROP TABLE IF EXISTS public.interop_outbox;
-- ===========================================================================
