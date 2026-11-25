-- Decisão do RT de 25/11/2026 sobre o teste de fluxo B (achado B-02): a
-- indicação clínica NÃO é obrigatória na folha de pedido de exames. O servidor
-- deixa de recusar a emissão sem indicação (private.faltas_documento, pedido de
-- exames pelo formulário). O resto das faltas do pedido segue igual: ao menos
-- um exame, CID no formato quando vier e registro no conselho do solicitante.
-- Só função; idempotente.

DO $m$
DECLARE f regprocedure; def text; v_linha constant text := E'      IF btrim(coalesce(b ->> ''indicacao'', '''')) = '''' THEN f := array_append(f, ''Indicação clínica''); END IF;\n';
BEGIN
  SELECT p.oid::regprocedure INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' AND p.proname = 'faltas_documento';
  def := replace(pg_get_functiondef(f), E'\r', '');
  IF position(v_linha IN def) > 0 THEN
    EXECUTE replace(def, v_linha, E'      -- B-02 (RT, 25/11/2026): a indicação clínica não é obrigatória na folha do pedido de exames\n');
  ELSIF position('B-02 (RT, 25/11/2026)' IN def) = 0 THEN
    RAISE EXCEPTION 'private.faltas_documento mudou: a linha da indicação clínica não foi encontrada';
  END IF;
END $m$;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- Devolver a private.faltas_documento, no ramo do pedido de exames pelo
-- formulário, a linha:
--   IF btrim(coalesce(b ->> 'indicacao', '')) = '' THEN f := array_append(f, 'Indicação clínica'); END IF;
