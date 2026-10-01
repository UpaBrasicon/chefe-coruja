-- Pilar 1 (Supabase/Postgres best-practices — performance): índice faltante na
-- coluna de join/filtro prescricoes.internacao_id. Era a única coluna quente
-- (RLS/FK/join) sem índice numa auditoria de 26 colunas das tabelas principais
-- (01/10/2026). Sem ele, buscar prescrições por internação faz seq scan.
-- Parcial (só não-nulo): prescrição sem internação não entra no índice.
CREATE INDEX IF NOT EXISTS idx_prescricoes_internacao_id
  ON public.prescricoes (internacao_id)
  WHERE internacao_id IS NOT NULL;
