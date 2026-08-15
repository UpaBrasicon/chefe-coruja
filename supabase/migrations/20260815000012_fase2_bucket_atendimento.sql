-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 — Bucket de anexos de atendimento (Internação)
-- Arquivos anexados no atendimento (ficha, documentos). Bucket privado.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('atendimento', 'atendimento', false)
ON CONFLICT (id) DO NOTHING;

-- Upload de anexos: autenticados (refinar com escala na evolução do módulo).
DROP POLICY IF EXISTS "atendimento_upload" ON storage.objects;
CREATE POLICY "atendimento_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atendimento');

DROP POLICY IF EXISTS "atendimento_read" ON storage.objects;
CREATE POLICY "atendimento_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'atendimento');
