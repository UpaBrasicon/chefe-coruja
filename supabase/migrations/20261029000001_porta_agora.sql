-- Fase 1, tarefa 2 do BACKLOG.md — Dashboard PS/UPA ("Porta agora").
--
-- Decisões do RT (07/10/2026):
--   • tela própria "Porta", do gestor;
--   • 6 etapas — aguardando triagem, aguardando médico, em atendimento,
--     medicação pendente (sem checagem), em observação, altas hoje — cada uma
--     com a espera mais antiga; aguardando médico por cor, com quantos passaram
--     do tempo-alvo do protocolo da unidade; observação acima de 6 h; a etapa
--     gargalo vem marcada;
--   • a lista mostra o NOME do paciente, o setor e o leito/poltrona, para o
--     gestor saber onde cada um está (como já faz painel_observacao). Por ser
--     dado de paciente, o acesso entra na trilha de auditoria — no máximo um
--     registro a cada 15 min por pessoa e unidade (a tela se atualiza sozinha).
-- Exige segundo fator e gestor da unidade (ou super admin). Só aditiva.
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.porta_agora(uuid);
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

  -- tempo-alvo até o médico, por cor (protocolo da unidade; padrão Manchester)
  SELECT p.tempos INTO v_tempos
    FROM public.unidades u JOIN public.protocolos_classificacao p ON p.id = u.protocolo_classificacao_id
   WHERE u.id = p_unidade;
  v_tempos := coalesce(v_tempos, '{"vermelho": 0, "laranja": 10, "amarelo": 60, "verde": 120, "azul": 240}'::jsonb);

  WITH ativos AS (
    -- porta: triagem e atendimento
    SELECT e.id AS episodio_id, pa.nome, e.cor_atual AS cor,
           CASE WHEN e.etapa = 'triagem' THEN 'triagem'
                WHEN e.atendimento_iniciado_em IS NULL THEN 'aguardando_medico'
                ELSE 'em_atendimento' END AS etapa,
           s.nome AS setor, NULL::text AS leito,
           CASE WHEN e.etapa = 'triagem' THEN e.chegada_em
                WHEN e.atendimento_iniciado_em IS NULL THEN coalesce(e.classificado_em, e.chegada_em)
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
