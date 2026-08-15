-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — Fix: admin não pode ler leitos/setores diretamente.
--
-- A policy de SELECT de leitos/setores usava `unidades_do_usuario()`, que
-- retorna unidades de QUALQUER vínculo ativo (incluindo admin). Com isso o
-- admin passava a enxergar leitos/setores — violando a regra inviolável.
-- Agora usa `unidades_gestor_plantonista()`: só unidades onde o usuário tem
-- papel gestor ou plantonista. Admin recebe apenas agregados via view.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.unidades_gestor_plantonista()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.unidade_id
  FROM public.vinculos v
  WHERE v.perfil_id = private.meu_perfil_id()
    AND v.ativo
    AND v.papel IN ('gestor', 'plantonista')
  ORDER BY v.unidade_id;
$$;

GRANT EXECUTE ON FUNCTION private.unidades_gestor_plantonista() TO authenticated;

-- setores: SELECT apenas para gestor/plantonista vinculados (ou super)
DROP POLICY IF EXISTS "setores_select" ON public.setores;
CREATE POLICY "setores_select" ON public.setores
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR unidade_id IN (SELECT private.unidades_gestor_plantonista())
  );

-- leitos: SELECT apenas para gestor/plantonista vinculados (ou super)
DROP POLICY IF EXISTS "leitos_select" ON public.leitos;
CREATE POLICY "leitos_select" ON public.leitos
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.setores s
      WHERE s.id = leitos.setor_id
        AND s.unidade_id IN (SELECT private.unidades_gestor_plantonista())
    )
  );
