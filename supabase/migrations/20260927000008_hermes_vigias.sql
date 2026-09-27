-- ════════════════════════════════════════════════════════════════════════════
-- Hermes (rodada D) — verificações dos agentes novos. Só números e IDs; sem
-- identidade de paciente. Só o service role executa.
--   • Porta: resumo do plantão (atendidos, dentro do tempo-alvo por cor,
--     espera média, evasões) — para o gestor na virada do plantão;
--   • Presença: plantão começou há 15–60 min e a pessoa não fez check-in;
--   • Buraco na escala: horas das próximas 24 h sem ninguém num setor;
--   • Registros tardios parados há mais de 24 h na revisão;
--   • Guardião do prontuário: aberturas/impressões fora do padrão por pessoa;
--   • Cadeia de auditoria: primeira linha adulterada (NULL = íntegra).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.hermes_porta_resumo(p_unidade uuid, p_horas integer DEFAULT 12)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH alvo AS (
    SELECT coalesce(p.tempos, '{"vermelho":0,"laranja":10,"amarelo":60,"verde":120,"azul":240}'::jsonb) AS t
    FROM public.unidades u LEFT JOIN public.protocolos_classificacao p ON p.id = u.protocolo_classificacao_id
    WHERE u.id = p_unidade
  ), atendidos AS (
    SELECT e.cor_atual AS cor,
           extract(epoch FROM (e.atendimento_iniciado_em - e.classificado_em)) / 60 AS espera_min
    FROM public.episodios e
    WHERE e.unidade_id = p_unidade AND e.atendimento_iniciado_em > now() - make_interval(hours => p_horas)
      AND e.classificado_em IS NOT NULL
  )
  SELECT jsonb_build_object(
    'janela_horas', p_horas,
    'fichas', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade AND e.chegada_em > now() - make_interval(hours => p_horas)),
    'atendidos', (SELECT count(*) FROM atendidos),
    'por_cor', (SELECT coalesce(jsonb_object_agg(x.cor, jsonb_build_object('atendidos', x.n, 'dentro_do_alvo', x.dentro, 'espera_media_min', x.media)), '{}')
                FROM (SELECT a.cor, count(*) AS n,
                             count(*) FILTER (WHERE a.espera_min <= ((SELECT t FROM alvo) ->> a.cor)::numeric) AS dentro,
                             round(avg(a.espera_min)) AS media
                      FROM atendidos a GROUP BY a.cor) x),
    'evasoes', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade AND e.desfecho = 'evasao'
                  AND coalesce(e.desfecho_em, e.encerrado_em) > now() - make_interval(hours => p_horas)),
    'aguardando_agora', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade
                          AND (e.etapa = 'triagem' OR (e.etapa = 'atendimento' AND e.atendimento_iniciado_em IS NULL)))
  );
$$;

CREATE OR REPLACE FUNCTION public.hermes_checkin_pendente()
RETURNS TABLE (perfil_id uuid, unidade_id uuid, setor text, inicio_brasilia text, escala_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (e.perfil_id, e.unidade_id)
         e.perfil_id, e.unidade_id, s.nome, to_char(e.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), e.id
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id
  WHERE e.ativo
    AND e.inicio BETWEEN now() - interval '60 minutes' AND now() - interval '15 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.presenca_plantonista p
      WHERE p.perfil_id = e.perfil_id AND p.unidade_id = e.unidade_id
        AND p.checkin_em >= e.inicio - interval '2 hours')
  ORDER BY e.perfil_id, e.unidade_id, e.inicio;
$$;

CREATE OR REPLACE FUNCTION public.hermes_buracos_escala(p_horas integer DEFAULT 24)
RETURNS TABLE (unidade_id uuid, setor text, horas_sem_ninguem bigint, primeira_hora_brasilia text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.unidade_id, s.nome, count(*),
         to_char(min(h) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
  FROM public.setores s
  CROSS JOIN generate_series(date_trunc('hour', now()) + interval '1 hour',
                             date_trunc('hour', now()) + make_interval(hours => p_horas), interval '1 hour') h
  WHERE s.ativo AND s.tipo IN ('emergencia', 'observacao', 'internacao')
    AND NOT EXISTS (
      SELECT 1 FROM public.escala_plantao e
      WHERE e.setor_id = s.id AND e.ativo
        AND e.inicio <= h AND h < e.inicio + make_interval(mins => e.duracao_min))
  GROUP BY s.unidade_id, s.nome, s.ordem
  ORDER BY s.unidade_id, s.ordem;
$$;

CREATE OR REPLACE FUNCTION public.hermes_revisoes_paradas()
RETURNS TABLE (unidade_id uuid, pendentes bigint, mais_antiga_brasilia text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.unidade_id, count(*), to_char(min(r.recebido_em) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
  FROM public.sincronizacao_revisao r
  WHERE r.decisao IS NULL AND r.recebido_em < now() - interval '24 hours'
  GROUP BY r.unidade_id;
$$;

CREATE OR REPLACE FUNCTION public.hermes_acessos_anomalos(p_horas integer DEFAULT 24, p_aberturas integer DEFAULT 80, p_impressoes integer DEFAULT 40)
RETURNS TABLE (perfil_id uuid, unidade_id uuid, aberturas bigint, impressoes bigint, pacientes_distintos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.acessado_por, l.unidade_id,
         count(*) FILTER (WHERE l.tipo_acesso = 'leitura_prontuario'),
         count(*) FILTER (WHERE l.tipo_acesso = 'impressao'),
         count(DISTINCT l.paciente_id)
  FROM public.log_acesso_prontuario l
  WHERE l.created_at > now() - make_interval(hours => p_horas)
  GROUP BY l.acessado_por, l.unidade_id
  HAVING count(*) FILTER (WHERE l.tipo_acesso = 'leitura_prontuario') > p_aberturas
      OR count(*) FILTER (WHERE l.tipo_acesso = 'impressao') > p_impressoes;
$$;

CREATE OR REPLACE FUNCTION public.hermes_cadeia_auditoria()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.verificar_cadeia_auditoria();
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['hermes_porta_resumo(uuid,integer)', 'hermes_checkin_pendente()', 'hermes_buracos_escala(integer)',
                           'hermes_revisoes_paradas()', 'hermes_acessos_anomalos(integer,integer,integer)', 'hermes_cadeia_auditoria()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
