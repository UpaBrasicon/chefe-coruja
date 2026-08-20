-- ─────────────────────────────────────────────────────────────────────────────
-- FIX SEGURANÇA (VULN-0001, CWE-862) — bucket `atendimento` com RLS por path
--
-- As policies anteriores checavam apenas `bucket_id = 'atendimento'`, liberando
-- QUALQUER usuário autenticado a ler/gravar arquivos de QUALQUER unidade
-- (cross-tenant PHI). Agora o primeiro segmento do path deve ser a unidade_id
-- e o chamador precisa ter vínculo ativo nela (mesmo padrão do bucket banners).
--
-- Convenção de path: {unidade_id}/{paciente_id}/{arquivo}
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "atendimento_upload" ON storage.objects;
CREATE POLICY "atendimento_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'atendimento'
    AND (
      private.eh_super_admin()
      OR (
        (regexp_match(name, '^([^/]+)/'))[1]::uuid
          IN (SELECT private.unidades_gestor_plantonista())
      )
    )
  );

DROP POLICY IF EXISTS "atendimento_read" ON storage.objects;
CREATE POLICY "atendimento_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'atendimento'
    AND (
      private.eh_super_admin()
      OR (
        (regexp_match(name, '^([^/]+)/'))[1]::uuid
          IN (SELECT private.unidades_gestor_plantonista())
      )
    )
  );

-- UPDATE/DELETE no bucket: também restrito à unidade do path
DROP POLICY IF EXISTS "atendimento_update" ON storage.objects;
CREATE POLICY "atendimento_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'atendimento'
    AND (
      private.eh_super_admin()
      OR (
        (regexp_match(name, '^([^/]+)/'))[1]::uuid
          IN (SELECT private.unidades_gestor_plantonista())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'atendimento'
    AND (
      private.eh_super_admin()
      OR (
        (regexp_match(name, '^([^/]+)/'))[1]::uuid
          IN (SELECT private.unidades_gestor_plantonista())
      )
    )
  );

DROP POLICY IF EXISTS "atendimento_delete" ON storage.objects;
CREATE POLICY "atendimento_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'atendimento'
    AND (
      private.eh_super_admin()
      OR (
        (regexp_match(name, '^([^/]+)/'))[1]::uuid
          IN (SELECT private.unidades_gestor_plantonista())
      )
    )
  );

-- ===========================================================================
-- DOWN — reverter para as policies originais (flat):
--   DROP POLICY IF EXISTS "atendimento_delete" ON storage.objects;
--   DROP POLICY IF EXISTS "atendimento_update" ON storage.objects;
--   DROP POLICY IF EXISTS "atendimento_read" ON storage.objects;
--   DROP POLICY IF EXISTS "atendimento_upload" ON storage.objects;
--   CREATE POLICY "atendimento_upload" ON storage.objects
--     FOR INSERT TO authenticated WITH CHECK (bucket_id = 'atendimento');
--   CREATE POLICY "atendimento_read" ON storage.objects
--     FOR SELECT TO authenticated USING (bucket_id = 'atendimento');
-- ===========================================================================
