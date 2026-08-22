-- ─────────────────────────────────────────────────────────────────────────────
-- GAVIÃO v2 — painel do admin: dados pertinentes para a aba do Gavião
--
-- RPC gaviao_painel_admin() — retorna para o admin/gestor o que o Gavião
-- considera pertinente:
--   incidentes : cerbero_incidentes (só super_admin vê conteúdo de segurança)
--   alertas    : chronos_alertas_escala (gestor/admin da unidade)
--   resumo     : contagens agregadas
--
-- Papéis: admin (organizacao) e gestor veem alertas da unidade; super_admin
-- vê incidentes do Cérbero. Nunca expõe dado de paciente.
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

  RETURN jsonb_build_object(
    'incidentes', v_incidentes,
    'alertas', v_alertas,
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
--   REVOKE EXECUTE ON FUNCTION public.gaviao_painel_admin() FROM authenticated;
--   DROP FUNCTION IF EXISTS public.gaviao_painel_admin();
-- ===========================================================================
