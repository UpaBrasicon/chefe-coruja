-- Fase 1, tarefa 3 do BACKLOG.md — indicador recepção → triagem.
--
-- Decisões do RT (07/10/2026):
--   • o indicador é da CHEGADA (ficha na recepção) até a TRIAGEM (primeira
--     classificação registrada; a reclassificação não conta) — é a base do
--     alvo e da média/mediana;
--   • a espera até ser CHAMADO para a triagem (primeiro "Chamar") aparece ao
--     lado, para o gestor ter noção da espera na cadeira;
--   • alvo padrão de 10 minutos, configurável por unidade (Unidade ›
--     Configurações), chave alvo_triagem_min;
--   • tela Indicadores, períodos hoje / 7 / 30 dias / intervalo livre.
-- Só números agregados (sem paciente): sem registro de acesso na auditoria.
-- Só aditiva: limites_unidade ganha a chave nova; salvar_alvo_triagem é nova.
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.indicador_espera_triagem(uuid, date, date);
--   DROP FUNCTION IF EXISTS public.salvar_alvo_triagem(uuid, int);
--   reaplicar private.limites_unidade de 20261012000001.

CREATE OR REPLACE FUNCTION private.limites_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'descanso_ativo', coalesce((SELECT lower(btrim(c.valor)) = 'true' FROM public.configuracoes_unidade c
                                 WHERE c.unidade_id = p_unidade AND c.chave = 'descanso_minimo_ativo'), false),
    'descanso_horas', private.config_unidade_int(p_unidade, 'descanso_minimo_horas', 11, 1, 24),
    'sobrecarga_horas', private.config_unidade_int(p_unidade, 'sobrecarga_horas_7d', 60, 12, 168),
    'ocupacao_pct', private.config_unidade_int(p_unidade, 'ocupacao_limite_pct', 85, 50, 100),
    'checkin_tolerancia_min', private.config_unidade_int(p_unidade, 'checkin_tolerancia_min', 30, 0, 120),
    'alvo_triagem_min', private.config_unidade_int(p_unidade, 'alvo_triagem_min', 10, 1, 240),
    'atualizado_em', (SELECT max(c.updated_at) FROM public.configuracoes_unidade c
                       WHERE c.unidade_id = p_unidade
                         AND c.chave IN ('descanso_minimo_ativo', 'descanso_minimo_horas', 'sobrecarga_horas_7d',
                                         'ocupacao_limite_pct', 'checkin_tolerancia_min', 'alvo_triagem_min')))
$$;

CREATE OR REPLACE FUNCTION public.salvar_alvo_triagem(p_unidade uuid, p_minutos int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o alvo da triagem é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_minutos IS NULL OR p_minutos NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Alvo da chegada à triagem entre 1 e 240 minutos.';
  END IF;
  INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
  VALUES (p_unidade, 'alvo_triagem_min', p_minutos::text, 'Tempo-alvo da chegada à triagem (classificação), em minutos')
  ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
  WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  PERFORM private.registrar_auditoria('salvar_alvo_triagem', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvo_triagem_min', p_minutos));
  RETURN private.limites_unidade(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.salvar_alvo_triagem(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_alvo_triagem(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.indicador_espera_triagem(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_alvo int;
  v_res  jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  v_alvo := private.config_unidade_int(p_unidade, 'alvo_triagem_min', 10, 1, 240);

  WITH ep AS (
    SELECT e.id, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia, e.chegada_em,
           (SELECT min(c.criado_em) FROM public.classificacoes_risco c
             WHERE c.episodio_id = e.id AND NOT c.reclassificacao) AS triado_em,
           (SELECT min(ch.criado_em) FROM public.chamadas ch
             WHERE ch.episodio_id = e.id AND ch.etapa = 'triagem') AS chamado_em
      FROM public.episodios e
     WHERE e.unidade_id = p_unidade
       AND e.chegada_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND e.chegada_em <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), t AS (
    SELECT ep.*,
           extract(epoch FROM ep.triado_em - ep.chegada_em) / 60.0 AS min_triagem,
           extract(epoch FROM ep.chamado_em - ep.chegada_em) / 60.0 AS min_chamada
      FROM ep
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'alvo_min', v_alvo,
    'chegadas', count(*),
    'triados', count(*) FILTER (WHERE min_triagem IS NOT NULL),
    'sem_triagem', count(*) FILTER (WHERE min_triagem IS NULL),
    'media_min', round(avg(min_triagem)::numeric, 1),
    'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY min_triagem))::numeric, 1),
    'p90_min', round((percentile_cont(0.9) WITHIN GROUP (ORDER BY min_triagem))::numeric, 1),
    'fora_alvo', count(*) FILTER (WHERE min_triagem > v_alvo),
    'chamada', jsonb_build_object(
      'chamados', count(*) FILTER (WHERE min_chamada IS NOT NULL),
      'media_min', round(avg(min_chamada)::numeric, 1),
      'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY min_chamada))::numeric, 1)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dia', d.dia, 'chegadas', d.chegadas, 'triados', d.triados,
               'media_min', d.media, 'mediana_min', d.mediana, 'fora_alvo', d.fora,
               'chamada_mediana_min', d.ch_mediana) ORDER BY d.dia)
        FROM (SELECT t2.dia, count(*) AS chegadas, count(t2.min_triagem) AS triados,
                     round(avg(t2.min_triagem)::numeric, 1) AS media,
                     round((percentile_cont(0.5) WITHIN GROUP (ORDER BY t2.min_triagem))::numeric, 1) AS mediana,
                     count(*) FILTER (WHERE t2.min_triagem > v_alvo) AS fora,
                     round((percentile_cont(0.5) WITHIN GROUP (ORDER BY t2.min_chamada))::numeric, 1) AS ch_mediana
                FROM t t2 GROUP BY t2.dia) d), '[]'::jsonb))
    INTO v_res
    FROM t;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_espera_triagem(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_espera_triagem(uuid, date, date) TO authenticated;
