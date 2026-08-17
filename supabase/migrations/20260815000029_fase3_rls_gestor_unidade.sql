-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Ajuste de RLS: gestor pode atualizar configurações da unidade
-- (canal de comunicação, geolocalização do check-in, raio, whatsapp).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "unidades_update_gestor" ON public.unidades;
CREATE POLICY "unidades_update_gestor" ON public.unidades
  FOR UPDATE TO authenticated
  USING (private.papel_na_unidade(id) = 'gestor' OR private.eh_super_admin())
  WITH CHECK (private.papel_na_unidade(id) = 'gestor' OR private.eh_super_admin());
