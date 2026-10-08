-- Fase 1, tarefa 5 do BACKLOG.md — pacientes por classificação de risco.
--
-- Decisões do RT (07/10/2026):
--   • cada paciente conta na COR FINAL (última classificação); à parte, quantos
--     foram reclassificados e se a cor subiu (mais grave) ou baixou;
--   • filtros: período, setor de entrada (setor do episódio na porta),
--     adulto/pediátrico (grupo da classificação) e turno pela hora de chegada
--     (manhã 07–13, tarde 13–19, noite 19–07 — as janelas da escala);
--   • barras por cor (com "sem classificação") e tabela por dia, com CSV;
--   • tela Indicadores.
-- Só números agregados (sem paciente): sem registro de acesso na auditoria.
-- Só aditiva.
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.pacientes_por_cor(uuid, date, date, uuid, text, text);
CREATE OR REPLACE FUNCTION public.pacientes_por_cor(
  p_unidade uuid, p_de date, p_ate date,
  p_setor uuid DEFAULT NULL, p_publico text DEFAULT NULL, p_turno text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_res jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  IF p_publico IS NOT NULL AND p_publico NOT IN ('adulto', 'pediatrico') THEN RAISE EXCEPTION 'Grupo inválido.'; END IF;
  IF p_turno IS NOT NULL AND p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Turno inválido.'; END IF;

  WITH ep AS (
    SELECT e.id, e.setor_id, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo') AS local,
           (SELECT c.cor FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em ASC LIMIT 1) AS cor_entrada,
           (SELECT c.cor FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) AS cor_final,
           (SELECT c.publico FROM public.classificacoes_risco c WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) AS publico,
           EXISTS (SELECT 1 FROM public.classificacoes_risco c WHERE c.episodio_id = e.id AND c.reclassificacao) AS reclassificado
      FROM public.episodios e
     WHERE e.unidade_id = p_unidade
       AND e.chegada_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND e.chegada_em <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND (p_setor IS NULL OR e.setor_id = p_setor)
  ), f AS (
    SELECT ep.*, ep.local::date AS dia,
           CASE WHEN ep.local::time >= time '07:00' AND ep.local::time < time '13:00' THEN 'manha'
                WHEN ep.local::time >= time '13:00' AND ep.local::time < time '19:00' THEN 'tarde'
                ELSE 'noite' END AS turno,
           -- gravidade: vermelho 5 … azul 1
           array_position(ARRAY['azul', 'verde', 'amarelo', 'laranja', 'vermelho'], ep.cor_entrada) AS g_entrada,
           array_position(ARRAY['azul', 'verde', 'amarelo', 'laranja', 'vermelho'], ep.cor_final) AS g_final
      FROM ep
  ), s AS (
    SELECT * FROM f
     WHERE (p_turno IS NULL OR f.turno = p_turno)
       AND (p_publico IS NULL OR f.publico = p_publico)
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor', p_setor, 'publico', p_publico, 'turno', p_turno,
    'total', count(*),
    'por_cor', jsonb_build_object(
      'vermelho', count(*) FILTER (WHERE cor_final = 'vermelho'),
      'laranja',  count(*) FILTER (WHERE cor_final = 'laranja'),
      'amarelo',  count(*) FILTER (WHERE cor_final = 'amarelo'),
      'verde',    count(*) FILTER (WHERE cor_final = 'verde'),
      'azul',     count(*) FILTER (WHERE cor_final = 'azul'),
      'sem_classificacao', count(*) FILTER (WHERE cor_final IS NULL)),
    'reclassificados', jsonb_build_object(
      'total',   count(*) FILTER (WHERE reclassificado),
      'subiram', count(*) FILTER (WHERE reclassificado AND g_final > g_entrada),
      'baixaram', count(*) FILTER (WHERE reclassificado AND g_final < g_entrada)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dia', d.dia, 'total', d.total, 'vermelho', d.vm, 'laranja', d.la, 'amarelo', d.am,
               'verde', d.ve, 'azul', d.az, 'sem_classificacao', d.sem) ORDER BY d.dia)
        FROM (SELECT x.dia, count(*) AS total,
                     count(*) FILTER (WHERE x.cor_final = 'vermelho') AS vm,
                     count(*) FILTER (WHERE x.cor_final = 'laranja') AS la,
                     count(*) FILTER (WHERE x.cor_final = 'amarelo') AS am,
                     count(*) FILTER (WHERE x.cor_final = 'verde') AS ve,
                     count(*) FILTER (WHERE x.cor_final = 'azul') AS az,
                     count(*) FILTER (WHERE x.cor_final IS NULL) AS sem
                FROM s x GROUP BY x.dia) d), '[]'::jsonb),
    -- setores de entrada da unidade, para o filtro
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', st.id, 'nome', st.nome) ORDER BY st.ordem, st.nome)
        FROM public.setores st
       WHERE st.unidade_id = p_unidade AND st.ativo
         AND EXISTS (SELECT 1 FROM public.episodios e2 WHERE e2.setor_id = st.id)), '[]'::jsonb))
    INTO v_res
    FROM s;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.pacientes_por_cor(uuid, date, date, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pacientes_por_cor(uuid, date, date, uuid, text, text) TO authenticated;
