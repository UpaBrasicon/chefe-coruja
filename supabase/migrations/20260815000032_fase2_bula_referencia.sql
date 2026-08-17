-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 — Tabela de apoio de curadoria (bula americana openFDA)
-- O texto_referencia_en é APOIO à curadoria humana. Nunca vira o campo
-- estruturado de diluição (bula americana ≠ apresentação brasileira).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.medicamento_bula (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id     uuid REFERENCES public.medicamento(id) ON DELETE CASCADE,
  principio_ativo    text NOT NULL,
  rxcui              text,
  set_id             text,
  generic_name       text,
  fonte              text NOT NULL DEFAULT 'openFDA_Drug_Label',
  texto_referencia_en text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicamento_id)
);

ALTER TABLE public.medicamento_bula ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicamento_bula_select" ON public.medicamento_bula;
CREATE POLICY "medicamento_bula_select" ON public.medicamento_bula
  FOR SELECT TO authenticated
  USING (private.eh_super_admin());

DROP POLICY IF EXISTS "medicamento_bula_insert" ON public.medicamento_bula;
CREATE POLICY "medicamento_bula_insert" ON public.medicamento_bula
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());
