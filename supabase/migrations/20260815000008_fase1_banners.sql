-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — Banners/carrossel da unidade
-- Quadro de imagens rotativo exibido na Central do Plantonista. As imagens são
-- definidas pelo GESTOR da unidade e podem ter link de redirecionamento.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  titulo      text,
  descricao   text,
  imagem_url  text NOT NULL,
  link_url    text,
  ordem       integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banners_unidade_idx ON public.banners (unidade_id, ordem);

DROP TRIGGER IF EXISTS trg_banners_updated_at ON public.banners;
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banners_select" ON public.banners;
CREATE POLICY "banners_select" ON public.banners
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR unidade_id IN (SELECT private.unidades_do_usuario())
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = banners.unidade_id
        AND private.eh_admin_da_organizacao(u.organizacao_id)
    )
  );

-- Gestor da unidade (ou admin da org / super) gerencia os banners
DROP POLICY IF EXISTS "banners_insert" ON public.banners;
CREATE POLICY "banners_insert" ON public.banners
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = banners.unidade_id
        AND (
          private.papel_na_unidade(u.id) = 'gestor'
          OR private.eh_admin_da_organizacao(u.organizacao_id)
        )
    )
  );

DROP POLICY IF EXISTS "banners_update" ON public.banners;
CREATE POLICY "banners_update" ON public.banners
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = banners.unidade_id
        AND (
          private.papel_na_unidade(u.id) = 'gestor'
          OR private.eh_admin_da_organizacao(u.organizacao_id)
        )
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = banners.unidade_id
        AND (
          private.papel_na_unidade(u.id) = 'gestor'
          OR private.eh_admin_da_organizacao(u.organizacao_id)
        )
    )
  );

DROP POLICY IF EXISTS "banners_delete" ON public.banners;
CREATE POLICY "banners_delete" ON public.banners
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = banners.unidade_id
        AND (
          private.papel_na_unidade(u.id) = 'gestor'
          OR private.eh_admin_da_organizacao(u.organizacao_id)
        )
    )
  );

-- ── Storage: bucket público de banners ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Upload/delete restritos ao gestor da unidade (pasta = {unidade_id}/...) ou
-- admin da org / super. Seleção pública via URL, sem policy específica.
DROP POLICY IF EXISTS "banners_storage_upload" ON storage.objects;
CREATE POLICY "banners_storage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND (
      private.eh_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.unidades u
        WHERE u.id = (regexp_match(name, '^([^/]+)/'))[1]::uuid
          AND (
            private.papel_na_unidade(u.id) = 'gestor'
            OR private.eh_admin_da_organizacao(u.organizacao_id)
          )
      )
    )
  );

DROP POLICY IF EXISTS "banners_storage_delete" ON storage.objects;
CREATE POLICY "banners_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'banners'
    AND (
      private.eh_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.unidades u
        WHERE u.id = (regexp_match(name, '^([^/]+)/'))[1]::uuid
          AND (
            private.papel_na_unidade(u.id) = 'gestor'
            OR private.eh_admin_da_organizacao(u.organizacao_id)
          )
      )
    )
  );
