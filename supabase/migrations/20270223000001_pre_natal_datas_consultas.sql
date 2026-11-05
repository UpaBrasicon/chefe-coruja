-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 7, pré-natal, parte 2 (opção B da tela, RT em 05/11/2026: linha
-- do tempo da gestação, ref. Wrike Gantt). A linha do tempo marca cada
-- consulta; o banco devolvia só a contagem.
--
-- Expand: private.pre_natal_registros passa a devolver também 'datas_consultas'
-- (as datas das consultas da gestação, em ordem). Nada sai nem muda de nome; o
-- corpo é o da 20270222000001 com esse campo a mais. Idempotente.
-- Teste: supabase/tests/5a_pre_natal.sql (seção 3).
--
-- Rollback: reaplicar o CREATE OR REPLACE de private.pre_natal_registros da
-- migration 20270222000001 (sem 'datas_consultas'); a tela continua de pé sem
-- o campo (mostra só a contagem).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.pre_natal_registros(p_gestacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g public.pre_natal_gestacoes;
  v_fim date;
  v_out jsonb;
  v_primeira date; v_consultas int; v_puerperio date; v_pa int; v_peso_altura int;
  v_t1 jsonb; v_t3 jsonb; v_datas jsonb;
BEGIN
  SELECT * INTO g FROM public.pre_natal_gestacoes WHERE id = p_gestacao;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_fim := private.pre_natal_fim(g.dum, g.desfecho_em);
  v_out := jsonb_build_object(
    'id', g.id, 'origem', g.origem, 'entrada_em', g.entrada_em,
    'dum', g.dum, 'dpp', g.dum + 280, 'fim_gestacao', v_fim, 'puerperio_ate', v_fim + 42,
    'desfecho', g.desfecho, 'desfecho_em', g.desfecho_em,
    'proxima_consulta', (SELECT min(a.inicio) FROM public.agendamentos a
                          WHERE a.paciente_id = g.paciente_id AND a.tipo = 'consulta' AND a.situacao = 'agendado' AND a.inicio > now()));
  -- sem DUM não há janela: o painel pede a DUM
  IF g.dum IS NULL THEN RETURN v_out; END IF;

  -- (A), (B), (I): consulta da UBS por médico ou enfermeiro, com a condição da nota
  SELECT min(c.d) FILTER (WHERE c.gest AND c.d BETWEEN g.dum AND v_fim),
         count(*) FILTER (WHERE c.gest AND c.d BETWEEN g.dum AND v_fim),
         min(c.d) FILTER (WHERE c.puerp AND c.d > v_fim AND c.d <= v_fim + 42),
         coalesce(jsonb_agg(c.d ORDER BY c.d) FILTER (WHERE c.gest AND c.d BETWEEN g.dum AND v_fim), '[]'::jsonb)
    INTO v_primeira, v_consultas, v_puerperio, v_datas
    FROM (SELECT (e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date AS d,
                 private.pre_natal_gestacao_na_consulta(e.problemas_aps, e.cid_aps, e.ciap_aps) AS gest,
                 private.pre_natal_puerperio_na_consulta(e.problemas_aps, e.cid_aps, e.ciap_aps) AS puerp
            FROM public.episodios e
           WHERE e.paciente_id = g.paciente_id AND e.tipo_atendimento_aps IS NOT NULL
             AND e.conduta_aps IS NOT NULL AND e.encerrado_em IS NOT NULL) c;

  -- (C) aferições de pressão arterial na gestação
  SELECT count(*) INTO v_pa
    FROM public.observacao o JOIN public.conceito k ON k.id = o.conceito_id
   WHERE o.paciente_id = g.paciente_id AND k.nome = 'pressao-arterial-sistolica'
     AND (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN g.dum AND v_fim;

  -- (D) peso e altura no mesmo dia, na gestação (um por dia)
  SELECT count(DISTINCT (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date) INTO v_peso_altura
    FROM public.observacao o JOIN public.conceito k ON k.id = o.conceito_id
   WHERE o.paciente_id = g.paciente_id AND k.nome = 'peso'
     AND (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN g.dum AND v_fim
     AND EXISTS (SELECT 1 FROM public.observacao o2 JOIN public.conceito k2 ON k2.id = o2.conceito_id
                  WHERE o2.paciente_id = g.paciente_id AND k2.nome = 'estatura'
                    AND (o2.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date = (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date);

  -- (G) e (H): teste rápido realizado ou exame com resultado, pelo código da nota
  WITH t AS (
    SELECT private.pre_natal_grupo_teste(p.procedimento) AS grupo, (p.realizado_em AT TIME ZONE 'America/Sao_Paulo')::date AS d
      FROM public.procedimentos_realizados p
     WHERE p.paciente_id = g.paciente_id AND p.cancelado_em IS NULL
    UNION ALL
    SELECT private.pre_natal_grupo_teste(x.procedimento), (r.liberado_em AT TIME ZONE 'America/Sao_Paulo')::date
      FROM public.exames_pedidos x JOIN public.exame_resultados r ON r.exame_id = x.id AND r.vigente
     WHERE x.paciente_id = g.paciente_id AND x.situacao IS DISTINCT FROM 'cancelado')
  SELECT coalesce(jsonb_object_agg(grupo, d1) FILTER (WHERE d1 IS NOT NULL), '{}'::jsonb),
         coalesce(jsonb_object_agg(grupo, d3) FILTER (WHERE d3 IS NOT NULL AND grupo IN ('sifilis', 'hiv')), '{}'::jsonb)
    INTO v_t1, v_t3
    FROM (SELECT grupo,
                 min(d) FILTER (WHERE d BETWEEN g.dum AND least(g.dum + 97, v_fim)) AS d1,
                 min(d) FILTER (WHERE d BETWEEN g.dum + 196 AND v_fim) AS d3
            FROM t WHERE grupo IS NOT NULL GROUP BY grupo) s;

  RETURN v_out || jsonb_build_object(
    'primeira_consulta', v_primeira, 'consultas', v_consultas, 'datas_consultas', v_datas, 'pa', v_pa, 'peso_altura', v_peso_altura,
    'testes_1tri', v_t1, 'testes_3tri', v_t3, 'consulta_puerperio', v_puerperio);
END $$;

REVOKE ALL ON FUNCTION private.pre_natal_registros(uuid) FROM PUBLIC, anon, authenticated;
