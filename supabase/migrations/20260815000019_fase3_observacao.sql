-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Aba Observação + divisão dos setores
--
-- Internação: Enfermaria Clínica, Enfermaria Pediátrica, Sala Vermelha/
-- Semi-Crítica (tipos internacao + observacao com "verm" no nome).
-- Observação: setor de Observação + UTI/Isolamento criados pelo gestor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── RPC: setores de internação (enfermarias + sala vermelha) ─────────────────
CREATE OR REPLACE FUNCTION public.setores_internacao(p_unidade uuid)
RETURNS TABLE (id uuid, nome text, tipo text, ordem int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.nome, s.tipo, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND (
      s.tipo = 'internacao'
      OR (s.tipo = 'observacao' AND position('verm' in lower(s.nome)) > 0)
    )
  ORDER BY s.ordem, s.nome;
$$;

GRANT EXECUTE ON FUNCTION public.setores_internacao(uuid) TO authenticated;

-- ── RPC: setores de observação (só Observação — máx. 6h; sem UTI/isolamento) ─
CREATE OR REPLACE FUNCTION public.setores_observacao(p_unidade uuid)
RETURNS TABLE (id uuid, nome text, tipo text, ordem int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.nome, s.tipo, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND s.tipo = 'observacao'
    AND NOT (position('verm' in lower(s.nome)) > 0)
  ORDER BY s.ordem, s.nome;
$$;

GRANT EXECUTE ON FUNCTION public.setores_observacao(uuid) TO authenticated;
