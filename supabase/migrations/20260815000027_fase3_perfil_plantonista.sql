-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Perfil do plantonista
--
-- Adiciona foto, tipo sanguíneo e dados pessoais livres ao perfil. A foto fica
-- no bucket 'fotos' e aparece como avatar ao lado do nome no sistema.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS tipo_sanguineo text,
  ADD COLUMN IF NOT EXISTS dados_pessoais jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Bucket privado de fotos de perfil
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: o usuário pode atualizar o PRÓPRIO perfil (foto/dados), e super/gestor
-- podem gerenciar qualquer perfil (uso futuro).
DROP POLICY IF EXISTS "perfis_update_proprio" ON public.perfis;
CREATE POLICY "perfis_update_proprio" ON public.perfis
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.eh_super_admin())
  WITH CHECK (id = auth.uid() OR private.eh_super_admin());
