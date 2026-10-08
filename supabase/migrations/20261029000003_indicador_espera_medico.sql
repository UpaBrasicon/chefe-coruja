-- Fase 1, tarefa 4 do BACKLOG.md — indicador triagem → médico.
--
-- Decisões do RT (07/10/2026):
--   • a espera conta da PRIMEIRA classificação até o médico abrir o
--     atendimento; a cor (e o alvo) é a da classificação mais recente antes do
--     médico — quem piorou e esperou aparece como atraso;
--   • os tempos-alvo por cor podem ser ajustados pela unidade (Unidade ›
--     Configurações); sem ajuste vale o protocolo de classificação da unidade;
--     sem protocolo, Manchester (0/10/60/120/240). Vale também na tela Porta;
--   • tela Indicadores, ao lado da tarefa 3; lista dos atrasados do período
--     COM NOME, com o acesso registrado na auditoria (a cada 15 min no máximo).
-- Só aditiva: porta_agora passa a usar os alvos da unidade e a contar desde a
-- 1ª classificação; funções novas para o resto.
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.indicador_espera_medico(uuid, date, date),
--   public.salvar_alvos_medico(uuid, jsonb), private.tempos_alvo_unidade(uuid);
--   reaplicar porta_agora de 20261029000001 e limites_unidade de 20261029000002.

-- ── alvos por cor: unidade › protocolo › Manchester ────────────────────────
CREATE OR REPLACE FUNCTION private.tempos_alvo_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH base AS (
    SELECT coalesce((SELECT p.tempos FROM public.unidades u
                       JOIN public.protocolos_classificacao p ON p.id = u.protocolo_classificacao_id
                      WHERE u.id = p_unidade),
                    '{"vermelho": 0, "laranja": 10, "amarelo": 60, "verde": 120, "azul": 240}'::jsonb) AS t
  )
  SELECT jsonb_object_agg(c.cor, private.config_unidade_int(p_unidade, 'alvo_medico_' || c.cor,
                                   coalesce((base.t ->> c.cor)::int, 0), 0, 1440))
    FROM base, unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul']) AS c(cor)
$$;
REVOKE ALL ON FUNCTION private.tempos_alvo_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tempos_alvo_unidade(uuid) TO authenticated;

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
    'alvos_medico', private.tempos_alvo_unidade(p_unidade),
    'atualizado_em', (SELECT max(c.updated_at) FROM public.configuracoes_unidade c
                       WHERE c.unidade_id = p_unidade
                         AND (c.chave IN ('descanso_minimo_ativo', 'descanso_minimo_horas', 'sobrecarga_horas_7d',
                                          'ocupacao_limite_pct', 'checkin_tolerancia_min', 'alvo_triagem_min')
                              OR c.chave LIKE 'alvo\_medico\_%')))
$$;

-- o gestor ajusta os 5 alvos; igual ao protocolo = sem ajuste (a chave sai)
CREATE OR REPLACE FUNCTION public.salvar_alvos_medico(p_unidade uuid, p_alvos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_proto jsonb;
  c text;
  v int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os alvos são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT coalesce((SELECT p.tempos FROM public.unidades u JOIN public.protocolos_classificacao p ON p.id = u.protocolo_classificacao_id
                    WHERE u.id = p_unidade), '{"vermelho": 0, "laranja": 10, "amarelo": 60, "verde": 120, "azul": 240}'::jsonb)
    INTO v_proto;
  FOREACH c IN ARRAY ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'] LOOP
    IF p_alvos IS NULL OR NOT (p_alvos ? c) OR jsonb_typeof(p_alvos -> c) <> 'number' THEN
      RAISE EXCEPTION 'Informe o alvo da cor %.', c;
    END IF;
    v := (p_alvos ->> c)::numeric::int;
    IF v NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'Alvo da cor % entre 0 e 1440 minutos.', c; END IF;
    IF v = coalesce((v_proto ->> c)::int, -1) THEN
      DELETE FROM public.configuracoes_unidade WHERE unidade_id = p_unidade AND chave = 'alvo_medico_' || c;
    ELSE
      INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
      VALUES (p_unidade, 'alvo_medico_' || c, v::text, 'Tempo-alvo da classificação ao médico, cor ' || c || ', em minutos')
      ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
      WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
    END IF;
  END LOOP;
  PERFORM private.registrar_auditoria('salvar_alvos_medico', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvos', private.tempos_alvo_unidade(p_unidade)));
  RETURN private.limites_unidade(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.salvar_alvos_medico(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_alvos_medico(uuid, jsonb) TO authenticated;

-- ── indicador do período ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.indicador_espera_medico(p_unidade uuid, p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tempos jsonb;
  v_res    jsonb;
  v_ator   uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  v_tempos := private.tempos_alvo_unidade(p_unidade);

  WITH ep AS (
    SELECT e.id, pa.nome, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia, e.chegada_em,
           e.atendimento_iniciado_em AS atendido_em, e.encerrado_em, e.desfecho,
           (SELECT min(c.criado_em) FROM public.classificacoes_risco c
             WHERE c.episodio_id = e.id AND NOT c.reclassificacao) AS classificado_em
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
     WHERE e.unidade_id = p_unidade
       AND e.chegada_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND e.chegada_em <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), t AS (
    SELECT ep.*,
           -- cor da classificação mais recente antes do médico (ou até agora)
           (SELECT c.cor FROM public.classificacoes_risco c
             WHERE c.episodio_id = ep.id AND c.criado_em <= coalesce(ep.atendido_em, now())
             ORDER BY c.criado_em DESC LIMIT 1) AS cor,
           extract(epoch FROM ep.atendido_em - ep.classificado_em) / 60.0 AS espera,
           -- sem médico: a espera vai até o encerramento (evasão…) ou até agora
           extract(epoch FROM coalesce(ep.atendido_em, ep.encerrado_em, now()) - ep.classificado_em) / 60.0 AS espera_ate_fim
      FROM ep
     WHERE ep.classificado_em IS NOT NULL
  ), m AS (
    SELECT t.*, (v_tempos ->> t.cor)::int AS alvo,
           t.espera_ate_fim > coalesce((v_tempos ->> t.cor)::int, 1e9) AS atrasou
      FROM t
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'alvos', v_tempos,
    'classificados', count(*),
    'atendidos', count(*) FILTER (WHERE espera IS NOT NULL),
    'sem_medico', count(*) FILTER (WHERE espera IS NULL),
    'media_min', round(avg(espera)::numeric, 1),
    'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY espera))::numeric, 1),
    'fora_alvo', count(*) FILTER (WHERE atrasou),
    'por_cor', (SELECT jsonb_object_agg(c.cor, jsonb_build_object(
                  'alvo_min', (v_tempos ->> c.cor)::int,
                  'atendidos', (SELECT count(*) FROM m x WHERE x.cor = c.cor AND x.espera IS NOT NULL),
                  'mediana_min', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY x.espera))::numeric, 1) FROM m x WHERE x.cor = c.cor),
                  'media_min', (SELECT round(avg(x.espera)::numeric, 1) FROM m x WHERE x.cor = c.cor),
                  'fora_alvo', (SELECT count(*) FROM m x WHERE x.cor = c.cor AND x.atrasou),
                  'sem_medico', (SELECT count(*) FROM m x WHERE x.cor = c.cor AND x.espera IS NULL)))
                 FROM unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul']) AS c(cor)),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', d.dia, 'atendidos', d.atendidos, 'mediana_min', d.mediana,
                                          'media_min', d.media, 'fora_alvo', d.fora) ORDER BY d.dia)
        FROM (SELECT x.dia, count(x.espera) AS atendidos,
                     round((percentile_cont(0.5) WITHIN GROUP (ORDER BY x.espera))::numeric, 1) AS mediana,
                     round(avg(x.espera)::numeric, 1) AS media,
                     count(*) FILTER (WHERE x.atrasou) AS fora
                FROM m x GROUP BY x.dia) d), '[]'::jsonb),
    'atrasados', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'nome', a.nome, 'cor', a.cor, 'chegada_em', a.chegada_em, 'classificado_em', a.classificado_em,
               'atendido_em', a.atendido_em, 'espera_min', floor(a.espera_ate_fim)::int, 'alvo_min', a.alvo,
               'sem_medico', a.espera IS NULL, 'desfecho', a.desfecho)
             ORDER BY a.espera_ate_fim - coalesce(a.alvo, 0) DESC)
        FROM (SELECT * FROM m WHERE atrasou ORDER BY espera_ate_fim - coalesce(alvo, 0) DESC LIMIT 200) a), '[]'::jsonb))
    INTO v_res
    FROM m;

  -- nome de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_res -> 'atrasados') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_atrasos_medico'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_atrasos_medico', 'episodios', NULL, p_unidade,
      jsonb_build_object('de', p_de, 'ate', p_ate, 'pacientes', jsonb_array_length(v_res -> 'atrasados')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_espera_medico(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_espera_medico(uuid, date, date) TO authenticated;

-- ── a tela Porta passa a usar os alvos da unidade e a 1ª classificação ─────
CREATE OR REPLACE FUNCTION public.porta_agora(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje   timestamptz := private.data_atual()::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_tempos jsonb;
  v_lista  jsonb;
  v_etapas jsonb;
  v_cores  jsonb;
  v_altas  int;
  v_obs6h  int;
  v_ator   uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade vê a porta.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- tempo-alvo até o médico, por cor (ajuste da unidade › protocolo › Manchester)
  v_tempos := private.tempos_alvo_unidade(p_unidade);

  WITH ativos AS (
    -- porta: triagem e atendimento
    SELECT e.id AS episodio_id, pa.nome, e.cor_atual AS cor,
           CASE WHEN e.etapa = 'triagem' THEN 'triagem'
                WHEN e.atendimento_iniciado_em IS NULL THEN 'aguardando_medico'
                ELSE 'em_atendimento' END AS etapa,
           s.nome AS setor, NULL::text AS leito,
           CASE WHEN e.etapa = 'triagem' THEN e.chegada_em
                -- desde a 1ª classificação (decisão do RT, tarefa 4): a reclassificação não zera a espera
                WHEN e.atendimento_iniciado_em IS NULL THEN coalesce(
                  (SELECT min(c.criado_em) FROM public.classificacoes_risco c WHERE c.episodio_id = e.id AND NOT c.reclassificacao),
                  e.classificado_em, e.chegada_em)
                ELSE e.atendimento_iniciado_em END AS desde,
           NULL::timestamptz AS prazo
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
      LEFT JOIN public.setores s ON s.id = e.setor_id
     WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento')
    UNION ALL
    -- observação: setor e leito/poltrona atuais; prazo de 6 h da pendência
    SELECT i.episodio_id, pa.nome, ep.cor_atual, 'observacao',
           s.nome, l.identificador,
           coalesce(po.criada_em, i.data_entrada_setor, i.data_admissao),
           coalesce(po.prazo, coalesce(po.criada_em, i.data_entrada_setor, i.data_admissao) + interval '6 hours')
      FROM public.internacoes i
      JOIN public.pacientes pa ON pa.id = i.paciente_id
      LEFT JOIN public.episodios ep ON ep.id = i.episodio_id
      LEFT JOIN public.setores s ON s.id = i.setor_atual_id
      LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
      LEFT JOIN LATERAL (
        SELECT x.criada_em, x.prazo FROM public.pendencias x
         WHERE x.internacao_id = i.id AND x.tipo = 'observacao'
         ORDER BY (x.situacao = 'aberta') DESC, x.criada_em DESC LIMIT 1) po ON true
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao')
       AND private.setor_de_observacao(i.setor_atual_id)
  ), marcados AS (
    SELECT a.*,
           floor(extract(epoch FROM now() - a.desde) / 60)::int AS espera_min,
           CASE WHEN a.etapa = 'aguardando_medico' AND a.cor IS NOT NULL AND v_tempos ? a.cor
                  THEN now() - a.desde > make_interval(mins => (v_tempos ->> a.cor)::int)
                WHEN a.etapa = 'observacao' THEN now() > a.prazo
                ELSE false END AS fora_alvo,
           a.episodio_id IS NOT NULL AND a.etapa IN ('em_atendimento', 'aguardando_medico', 'observacao')
             AND cardinality(coalesce(private.medicacao_sem_checagem(a.episodio_id), '{}')) > 0 AS medicacao_pendente
      FROM ativos a
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'nome', m.nome, 'etapa', m.etapa, 'cor', m.cor, 'setor', m.setor, 'leito', m.leito,
      'espera_min', m.espera_min, 'fora_alvo', m.fora_alvo, 'medicacao_pendente', m.medicacao_pendente)
      ORDER BY CASE m.etapa WHEN 'triagem' THEN 1 WHEN 'aguardando_medico' THEN 2 WHEN 'em_atendimento' THEN 3 ELSE 4 END,
               m.fora_alvo DESC, m.espera_min DESC), '[]'::jsonb),
    jsonb_build_object(
      'triagem',            jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'triagem'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'triagem')),
      'aguardando_medico',  jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'aguardando_medico'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'aguardando_medico'),
                                               'fora_alvo', count(*) FILTER (WHERE m.etapa = 'aguardando_medico' AND m.fora_alvo)),
      'em_atendimento',     jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'em_atendimento'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'em_atendimento')),
      'medicacao_pendente', jsonb_build_object('n', count(*) FILTER (WHERE m.medicacao_pendente)),
      'observacao',         jsonb_build_object('n', count(*) FILTER (WHERE m.etapa = 'observacao'),
                                               'espera_max_min', max(m.espera_min) FILTER (WHERE m.etapa = 'observacao'),
                                               'acima_6h', count(*) FILTER (WHERE m.etapa = 'observacao' AND m.fora_alvo))),
    (SELECT coalesce(jsonb_object_agg(c.cor, jsonb_build_object(
              'n', (SELECT count(*) FROM marcados x WHERE x.etapa = 'aguardando_medico' AND x.cor = c.cor),
              'fora_alvo', (SELECT count(*) FROM marcados x WHERE x.etapa = 'aguardando_medico' AND x.cor = c.cor AND x.fora_alvo),
              'alvo_min', (v_tempos ->> c.cor)::int)), '{}'::jsonb)
       FROM unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul']) AS c(cor)),
    count(*) FILTER (WHERE m.etapa = 'observacao' AND m.fora_alvo)
    INTO v_lista, v_etapas, v_cores, v_obs6h
    FROM marcados m;

  -- altas de hoje: na porta e de observação/internação da unidade
  SELECT (SELECT count(*) FROM public.episodios e
           WHERE e.unidade_id = p_unidade AND e.desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido')
             AND e.desfecho_em >= v_hoje)
       + (SELECT count(*) FROM public.internacoes i
           WHERE i.unidade_id = p_unidade AND i.status IN ('alta_melhorada', 'alta_pedido')
             AND i.data_alta >= v_hoje)
    INTO v_altas;
  v_etapas := v_etapas || jsonb_build_object('altas_hoje', jsonb_build_object('n', v_altas));

  -- dado de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min)
  IF jsonb_array_length(v_lista) > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_porta_agora'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_porta_agora', 'episodios', NULL, p_unidade,
      jsonb_build_object('pacientes', jsonb_array_length(v_lista)));
  END IF;

  RETURN jsonb_build_object('gerado_em', now(), 'tempos', v_tempos, 'etapas', v_etapas,
                            'aguardando_por_cor', v_cores, 'observacao_acima_6h', v_obs6h,
                            'pacientes', v_lista);
END; $$;
REVOKE ALL ON FUNCTION public.porta_agora(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.porta_agora(uuid) TO authenticated;
