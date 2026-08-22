-- ─────────────────────────────────────────────────────────────────────────────
-- GAVIÃO v2 — RPC gaviao_painel_admin v2: inclui relatório semanal mais recente
-- (aditiva sobre a 20260822000003; redefine a função com o relatório).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.gaviao_painel_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := auth.uid();
  v_super boolean;
  v_incidentes jsonb := '[]'::jsonb;
  v_alertas jsonb := '[]'::jsonb;
  v_relatorio jsonb := 'null'::jsonb;
  v_n_incidentes int := 0;
  v_n_alertas int := 0;
BEGIN
  IF v_perfil IS NULL THEN
    RETURN jsonb_build_object('erro', 'não autenticado');
  END IF;

  v_super := EXISTS (
    SELECT 1 FROM public.super_admins s WHERE s.perfil_id = v_perfil
  );

  -- Incidentes do Cérbero (somente super_admin)
  IF v_super THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id, 'patrulha', i.patrulha, 'severidade', i.severidade,
      'titulo', i.titulo, 'status', i.status, 'detectado_em', i.detectado_em
    ) ORDER BY i.detectado_em DESC), '[]'::jsonb), count(*)
    INTO v_incidentes, v_n_incidentes
    FROM public.cerbero_incidentes i
    WHERE i.status IN ('aberto', 'em_analise');
  END IF;

  -- Alertas do Sentinela (gestor/admin da unidade; super vê tudo)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'unidade_id', a.unidade_id, 'metrica', a.metrica,
    'valor', a.valor, 'mediana_unidade', a.mediana_unidade,
    'status', a.status, 'criado_em', a.criado_em
  ) ORDER BY a.criado_em DESC), '[]'::jsonb), count(*)
  INTO v_alertas, v_n_alertas
  FROM public.chronos_alertas_escala a
  WHERE a.status IN ('novo', 'visto', 'em_acompanhamento')
    AND (
      v_super
      OR a.unidade_id IN (
        SELECT v.unidade_id FROM public.vinculos v
        WHERE v.perfil_id = v_perfil AND v.ativo
          AND v.papel IN ('gestor', 'admin')
      )
    );

  -- Relatório semanal mais recente (visível a super; gestor/admin veem
  -- apenas se a policy da tabela permitir — aqui filtramos pelo mesmo papel)
  SELECT to_jsonb(r)
  INTO v_relatorio
  FROM public.gaviao_relatorios_semanais r
  WHERE (
    v_super
    OR EXISTS (
      SELECT 1 FROM public.vinculos v
      WHERE v.perfil_id = v_perfil AND v.ativo
        AND v.papel IN ('gestor', 'admin')
    )
  )
  ORDER BY r.periodo_inicio DESC
  LIMIT 1;

  IF v_relatorio IS NULL THEN
    v_relatorio := 'null'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'incidentes', v_incidentes,
    'alertas', v_alertas,
    'relatorio', v_relatorio,
    'resumo', jsonb_build_object(
      'incidentes_abertos', v_n_incidentes,
      'alertas_ativos', v_n_alertas,
      'gerado_em', now()
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gaviao_painel_admin() TO authenticated;

-- ===========================================================================
-- DOWN
--   (função volta à definição da 20260822000003 — sem relatório)
-- ===========================================================================
