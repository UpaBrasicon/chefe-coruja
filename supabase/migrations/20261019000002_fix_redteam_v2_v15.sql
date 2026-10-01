-- ════════════════════════════════════════════════════════════════════════════
-- Correções do red-team (01/10/2026) — V2 e V15.
--
-- V2 — gaviao_painel_admin era executável por qualquer usuário autenticado e,
-- diferente das funções irmãs (gaviao_registro/apontamentos), não tinha guard
-- de topo: devolvia HTTP 200 a recepcao/plantonista (conteúdo vazio pois os
-- ramos internos filtram por papel). Além disso, gaviao_relatorios_semanais é
-- platform-wide (sem coluna de unidade) e era devolvido a QUALQUER gestor/admin
-- de QUALQUER unidade — vazamento de governança cross-tenant. Agora:
--   (a) guard de topo: só super_admin OU gestor/admin de alguma unidade entra;
--   (b) o relatório semanal (platform-wide) só é visível ao super_admin.
-- Os alertas do Sentinela continuam escopados por unidade do gestor/admin.
--
-- V15 — as views vw_censo_unidade / vw_indicadores_unidade tinham GRANT ALL
-- (INSERT/UPDATE/DELETE) para authenticated — inócuo (view sobre função) mas
-- desleixado. Fica só SELECT.
--
-- SECURITY DEFINER / search_path preservados. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.gaviao_painel_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := auth.uid();
  v_super boolean;
  v_tem_gestao boolean;
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
  v_tem_gestao := EXISTS (
    SELECT 1 FROM public.vinculos v
    WHERE v.perfil_id = v_perfil AND v.ativo AND v.papel IN ('gestor', 'admin')
  );

  -- V2 (red-team 2026-10-01): guard de topo, como as funções irmãs.
  IF NOT (v_super OR v_tem_gestao) THEN
    RAISE EXCEPTION 'Acesso negado: o painel do Olho de Gavião é do gestor/administrador.';
  END IF;

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

  -- V2: relatório semanal é platform-wide (sem coluna de unidade) → só super_admin.
  IF v_super THEN
    SELECT to_jsonb(r)
    INTO v_relatorio
    FROM public.gaviao_relatorios_semanais r
    ORDER BY r.periodo_inicio DESC
    LIMIT 1;
  END IF;

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
$function$;

-- ── V15: views só com SELECT para authenticated ─────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.vw_censo_unidade FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.vw_indicadores_unidade FROM authenticated;
