-- Coluna foto_url em profissionais
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS foto_url text;

-- Bucket público para avatares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares', 'avatares', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
DROP POLICY IF EXISTS "avatares_select" ON storage.objects;
DROP POLICY IF EXISTS "avatares_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatares_update" ON storage.objects;
DROP POLICY IF EXISTS "avatares_delete" ON storage.objects;

CREATE POLICY "avatares_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatares');

CREATE POLICY "avatares_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares');

CREATE POLICY "avatares_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares');

CREATE POLICY "avatares_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatares');
