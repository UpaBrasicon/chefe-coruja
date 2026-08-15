-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — View agregada de censo por unidade
-- SECURITY DEFINER: o admin não tem SELECT direto em setores/leitos, então a
-- view roda como owner e devolve APENAS agregados (nenhum campo identificável).
-- Supressão LGPD: contagens entre 1 e 4 retornam NULL (anti-dedução).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.fn_censo_unidade()
RETURNS TABLE (
  unidade_id          uuid,
  unidade_nome        text,
  unidade_tipo        public.tipo_unidade,
  total_setores       bigint,
  total_leitos        bigint,
  leitos_livres       bigint,
  leitos_ocupados     bigint,
  leitos_bloqueados   bigint,
  leitos_higienizacao bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_super boolean;
BEGIN
  v_super := private.eh_super_admin();

  RETURN QUERY
  WITH c AS (
    SELECT
      u.id AS uid,
      u.nome AS unome,
      u.tipo AS utipo,
      count(DISTINCT s.id) AS t_setores,
      count(l.id) AS t_leitos,
      count(l.id) FILTER (WHERE l.status = 'livre') AS l_livres,
      count(l.id) FILTER (WHERE l.status = 'ocupado') AS l_ocupados,
      count(l.id) FILTER (WHERE l.status = 'bloqueado') AS l_bloqueados,
      count(l.id) FILTER (WHERE l.status = 'higienizacao') AS l_higienizacao
    FROM public.unidades u
    LEFT JOIN public.setores s ON s.unidade_id = u.id AND s.ativo
    LEFT JOIN public.leitos l ON l.setor_id = s.id AND l.ativo
    WHERE v_super
       OR u.id IN (SELECT private.unidades_admin())
       OR u.id IN (SELECT private.unidades_do_usuario())
    GROUP BY u.id, u.nome, u.tipo
  )
  SELECT
    c.uid,
    c.unome,
    c.utipo,
    CASE WHEN c.t_setores    BETWEEN 1 AND 4 THEN NULL ELSE c.t_setores END,
    CASE WHEN c.t_leitos     BETWEEN 1 AND 4 THEN NULL ELSE c.t_leitos END,
    CASE WHEN c.l_livres     BETWEEN 1 AND 4 THEN NULL ELSE c.l_livres END,
    CASE WHEN c.l_ocupados   BETWEEN 1 AND 4 THEN NULL ELSE c.l_ocupados END,
    CASE WHEN c.l_bloqueados BETWEEN 1 AND 4 THEN NULL ELSE c.l_bloqueados END,
    CASE WHEN c.l_higienizacao BETWEEN 1 AND 4 THEN NULL ELSE c.l_higienizacao END
  FROM c
  ORDER BY c.unome;
END;
$$;

CREATE OR REPLACE VIEW public.vw_censo_unidade AS
  SELECT * FROM private.fn_censo_unidade();

GRANT SELECT ON public.vw_censo_unidade TO authenticated;
GRANT EXECUTE ON FUNCTION private.fn_censo_unidade() TO authenticated;
