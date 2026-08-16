-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Melhorias de Escala (E3 conflito, E4 padrão, E5 export)
--
-- E3: trava de conflito — um plantonista não pode estar escalado em DOIS
--     setores diferentes no MESMO dia e turno (RPC adicionar_plantao_escala).
-- E4: escala fixa por padrão semanal já existe (dia_semana); reforçamos com
--     validação no insert da escala mensal.
-- E5: exportação fica no front (CSV); nada de schema aqui.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── E3: RPC seguro p/ adicionar plantão na escala, com trava de conflito ─────
CREATE OR REPLACE FUNCTION public.adicionar_plantao_escala(
  p_unidade uuid,
  p_setor uuid,
  p_perfil uuid,
  p_data date,
  p_turno text,
  p_rotulo text DEFAULT NULL,
  p_quinzenal boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existente uuid;
  v_id uuid;
BEGIN
  -- Só gestor/super monta escala
  IF NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor pode montar a escala.';
  END IF;

  -- E3: conflito de turno — mesmo perfil, mesma data, mesmo turno em OUTRO setor
  SELECT e.id INTO v_existente
  FROM public.escala_plantao e
  WHERE e.perfil_id = p_perfil
    AND e.data = p_data
    AND e.turno = p_turno
    AND e.setor_id <> p_setor
    AND e.ativo
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: este plantonista já está escalado em outro setor nesta data/turno.';
  END IF;

  INSERT INTO public.escala_plantao
    (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por)
  VALUES (p_unidade, p_setor, p_perfil, p_data, p_turno, p_rotulo, p_quinzenal, true, auth.uid())
  ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este plantão já está preenchido por este plantonista.';
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean) TO authenticated;

-- ── E1: dashboard de carga horária (gestor) ──────────────────────────────────
-- Retorna por plantonista: diurnos, noturnos, horas totais e dias no mês.
CREATE OR REPLACE FUNCTION public.resumo_carga_plantonistas(
  p_unidade uuid,
  p_inicio date,
  p_fim date
)
RETURNS TABLE (
  perfil_id uuid,
  nome text,
  diurnos bigint,
  noturnos bigint,
  horas numeric,
  dias bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH por_dia AS (
    SELECT e.perfil_id, e.data,
           bool_or(e.turno IN ('manha','tarde')) AS tem_diurno,
           bool_or(e.turno = 'noite') AS tem_noturno
    FROM public.escala_plantao e
    WHERE e.unidade_id = p_unidade AND e.ativo
      AND e.data BETWEEN p_inicio AND p_fim
    GROUP BY e.perfil_id, e.data
  )
  SELECT d.perfil_id,
         p.nome_completo AS nome,
         COUNT(*) FILTER (WHERE d.tem_diurno) AS diurnos,
         COUNT(*) FILTER (WHERE d.tem_noturno) AS noturnos,
         (COUNT(*) FILTER (WHERE d.tem_diurno) * 12
          + COUNT(*) FILTER (WHERE d.tem_noturno) * 12)::numeric AS horas,
         COUNT(*) AS dias
  FROM por_dia d
  JOIN public.perfis p ON p.id = d.perfil_id
  GROUP BY d.perfil_id, p.nome_completo
  ORDER BY p.nome_completo;
$$;

GRANT EXECUTE ON FUNCTION public.resumo_carga_plantonistas(uuid, date, date) TO authenticated;
