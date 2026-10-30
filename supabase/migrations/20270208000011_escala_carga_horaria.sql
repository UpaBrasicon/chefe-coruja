-- ════════════════════════════════════════════════════════════════════════════
-- Bug médio M13 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- a carga horária do gestor (resumo_carga_plantonistas, 20260926000001) contava
-- 12 h por dia com diurno e 12 h por dia com noturno: a manhã de 6 h virava 12 h,
-- enquanto o contador do plantonista conta 6 h. E todas as categorias apareciam
-- sob o título "Plantonista".
--
-- Correção: as horas passam a ser a soma da duração real dos plantões do mês
-- (duracao_min; vale também para plantão fracionado e para o diurno de 12 h).
-- Diurnos, noturnos e dias continuam contados como antes. Coluna nova no fim,
-- categorias (as categorias dos plantões da pessoa no mês), para a tela mostrar.
-- A troca do tipo de retorno pede DROP + CREATE da mesma função neste arquivo;
-- as colunas antigas ficam com o mesmo nome e tipo (a tela antiga lê por nome).
-- Mesmas permissões. Idempotente.
-- Teste: supabase/tests/escala_carga_horaria.sql
--
-- Rollback: DROP FUNCTION public.resumo_carga_plantonistas(uuid, date, date) e
-- reaplicar a versão de 20260926000001_fase0_endurecer_rpcs.sql, com
-- REVOKE EXECUTE ... FROM PUBLIC, anon e GRANT EXECUTE ... TO authenticated.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.resumo_carga_plantonistas(uuid, date, date);
CREATE FUNCTION public.resumo_carga_plantonistas(p_unidade uuid, p_inicio date, p_fim date)
RETURNS TABLE(perfil_id uuid, nome text, diurnos bigint, noturnos bigint, horas numeric, dias bigint, categorias text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  WITH por_dia AS (
    SELECT e.perfil_id, e.data,
           bool_or(e.turno IN ('manha','tarde')) AS tem_diurno,
           bool_or(e.turno = 'noite') AS tem_noturno,
           sum(e.duracao_min) AS minutos
    FROM public.escala_plantao e
    WHERE e.unidade_id = p_unidade AND e.ativo
      AND e.data BETWEEN p_inicio AND p_fim
    GROUP BY e.perfil_id, e.data
  ), cat AS (
    SELECT e.perfil_id,
           string_agg(DISTINCT coalesce(e.papel::text, 'sem categoria'), ', ' ORDER BY coalesce(e.papel::text, 'sem categoria')) AS categorias
    FROM public.escala_plantao e
    WHERE e.unidade_id = p_unidade AND e.ativo
      AND e.data BETWEEN p_inicio AND p_fim
    GROUP BY e.perfil_id
  )
  SELECT d.perfil_id,
         p.nome_completo,
         COUNT(*) FILTER (WHERE d.tem_diurno),
         COUNT(*) FILTER (WHERE d.tem_noturno),
         round(sum(d.minutos) / 60.0, 1),
         COUNT(*),
         c.categorias
  FROM por_dia d
  JOIN public.perfis p ON p.id = d.perfil_id
  LEFT JOIN cat c ON c.perfil_id = d.perfil_id
  GROUP BY d.perfil_id, p.nome_completo, c.categorias
  ORDER BY p.nome_completo;
END; $$;
REVOKE EXECUTE ON FUNCTION public.resumo_carga_plantonistas(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_carga_plantonistas(uuid, date, date) TO authenticated;
