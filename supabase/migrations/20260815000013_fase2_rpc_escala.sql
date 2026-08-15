-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 — RPCs públicos do relógio/escala para o cliente
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.data_atual()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.data_atual(); $$;

CREATE OR REPLACE FUNCTION public.setores_na_escala_agora()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.setores_na_escala_agora(); $$;

GRANT EXECUTE ON FUNCTION public.data_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.setores_na_escala_agora() TO authenticated;
