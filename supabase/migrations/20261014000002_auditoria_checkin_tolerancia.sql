-- ════════════════════════════════════════════════════════════════════════════
-- Auditoria de check-in do gestor com a tolerância da unidade.
--
-- A auditoria (20261006000001) marcava atraso a partir de 15 min fixos; o
-- bloqueio de acesso sem check-in (20261014000001) usa a tolerância da unidade
-- (configuracoes_unidade.checkin_tolerancia_min, padrão 30). As duas passam a
-- usar o mesmo número: "aguardando" dentro da tolerância, "atraso" depois dela.
-- Mesma função, só o intervalo trocado. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auditoria_checkin(p_unidade uuid, p_data date DEFAULT NULL)
RETURNS TABLE (plantao_id uuid, presenca_id uuid, perfil_id uuid, nome text, papel text, setor text, turno text,
               previsto timestamptz, fim_previsto timestamptz, realizado timestamptz, diferenca_min int,
               dentro boolean, distancia_m int, justificativa text, situacao text, divergente boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_data date := coalesce(p_data, private.data_atual());
  -- a mesma tolerância que bloqueia o acesso sem check-in (20261014000001)
  v_tol int := private.config_unidade_int(p_unidade, 'checkin_tolerancia_min', 30, 0, 120);
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a auditoria de check-in é do gestor da unidade.';
  END IF;

  RETURN QUERY
  WITH pl AS (
    SELECT e.* FROM public.escala_plantao e
     WHERE e.unidade_id = p_unidade AND e.ativo AND e.data = v_data AND e.perfil_id IS NOT NULL
  ), casado AS (
    SELECT pl.id AS pid, pl.perfil_id AS perf, pl.setor_id, pl.turno AS pturno, pl.inicio,
           pl.inicio + make_interval(mins => pl.duracao_min) AS fim, pr.*
      FROM pl
      LEFT JOIN LATERAL (
        SELECT x.id AS prid, x.checkin_em, x.checkin_dentro, x.checkin_distancia_m, x.checkin_justificativa
          FROM public.presenca_plantonista x
         WHERE x.unidade_id = p_unidade
           AND (x.escala_plantao_id = pl.id
                OR (x.perfil_id = pl.perfil_id AND x.data = pl.data AND x.turno = pl.turno))
         ORDER BY (x.escala_plantao_id = pl.id) DESC NULLS LAST, x.checkin_em DESC NULLS LAST
         LIMIT 1) pr ON true
  ), linhas AS (
    SELECT c.pid, c.prid, c.perf, c.setor_id, c.pturno, c.inicio, c.fim, c.checkin_em,
           c.checkin_dentro, c.checkin_distancia_m, c.checkin_justificativa,
           CASE
             WHEN c.checkin_em IS NULL THEN
               CASE WHEN now() < c.inicio THEN 'a_comecar'
                    WHEN now() < c.inicio + make_interval(mins => v_tol) THEN 'aguardando'
                    ELSE 'sem_checkin' END
             WHEN c.checkin_em > c.inicio + make_interval(mins => v_tol) AND c.checkin_dentro IS FALSE THEN 'atraso_fora_do_raio'
             WHEN c.checkin_em > c.inicio + make_interval(mins => v_tol) THEN 'atraso'
             WHEN c.checkin_dentro IS FALSE THEN 'fora_do_raio'
             ELSE 'confere'
           END AS sit
      FROM casado c
    UNION ALL
    -- check-in do dia sem plantão na escala
    SELECT NULL, x.id, x.perfil_id, NULL, x.turno, NULL, NULL, x.checkin_em,
           x.checkin_dentro, x.checkin_distancia_m, x.checkin_justificativa, 'sem_escala'
      FROM public.presenca_plantonista x
     WHERE x.unidade_id = p_unidade AND x.data = v_data AND x.checkin_em IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM casado c WHERE c.prid = x.id)
  )
  SELECT l.pid, l.prid, l.perf, pf.nome_completo,
         (SELECT v.papel::text FROM public.vinculos v
           WHERE v.perfil_id = l.perf AND v.unidade_id = p_unidade AND v.ativo
           ORDER BY v.papel LIMIT 1),
         s.nome, l.pturno, l.inicio, l.fim, l.checkin_em,
         CASE WHEN l.inicio IS NOT NULL AND l.checkin_em IS NOT NULL
              THEN round(extract(epoch FROM l.checkin_em - l.inicio) / 60)::int END,
         l.checkin_dentro, l.checkin_distancia_m, l.checkin_justificativa, l.sit,
         l.sit IN ('atraso_fora_do_raio', 'atraso', 'fora_do_raio', 'sem_checkin', 'sem_escala')
    FROM linhas l
    JOIN public.perfis pf ON pf.id = l.perf
    LEFT JOIN public.setores s ON s.id = l.setor_id
   ORDER BY l.inicio NULLS LAST, pf.nome_completo;
END $$;
