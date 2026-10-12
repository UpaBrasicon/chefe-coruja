-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 4 — observação que vira internação (P1-05 do
-- teste de ponta a ponta de 11/10/2026; decisões do RT de 11/10/2026,
-- BACKLOG.md).
--
-- • Quando a observação vira internação, o tipo passa de "observacao" para
--   "urgencia", o mesmo da internação feita direto da porta. A internação
--   volta a aparecer, por exemplo, na lista do NIR de internação sem AIH.
-- • A data de admissão continua sendo a entrada na unidade; a hora em que o
--   paciente passou a internado fica em internacoes.internado_em. Permanência,
--   censo, DIH e "internado há" contam dela; o tempo na observação continua
--   no histórico (eventos_adt). Internação direta: internado_em = admissão.
--   Observação que teve alta direto fica sem internado_em (nunca internou).
-- • Dados antigos: as observações que já viraram internação (evento
--   "internacao" no histórico) são corrigidas. Na produção, em 11/10/2026,
--   não havia nenhuma internação.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.internacoes ADD COLUMN IF NOT EXISTS internado_em timestamptz;
COMMENT ON COLUMN public.internacoes.internado_em IS
  'Hora em que o paciente passou a internado: a admissão, na internação direta; a conversão, quando veio da observação. Nula enquanto (ou se só) esteve em observação.';

-- vale para todos os caminhos (abrir_internacao, porta, finalizar_observacao,
-- transferência de setor): quem sai da observação para internado vira urgência
CREATE OR REPLACE FUNCTION private.internacao_tipo_na_conversao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'em_observacao' AND NEW.internado_em IS NULL THEN
      NEW.internado_em := NEW.data_admissao;
    END IF;
  ELSIF OLD.status = 'em_observacao' AND NEW.status IN ('admitido', 'internado') THEN
    IF NEW.tipo_internacao = 'observacao' THEN NEW.tipo_internacao := 'urgencia'; END IF;
    NEW.internado_em := coalesce(NEW.internado_em, now());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.internacao_tipo_na_conversao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_internacao_tipo_na_conversao ON public.internacoes;
CREATE TRIGGER trg_internacao_tipo_na_conversao
  BEFORE INSERT OR UPDATE OF status ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_tipo_na_conversao();

-- dados já gravados (o gatilho de auditoria registra a mudança)
UPDATE public.internacoes i
   SET internado_em = coalesce((SELECT min(ev.created_at) FROM public.eventos_adt ev
                                 WHERE ev.internacao_id = i.id AND ev.tipo_evento = 'internacao'), i.data_admissao),
       tipo_internacao = CASE WHEN i.tipo_internacao = 'observacao' THEN 'urgencia' ELSE i.tipo_internacao END
 WHERE i.internado_em IS NULL
   AND (i.tipo_internacao <> 'observacao'
        OR EXISTS (SELECT 1 FROM public.eventos_adt ev WHERE ev.internacao_id = i.id AND ev.tipo_evento = 'internacao'));

-- ── permanência, censo e DIH contam de internado_em ────────────────────────
CREATE OR REPLACE FUNCTION private.exp_linhas(x exportacoes, p_desloc integer, p_limite integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_ini timestamptz := x.desde::timestamptz;
  v_fim timestamptz := (x.ate + 1)::timestamptz;
  v jsonb;
BEGIN
  CASE x.conjunto
  WHEN 'atendimentos' THEN
    WITH f AS (SELECT e.* FROM public.episodios e
                WHERE e.unidade_id = x.unidade_id AND e.chegada_em >= v_ini AND e.chegada_em < v_fim),
         p AS (SELECT * FROM f ORDER BY chegada_em, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(private.api_atendimento(e) || jsonb_build_object('paciente', private.exp_paciente_resumo(e.paciente_id, x.mascarado))
                                         ORDER BY e.chegada_em, e.id) FROM p JOIN public.episodios e ON e.id = p.id), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(DISTINCT p.paciente_id) FROM p), '[]'::jsonb))
      INTO v;
  WHEN 'internacoes' THEN
    -- internações que estiveram abertas em algum momento do período
    WITH f AS (SELECT i.* FROM public.internacoes i
                WHERE i.unidade_id = x.unidade_id AND i.data_admissao < v_fim
                  AND (i.data_alta IS NULL OR i.data_alta >= v_ini)),
         p AS (SELECT * FROM f ORDER BY data_admissao, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', p.id, 'unidade_id', p.unidade_id, 'paciente', private.exp_paciente_resumo(p.paciente_id, x.mascarado),
                 'atendimento_id', p.episodio_id,
                 'setor', (SELECT s.nome FROM public.setores s WHERE s.id = p.setor_atual_id),
                 'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = p.leito_atual_id),
                 'tipo', p.tipo_internacao, 'origem', p.origem_admissao, 'status', p.status,
                 'admissao_em', p.data_admissao, 'alta_em', p.data_alta,
                 'permanencia_dias', round((extract(epoch FROM coalesce(p.data_alta, now()) - coalesce(p.internado_em, p.data_admissao)) / 86400)::numeric, 1),
                 'cid_principal', p.cid_principal, 'cid_alta', p.cid_alta, 'motivo_alta', p.motivo_alta)
               ORDER BY p.data_admissao, p.id) FROM p), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(DISTINCT p.paciente_id) FROM p), '[]'::jsonb))
      INTO v;
  WHEN 'leitos' THEN
    -- situação agora; o paciente vai só pelo id (sem nome nem documento)
    WITH f AS (
      SELECT l.id, s.nome AS setor, l.identificador,
             jsonb_build_object('id', l.id, 'unidade_id', s.unidade_id, 'setor', s.nome, 'identificador', l.identificador,
               'tipo', l.tipo, 'status', l.status, 'paciente_id', i.paciente_id, 'ocupado_desde', i.data_entrada_setor) AS j
        FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
        LEFT JOIN LATERAL (SELECT it.paciente_id, it.data_entrada_setor FROM public.internacoes it
                            WHERE it.leito_atual_id = l.id AND it.data_alta IS NULL ORDER BY it.data_admissao DESC LIMIT 1) i ON true
       WHERE s.unidade_id = x.unidade_id AND l.ativo),
    p AS (SELECT * FROM f ORDER BY setor, identificador, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(p.j ORDER BY p.setor, p.identificador, p.id) FROM p), '[]'::jsonb),
             'pacientes', '[]'::jsonb)
      INTO v;
  WHEN 'pacientes' THEN
    -- cadastrados no período ou com atendimento no período
    WITH f AS (SELECT pa.* FROM public.pacientes pa
                WHERE pa.unidade_id = x.unidade_id AND pa.ativo
                  AND ((pa.created_at >= v_ini AND pa.created_at < v_fim)
                       OR EXISTS (SELECT 1 FROM public.episodios e
                                   WHERE e.paciente_id = pa.id AND e.unidade_id = x.unidade_id
                                     AND e.chegada_em >= v_ini AND e.chegada_em < v_fim))),
         p AS (SELECT * FROM f ORDER BY nome, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(private.exp_paciente(pa, x.mascarado) ORDER BY pa.nome, pa.id)
                                  FROM p JOIN public.pacientes pa ON pa.id = p.id), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(p.id) FROM p), '[]'::jsonb))
      INTO v;
  WHEN 'documentos' THEN
    -- só a lista: tipo, número, versão, autor e datas; o texto clínico não sai
    WITH f AS (SELECT d.* FROM public.documentos_clinicos d
                WHERE d.unidade_id = x.unidade_id
                  AND coalesce(d.emitido_em, d.created_at) >= v_ini AND coalesce(d.emitido_em, d.created_at) < v_fim),
         p AS (SELECT * FROM f ORDER BY coalesce(emitido_em, created_at), id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', p.id, 'unidade_id', p.unidade_id, 'paciente', private.exp_paciente_resumo(p.paciente_id, x.mascarado),
                 'atendimento_id', p.episodio_id, 'internacao_id', p.internacao_id,
                 'tipo', p.tipo_documento, 'numero', p.numero, 'versao', p.versao, 'estado', p.estado,
                 'autor', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = p.autor_id),
                 'emitido_em', coalesce(p.emitido_em, p.created_at), 'assinado_em', p.assinado_em, 'cancelado_em', p.cancelado_em)
               ORDER BY coalesce(p.emitido_em, p.created_at), p.id) FROM p), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(DISTINCT p.paciente_id) FROM p WHERE p.paciente_id IS NOT NULL), '[]'::jsonb))
      INTO v;
  END CASE;
  RETURN v;
END $function$;

CREATE OR REPLACE FUNCTION private.gerar_censo_diario(p_unidade uuid, p_data date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
  v_dia_inicio timestamptz := (p_data::text || ' 00:00:00-03')::timestamptz;
  v_dia_fim timestamptz := (p_data::text || ' 23:59:59-03')::timestamptz;
  v_internados integer;
  v_leitos_total integer;
  v_leitos_ocupados integer;
  v_leitos_livres integer;
  v_leitos_hig integer;
  v_leitos_bloq integer;
  v_taxa numeric;
  v_permanencia numeric;
  v_giro numeric;
  v_registros integer := 0;
  v_setor record;
BEGIN
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;

  -- 1. pacientes presentes no dia (episódios com admissão <= fim do dia e
  --    (sem data_alta OU data_alta >= início do dia))
  --    Presença = existir internação ativa naquele dia.
  FOR v_setor IN
    SELECT s.id AS setor_id
    FROM public.setores s
    WHERE s.unidade_id = p_unidade AND s.ativo
      AND s.tipo IN ('internacao','observacao','uti','isolamento')
  LOOP
    -- internados no dia no setor: episódios cujo setor_atual era este e que
    -- estavam vigentes no dia (admissão <= fim; sem alta ou alta >= início).
    SELECT count(DISTINCT i.id) INTO v_internados
    FROM public.internacoes i
    WHERE i.unidade_id = p_unidade
      AND i.setor_atual_id = v_setor.setor_id
      AND i.data_admissao <= v_dia_fim
      AND (i.data_alta IS NULL OR i.data_alta >= v_dia_inicio);

    -- leitos do setor
    SELECT
      count(*) FILTER (WHERE status = 'ocupado'),
      count(*) FILTER (WHERE status = 'livre'),
      count(*) FILTER (WHERE status = 'higienizacao'),
      count(*) FILTER (WHERE status = 'bloqueado'),
      count(*)
    INTO v_leitos_ocupados, v_leitos_livres, v_leitos_hig, v_leitos_bloq, v_leitos_total
    FROM public.leitos
    WHERE setor_id = v_setor.setor_id AND ativo;

    v_taxa := CASE WHEN v_leitos_total > 0
             THEN round((v_internados::numeric / v_leitos_total::numeric) * 100, 1)
             ELSE NULL END;

    -- permanência média (horas) dos episódios encerrados no dia (ou em curso)
    SELECT round(avg(extract(epoch FROM coalesce(data_alta, now()) - coalesce(internado_em, data_admissao))/3600)::numeric, 1)
    INTO v_permanencia
    FROM public.internacoes
    WHERE unidade_id = p_unidade AND setor_atual_id = v_setor.setor_id
      AND data_admissao <= v_dia_fim;

    -- giro de leito = altas no dia / leitos do setor
    SELECT round((count(*)::numeric / NULLIF(v_leitos_total,0))::numeric, 2)
    INTO v_giro
    FROM public.internacoes
    WHERE unidade_id = p_unidade AND setor_atual_id = v_setor.setor_id
      AND data_alta >= v_dia_inicio AND data_alta <= v_dia_fim;

    INSERT INTO public.censo_ocupacao
      (organizacao_id, unidade_id, setor_id, data, turno,
       internados, leitos_total, leitos_ocupados, leitos_livres,
       leitos_higienizacao, leitos_bloqueados,
       taxa_ocupacao, permanencia_media_h, giro_leito, snapshot)
    VALUES
      (v_org, p_unidade, v_setor.setor_id, p_data, 'diario',
       v_internados, v_leitos_total, v_leitos_ocupados, v_leitos_livres,
       v_leitos_hig, v_leitos_bloq, v_taxa, v_permanencia, v_giro,
       jsonb_build_object('gerado_em', now()))
    ON CONFLICT (unidade_id, setor_id, data, turno)
    DO UPDATE SET
      internados = EXCLUDED.internados,
      leitos_total = EXCLUDED.leitos_total,
      leitos_ocupados = EXCLUDED.leitos_ocupados,
      leitos_livres = EXCLUDED.leitos_livres,
      leitos_higienizacao = EXCLUDED.leitos_higienizacao,
      leitos_bloqueados = EXCLUDED.leitos_bloqueados,
      taxa_ocupacao = EXCLUDED.taxa_ocupacao,
      permanencia_media_h = EXCLUDED.permanencia_media_h,
      giro_leito = EXCLUDED.giro_leito,
      snapshot = EXCLUDED.snapshot,
      criado_em = now();

    v_registros := v_registros + 1;
  END LOOP;

  RETURN v_registros;
END; $function$;

CREATE OR REPLACE FUNCTION public.panorama_gestor(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_hoje date := private.data_atual();
  v_ini_dia timestamptz := (private.data_atual()::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_ini_mes timestamptz := (date_trunc('month', private.data_atual())::timestamp AT TIME ZONE 'America/Sao_Paulo');
  n jsonb;
  v_ck jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o panorama é do gestor da unidade.';
  END IF;

  SELECT jsonb_build_object(
    'checkin_total', count(*) FILTER (WHERE a.situacao NOT IN ('a_comecar')),
    'checkin_divergentes', count(*) FILTER (WHERE a.divergente),
    'checkin_feitos', count(*) FILTER (WHERE a.realizado IS NOT NULL),
    'checkin_fora_do_raio', count(*) FILTER (WHERE a.dentro IS FALSE),
    'checkin_atrasos', count(*) FILTER (WHERE a.situacao IN ('atraso', 'atraso_fora_do_raio')),
    'sem_checkin', count(*) FILTER (WHERE a.situacao = 'sem_checkin'),
    'checkin_sem_escala', count(*) FILTER (WHERE a.situacao = 'sem_escala'))
    INTO v_ck
    FROM public.auditoria_checkin(p_unidade, v_hoje) a;

  SELECT jsonb_build_object(
    -- leitos (setores ativos da unidade)
    'leitos', count(*),
    'leitos_ocupados', count(*) FILTER (WHERE l.status = 'ocupado'),
    'leitos_livres', count(*) FILTER (WHERE l.status = 'livre'),
    'leitos_higienizacao', count(*) FILTER (WHERE l.status = 'higienizacao'),
    'leitos_bloqueados', count(*) FILTER (WHERE l.status = 'bloqueado'),
    'leitos_internacao', count(*) FILTER (WHERE NOT private.setor_de_observacao(s.id)))
    INTO n
    FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
   WHERE s.unidade_id = p_unidade AND s.ativo AND l.ativo;

  n := n || v_ck || jsonb_build_object(
    -- internação
    'internados', (SELECT count(*) FROM private.internacao_ativa_fora_observacao(p_unidade)),
    'admissoes_7d', (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = p_unidade
                       AND i.data_admissao > now() - interval '7 days' AND NOT private.setor_de_observacao(i.setor_atual_id)),
    'altas_7d', (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = p_unidade
                   AND i.data_alta > now() - interval '7 days' AND NOT private.setor_de_observacao(i.setor_atual_id)),
    'altas_mes', (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = p_unidade
                    AND i.data_alta >= v_ini_mes AND NOT private.setor_de_observacao(i.setor_atual_id)),
    'permanencia_media_d', (SELECT round(avg(extract(epoch FROM i.data_alta - coalesce(i.internado_em, i.data_admissao)) / 86400)::numeric, 1)
                              FROM public.internacoes i WHERE i.unidade_id = p_unidade
                               AND i.data_alta > now() - interval '30 days' AND i.data_admissao IS NOT NULL
                               AND NOT private.setor_de_observacao(i.setor_atual_id)),
    'evolucoes_atraso', (SELECT count(*) FROM private.internacao_ativa_fora_observacao(p_unidade) i
                          WHERE i.data_admissao < now() - interval '24 hours'
                            AND NOT EXISTS (SELECT 1 FROM public.evolucoes_estruturadas ev
                                             WHERE ev.internacao_id = i.id AND ev.created_at > now() - interval '24 hours')),
    -- observação
    'em_observacao', (SELECT count(*) FROM public.internacoes i WHERE i.unidade_id = p_unidade
                        AND i.status IN ('admitido', 'em_observacao', 'internado') AND private.setor_de_observacao(i.setor_atual_id)),
    'obs_acima_prazo', (SELECT count(*) FROM public.pendencias pe WHERE pe.unidade_id = p_unidade
                          AND pe.tipo = 'observacao' AND pe.situacao = 'aberta' AND pe.prazo < now()),
    -- porta
    'porta_agora', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento')),
    'espera_media_min', (SELECT round(avg(extract(epoch FROM now() - e.chegada_em) / 60))::int FROM public.episodios e
                           WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento') AND e.atendimento_iniciado_em IS NULL),
    'espera_max_min', (SELECT floor(max(extract(epoch FROM now() - e.chegada_em) / 60))::int FROM public.episodios e
                         WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento') AND e.atendimento_iniciado_em IS NULL),
    'atendimentos_7d', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade AND e.chegada_em > now() - interval '7 days'),
    'desfechos_7d', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade
                       AND e.desfecho_em > now() - interval '7 days' AND e.desfecho IS NOT NULL AND e.desfecho <> 'cancelado'),
    'internacoes_da_porta_7d', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade
                                  AND e.desfecho_em > now() - interval '7 days' AND e.desfecho = 'internacao'),
    'evasoes_7d', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade
                     AND e.desfecho_em > now() - interval '7 days' AND e.desfecho = 'evasao'),
    'vermelhos_hoje', (SELECT count(DISTINCT c.episodio_id) FROM public.classificacoes_risco c
                         WHERE c.unidade_id = p_unidade AND c.cor = 'vermelho' AND c.criado_em >= v_ini_dia),
    'reavaliacao_vencida', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = p_unidade
                              AND e.etapa <> 'encerrado' AND e.reavaliar_em < now()),
    -- equipe e escala
    'escalados_hoje', (SELECT count(DISTINCT e.perfil_id) FROM public.escala_plantao e
                         WHERE e.unidade_id = p_unidade AND e.ativo AND e.data = v_hoje AND e.perfil_id IS NOT NULL),
    'escalados_agora', (SELECT count(DISTINCT e.perfil_id) FROM public.escala_plantao e
                          WHERE e.unidade_id = p_unidade AND e.ativo AND e.perfil_id IS NOT NULL
                            AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)),
    'vagas_abertas_7d', (SELECT count(*) FROM public.escala_plantao e
                           WHERE e.unidade_id = p_unidade AND e.ativo AND e.perfil_id IS NULL
                             AND e.data BETWEEN v_hoje AND v_hoje + 6),
    'trocas_pendentes', (SELECT count(*) FROM public.trocas_plantao t WHERE t.unidade_id = p_unidade AND t.status = 'pendente'),
    'solicitacoes_pendentes', (SELECT count(*) FROM public.solicitacoes_escala x WHERE x.unidade_id = p_unidade AND x.status = 'pendente'),
    'candidaturas_pendentes', (SELECT count(*) FROM public.candidaturas_escala x WHERE x.unidade_id = p_unidade AND x.status = 'pendente'),
    -- farmácia
    'estoque_critico', (SELECT count(*) FROM public.estoque_medicamento em WHERE em.unidade_id = p_unidade
                          AND em.limite_critico IS NOT NULL AND em.quantidade <= em.limite_critico),
    'estoque_falta', (SELECT count(*) FROM public.estoque_medicamento em WHERE em.unidade_id = p_unidade
                        AND em.limite_falta IS NOT NULL AND em.quantidade <= em.limite_falta),
    'faltas_abertas', (SELECT count(*) FROM public.faltas_medicamento f WHERE f.unidade_id = p_unidade
                         AND f.situacao IN ('registrada', 'em_cotacao'))
  );

  RETURN jsonb_build_object(
    'gerado_em', now(),
    'fora', coalesce((SELECT to_jsonb(pp.fora) FROM public.panorama_preferencias pp
                       WHERE pp.perfil_id = private.meu_perfil_id() AND pp.unidade_id = p_unidade), '[]'::jsonb),
    'n', n);
END $function$;

CREATE OR REPLACE FUNCTION public.perguntar_gestao(p_unidade uuid, p_pergunta text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q text := translate(lower(btrim(coalesce(p_pergunta, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_hoje date := private.data_atual();
  n jsonb;
  itens jsonb;
  v_media numeric;
  v_taxa numeric;
  v_limite int := (private.limites_unidade(p_unidade) ->> 'sobrecarga_horas')::int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a pergunta sobre a gestão é do gestor da unidade.';
  END IF;
  IF length(q) < 3 THEN RAISE EXCEPTION 'Escreva a pergunta.'; END IF;
  IF length(q) > 300 THEN RAISE EXCEPTION 'A pergunta tem no máximo 300 caracteres.'; END IF;

  n := public.panorama_gestor(p_unidade) -> 'n';

  -- check-in e presença
  IF q ~ '(check|presenc|atras|raio|chegou|chegad)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', a.nome || coalesce(' · ' || a.setor, ''),
             'valor', CASE a.situacao WHEN 'sem_checkin' THEN 'sem check-in' WHEN 'sem_escala' THEN 'check-in sem plantão na escala'
                        WHEN 'atraso' THEN 'atraso de ' || a.diferenca_min || ' min' WHEN 'fora_do_raio' THEN 'fora do raio'
                        ELSE 'atraso de ' || a.diferenca_min || ' min e fora do raio' END) ORDER BY a.previsto NULLS LAST), '[]'::jsonb)
      INTO itens FROM public.auditoria_checkin(p_unidade, v_hoje) a WHERE a.divergente;
    RETURN jsonb_build_object('entendida', true, 'tema', 'checkin', 'titulo', 'Check-in de hoje',
      'resposta', (n ->> 'checkin_divergentes') || ' de ' || (n ->> 'checkin_total') || ' com divergência hoje: '
        || (n ->> 'checkin_atrasos') || ' com atraso, ' || (n ->> 'checkin_fora_do_raio') || ' fora do raio, '
        || (n ->> 'sem_checkin') || ' sem check-in e ' || (n ->> 'checkin_sem_escala') || ' sem plantão na escala.',
      'itens', itens, 'link', '/gestao');
  END IF;

  -- ocupação
  IF q ~ '(ocupa|leito|lotad|lotac|censo|vaga de intern)' THEN
    v_taxa := CASE WHEN (n ->> 'leitos')::int > 0 THEN round(100.0 * (n ->> 'leitos_ocupados')::int / (n ->> 'leitos')::int) END;
    SELECT round(avg(c.taxa_ocupacao), 1) INTO v_media FROM public.censo_ocupacao c
     WHERE c.unidade_id = p_unidade AND c.data >= v_hoje - 30 AND c.taxa_ocupacao IS NOT NULL;
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome, 'valor', x.ocup || ' de ' || x.total || ' leitos') ORDER BY x.ordem, x.nome), '[]'::jsonb)
      INTO itens FROM (
        SELECT s.nome, s.ordem, count(*) FILTER (WHERE l.status = 'ocupado') AS ocup, count(*) AS total
          FROM public.setores s JOIN public.leitos l ON l.setor_id = s.id AND l.ativo
         WHERE s.unidade_id = p_unidade AND s.ativo GROUP BY s.id, s.nome, s.ordem) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'ocupacao', 'titulo', 'Ocupação de leitos',
      'resposta', 'Agora: ' || coalesce(v_taxa || '%', 'sem leito ativo') || ' (' || (n ->> 'leitos_ocupados') || ' de ' || (n ->> 'leitos') || ' leitos). '
        || CASE WHEN v_media IS NULL THEN 'Não há censo gravado nos últimos 30 dias para dar a média do mês.'
                ELSE 'Média dos censos gravados nos últimos 30 dias: ' || replace(v_media::text, '.', ',') || '%.' END,
      'itens', itens, 'link', '/indicadores');
  END IF;

  -- farmácia
  IF q ~ '(medicament|falt|estoque|farmac|remedio|repor)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', m.principio_ativo || coalesce(' ' || m.apresentacao, ''),
             'valor', 'saldo ' || trim(to_char(em.quantidade, 'FM999999990.##'), '.')
                      || CASE WHEN em.limite_falta IS NOT NULL AND em.quantidade <= em.limite_falta THEN ' · em falta' ELSE ' · crítico' END)
             ORDER BY em.quantidade), '[]'::jsonb)
      INTO itens FROM public.estoque_medicamento em JOIN public.medicamento m ON m.id = em.medicamento_id
     WHERE em.unidade_id = p_unidade AND em.limite_critico IS NOT NULL AND em.quantidade <= em.limite_critico;
    RETURN jsonb_build_object('entendida', true, 'tema', 'farmacia', 'titulo', 'Estoque e faltas',
      'resposta', (n ->> 'estoque_critico') || ' item(ns) no limite crítico ou abaixo, ' || (n ->> 'estoque_falta')
        || ' no limite de falta, e ' || (n ->> 'faltas_abertas') || ' falta(s) sinalizada(s) ainda sem reposição. '
        || 'O saldo e os limites são os que a farmácia registrou; a previsão de consumo não está no banco.',
      'itens', itens, 'link', NULL);
  END IF;

  -- alta, permanência e giro
  IF q ~ '(\malta|gargal|permanen|giro|desospital)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome,
             'valor', x.n || ' internado(s) · permanência atual média de ' || replace(x.dias::text, '.', ',') || ' dia(s)') ORDER BY x.dias DESC), '[]'::jsonb)
      INTO itens FROM (
        SELECT s.nome, count(*) AS n, round(avg(extract(epoch FROM now() - coalesce(i.internado_em, i.data_admissao)) / 86400)::numeric, 1) AS dias
          FROM private.internacao_ativa_fora_observacao(p_unidade) i JOIN public.setores s ON s.id = i.setor_atual_id
         WHERE i.data_admissao IS NOT NULL GROUP BY s.id, s.nome) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'alta', 'titulo', 'Altas e permanência',
      'resposta', coalesce('Permanência média de ' || replace((n ->> 'permanencia_media_d'), '.', ',') || ' dia(s) nas altas dos últimos 30 dias. ',
                           'Sem alta de internação nos últimos 30 dias. ')
        || (n ->> 'altas_7d') || ' alta(s) e ' || (n ->> 'admissoes_7d') || ' admissão(ões) em 7 dias; '
        || (n ->> 'obs_acima_prazo') || ' paciente(s) passaram do prazo da observação. Por setor, a permanência de quem está internado agora:',
      'itens', itens, 'link', '/internacao');
  END IF;

  -- carga de plantões
  IF q ~ '(plant|limite|carga|hora|sobrecarg|escala|cansad|descanso)' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.nome,
             'valor', replace(round(x.horas, 1)::text, '.', ',') || ' h em ' || x.n || ' plantão(ões)'
                      || CASE WHEN x.horas > v_limite THEN ' · acima de ' || v_limite || ' h' ELSE '' END) ORDER BY x.horas DESC), '[]'::jsonb)
      INTO itens FROM (
        SELECT pf.nome_completo AS nome, sum(e.duracao_min) / 60.0 AS horas, count(*) AS n
          FROM public.escala_plantao e JOIN public.perfis pf ON pf.id = e.perfil_id
         WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_hoje - 6 AND v_hoje
         GROUP BY pf.id, pf.nome_completo
         ORDER BY sum(e.duracao_min) DESC LIMIT 8) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'carga', 'titulo', 'Carga de plantões nos últimos 7 dias',
      'resposta', 'Horas escaladas por profissional nesta unidade de ' || to_char(v_hoje - 6, 'DD/MM') || ' a ' || to_char(v_hoje, 'DD/MM')
        || '. O limite interno da unidade é ' || v_limite || ' horas em 7 dias; outras unidades não entram na conta.',
      'itens', itens, 'link', '/gestao/gaviao');
  END IF;

  -- porta e observação
  IF q ~ '(porta|espera|triag|fila|observa|atendiment|evas)' THEN
    RETURN jsonb_build_object('entendida', true, 'tema', 'porta', 'titulo', 'Porta e observação',
      'resposta', (n ->> 'porta_agora') || ' na porta agora' || coalesce(', espera média de ' || (n ->> 'espera_media_min') || ' min', '')
        || coalesce(' (a mais longa, ' || (n ->> 'espera_max_min') || ' min)', '') || '. '
        || (n ->> 'em_observacao') || ' em observação, ' || (n ->> 'obs_acima_prazo') || ' acima do prazo. '
        || (n ->> 'atendimentos_7d') || ' chegadas e ' || (n ->> 'evasoes_7d') || ' evasão(ões) em 7 dias.',
      'itens', '[]'::jsonb, 'link', '/observacao');
  END IF;

  RETURN jsonb_build_object('entendida', false, 'tema', NULL, 'titulo', 'Ainda sem resposta para isso',
    'resposta', 'Esta pergunta ainda não tem consulta no banco da unidade. Hoje respondo sobre ocupação, carga de plantões, altas e permanência, estoque e faltas, check-in e porta. Se é algo que você quer acompanhar, peça como medida em Indicadores.',
    'itens', '[]'::jsonb, 'link', '/indicadores');
END $function$;

CREATE OR REPLACE FUNCTION public.contexto_evolucao(p_internacao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_hoje date := private.data_atual();
  v_perfil uuid := private.meu_perfil_id();
  v_sv jsonb;
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  -- últimos sinais vitais das 24 h (lançados pela enfermagem ou por quem for),
  -- um valor por parâmetro, com a hora e quem aferiu o mais recente
  WITH ult AS (
    SELECT DISTINCT ON (c.nome) c.nome, o.valor_num, o.valor_texto, op.valor AS opcao, o.aferido_em, o.registrado_por
      FROM public.observacao o
      JOIN public.conceito c ON c.id = o.conceito_id
      LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
     WHERE o.paciente_id = i.paciente_id AND o.aferido_em > now() - interval '24 hours'
       AND c.nome IN ('pressao-arterial-sistolica', 'pressao-arterial-diastolica', 'frequencia-cardiaca', 'frequencia-respiratoria',
                      'temperatura', 'saturacao-o2', 'glicemia-capilar', 'oxigenio-suplementar')
     ORDER BY c.nome, o.aferido_em DESC
  ), num AS (
    SELECT nome, replace(trim_scale(valor_num)::text, '.', ',') AS t FROM ult
  ), mais_recente AS (
    SELECT u.aferido_em, pf.nome_completo FROM ult u LEFT JOIN public.perfis pf ON pf.id = u.registrado_por
     ORDER BY u.aferido_em DESC LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ult) THEN NULL ELSE jsonb_build_object(
    'pa', CASE WHEN EXISTS (SELECT 1 FROM num WHERE nome = 'pressao-arterial-sistolica')
               THEN (SELECT t FROM num WHERE nome = 'pressao-arterial-sistolica')
                    || coalesce('x' || (SELECT t FROM num WHERE nome = 'pressao-arterial-diastolica'), '') END,
    'fc', (SELECT t FROM num WHERE nome = 'frequencia-cardiaca'),
    'fr', (SELECT t FROM num WHERE nome = 'frequencia-respiratoria'),
    'temp', (SELECT t FROM num WHERE nome = 'temperatura'),
    'spo2', (SELECT t FROM num WHERE nome = 'saturacao-o2'),
    'glic', (SELECT t FROM num WHERE nome = 'glicemia-capilar'),
    'condicao', (SELECT CASE WHEN opcao = 'ar' THEN 'ar' WHEN opcao IS NOT NULL THEN 'o2' END FROM ult WHERE nome = 'oxigenio-suplementar'),
    'aferido_em', (SELECT aferido_em FROM mais_recente),
    'por', (SELECT nome_completo FROM mais_recente)) END
  INTO v_sv;

  SELECT jsonb_build_object(
    'internacao_id', i.id,
    'paciente_id', i.paciente_id,
    'ativa', i.status IN ('admitido', 'em_observacao', 'internado'),
    'data_admissao', i.data_admissao,
    'dih', greatest(1, v_hoje - (coalesce(i.internado_em, i.data_admissao) AT TIME ZONE 'America/Sao_Paulo')::date + 1),
    'hoje', v_hoje,
    'cid_principal', i.cid_principal,
    'pode_registrar', i.status IN ('admitido', 'em_observacao', 'internado') AND private.cuido_da_internacao(i)
                      AND private.pode_registrar_evolucao(i.unidade_id, 'evolucao'),
    -- antimicrobianos em curso na prescrição da internação; o início é o do
    -- primeiro item do mesmo medicamento nesta internação (troca de dose não
    -- zera o dia de uso)
    'antimicrobianos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')
                              || coalesce(' ' || nullif(btrim(it.via), ''), '') || coalesce(' ' || nullif(btrim(it.posologia), ''), '')),
               'inicio', (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date,
               'dia', v_hoje - (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1)
             ORDER BY ini.inicio)
        FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
        CROSS JOIN LATERAL (
          SELECT min(i2.created_at) AS inicio FROM public.prescricoes p2 JOIN public.prescricao_itens i2 ON i2.prescricao_id = p2.id
           WHERE p2.internacao_id = i.id AND p2.status <> 'rascunho'
             AND coalesce(i2.medicamento_id::text, private.norm(i2.descricao)) = coalesce(it.medicamento_id::text, private.norm(it.descricao))) ini
       WHERE pr.internacao_id = i.id AND pr.status = 'ativa' AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- dispositivos: registrados pela enfermagem (onda 7). Enquanto não houver
    -- a tabela, a lista vem vazia e a tela diz "Nenhum registrado."
    'dispositivos', '[]'::jsonb,
    'sv_enfermagem', v_sv,
    -- a evolução médica do dia do usuário (se já houver, a próxima é complemento)
    'minha_do_dia', (
      SELECT jsonb_build_object('documento_id', dv.id, 'raiz_id', e.documento_raiz_id, 'criado_em', r.created_at, 'versao', dv.versao,
                                'estruturada', private.eh_estruturada(ev.dados), 'dados', ev.dados)
        FROM public.evolucoes_estruturadas e
        JOIN public.documentos_clinicos r ON r.id = e.documento_raiz_id
        JOIN public.documentos_clinicos dv ON dv.documento_raiz_id = e.documento_raiz_id AND dv.estado = 'ativo'
        LEFT JOIN public.evolucoes_estruturadas ev ON ev.documento_id = dv.id
       WHERE e.internacao_id = i.id AND e.tipo_documento = 'evolucao' AND e.autor_id = v_perfil
         AND e.dia = v_hoje AND e.papel = 'do_dia' AND e.versao = 1
       LIMIT 1),
    -- a última evolução estruturada vigente (qualquer autor): o formulário
    -- herda lista de problemas, antimicrobianos incluídos à mão e o CID
    'ultima_estruturada', (
      SELECT jsonb_build_object('documento_id', ev.documento_id, 'criado_em', dv.created_at, 'dados', ev.dados)
        FROM public.evolucoes_estruturadas ev
        JOIN public.documentos_clinicos dv ON dv.id = ev.documento_id AND dv.estado = 'ativo'
       WHERE ev.internacao_id = i.id AND ev.tipo_documento = 'evolucao' AND private.eh_estruturada(ev.dados)
       ORDER BY dv.created_at DESC LIMIT 1)
  ) INTO v;
  RETURN v;
END $function$;

CREATE OR REPLACE FUNCTION public.resumo_clinico(p_internacao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  r public.resumos_clinicos;
  v_hoje date := private.data_atual();
  v_presc uuid;
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.leio_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO r FROM public.resumos_clinicos WHERE internacao_id = i.id ORDER BY criado_em DESC LIMIT 1;
  -- a prescrição vigente da internação (a mesma de public.prescricao_vigente
  -- enquanto a internação está aberta)
  SELECT id INTO v_presc FROM public.prescricoes
   WHERE internacao_id = i.id AND status = 'ativa' ORDER BY created_at DESC LIMIT 1;

  SELECT jsonb_build_object(
    'sexo', (SELECT sexo FROM public.pacientes WHERE id = i.paciente_id),
    'dih', greatest(1, coalesce((i.data_alta AT TIME ZONE 'America/Sao_Paulo')::date, v_hoje) - (coalesce(i.internado_em, i.data_admissao) AT TIME ZONE 'America/Sao_Paulo')::date + 1),
    'data_admissao', i.data_admissao,
    'ativa', i.status IN ('admitido', 'em_observacao', 'internado'),
    'pode_registrar', i.status IN ('admitido', 'em_observacao', 'internado') AND private.cuido_da_internacao(i)
                      AND private.pode_registrar_evolucao(i.unidade_id, 'evolucao'),
    'resumo', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', r.id, 'texto', r.resumo, 'previsao_alta', r.previsao_alta, 'criado_em', r.criado_em,
      'autor', (SELECT nome_completo FROM public.perfis WHERE id = r.autor_id), 'antibioticos', r.antibioticos) END,
    -- antibióticos da internação (em curso e suspensos), com o dia de uso e o
    -- movimento/motivo anotados no resumo vigente
    'antibioticos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')
                              || coalesce(' ' || nullif(btrim(it.via), ''), '') || coalesce(' ' || nullif(btrim(it.posologia), ''), '')),
               'inicio', ini.inicio,
               'suspenso_em', it.suspenso_em,
               'motivo_suspensao', it.motivo_suspensao,
               'em_curso', it.suspenso_em IS NULL AND pr.status = 'ativa',
               'dia', coalesce((it.suspenso_em AT TIME ZONE 'America/Sao_Paulo')::date, v_hoje) - (ini.inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1,
               'movimento', an ->> 'movimento',
               'motivo', an ->> 'motivo')
             ORDER BY (it.suspenso_em IS NULL) DESC, ini.inicio)
        FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
        CROSS JOIN LATERAL (
          SELECT min(i2.created_at) AS inicio FROM public.prescricoes p2 JOIN public.prescricao_itens i2 ON i2.prescricao_id = p2.id
           WHERE p2.internacao_id = i.id AND p2.status <> 'rascunho'
             AND coalesce(i2.medicamento_id::text, private.norm(i2.descricao)) = coalesce(it.medicamento_id::text, private.norm(it.descricao))) ini
        LEFT JOIN LATERAL (
          SELECT x AS an FROM jsonb_array_elements(coalesce(r.antibioticos, '[]'::jsonb)) x WHERE x ->> 'item_id' = it.id::text LIMIT 1) ann ON true
       WHERE pr.internacao_id = i.id AND pr.status <> 'rascunho' AND it.tipo = 'medicamento'
         AND private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- medicações em curso: a prescrição vigente, sem os antimicrobianos
    'medicacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')),
               'via', concat_ws(' · ', nullif(btrim(coalesce(it.via, '')), ''), nullif(btrim(coalesce(it.posologia, '')), ''),
                                CASE WHEN it.se_necessario THEN 'se necessário' END),
               'desde', it.created_at,
               'reposicao', private.eh_reposicao_eletrolito(it.descricao))
             ORDER BY it.ordem, it.created_at)
        FROM public.prescricao_itens it
        LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
       WHERE it.prescricao_id = v_presc AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND NOT private.eh_antimicrobiano(coalesce(m.principio_ativo, '') || ' ' || it.descricao)), '[]'::jsonb),
    -- eletrólitos: os dois últimos valores de cada um nesta internação
    'eletrolitos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('nome', x.nome, 'valor', x.valor, 'unidade', x.unidade, 'flag', x.flag,
                                          'aferido_em', x.aferido_em) ORDER BY x.ordem, x.aferido_em DESC)
        FROM (
          SELECT c.nome, replace(trim_scale(o.valor_num)::text, '.', ',') AS valor, coalesce(o.unidade, c.unidade_padrao) AS unidade,
                 o.flag, o.aferido_em, c.ordem_exibicao AS ordem,
                 row_number() OVER (PARTITION BY c.nome ORDER BY o.aferido_em DESC) AS n
            FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
           WHERE o.paciente_id = i.paciente_id AND o.valor_num IS NOT NULL
             AND o.aferido_em >= i.data_admissao - interval '1 day'
             AND o.aferido_em <= coalesce(i.data_alta, 'infinity'::timestamptz)
             AND c.nome IN ('sodio', 'potassio', 'magnesio', 'calcio-total', 'cloro', 'fosforo', 'bicarbonato')
        ) x WHERE x.n <= 2), '[]'::jsonb),
    -- reposições de eletrólito prescritas nesta internação (em curso e as já suspensas)
    'reposicoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'item_id', it.id,
               'nome', btrim(it.descricao || coalesce(' ' || nullif(btrim(it.dose), ''), '')),
               'via', concat_ws(' · ', nullif(btrim(coalesce(it.via, '')), ''), nullif(btrim(coalesce(it.posologia, '')), '')),
               'desde', it.created_at, 'suspenso_em', it.suspenso_em) ORDER BY it.created_at DESC)
        FROM public.prescricoes pr JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
       WHERE pr.internacao_id = i.id AND pr.status <> 'rascunho' AND it.tipo = 'medicamento'
         AND private.eh_reposicao_eletrolito(it.descricao)), '[]'::jsonb),
    -- condutas: o "P" das evoluções médicas estruturadas vigentes, mais recentes primeiro
    'condutas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('texto', c.p, 'quando', c.created_at, 'quem', c.nome) ORDER BY c.created_at DESC)
        FROM (
          SELECT btrim(ev.dados ->> 'p') AS p, dv.created_at, pf.nome_completo AS nome
            FROM public.evolucoes_estruturadas ev
            JOIN public.documentos_clinicos dv ON dv.id = ev.documento_id AND dv.estado = 'ativo'
            LEFT JOIN public.perfis pf ON pf.id = ev.autor_id
           WHERE ev.internacao_id = i.id AND ev.tipo_documento = 'evolucao' AND private.eh_estruturada(ev.dados)
             AND length(btrim(coalesce(ev.dados ->> 'p', ''))) > 0
           ORDER BY dv.created_at DESC LIMIT 12) c), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $function$;

CREATE OR REPLACE FUNCTION public.enfermagem_leitos(p_unidade uuid)
 RETURNS TABLE(internacao_id uuid, paciente_id uuid, episodio_id uuid, nome text, data_nascimento date, sexo text, setor_id uuid, setor_nome text, leito text, status text, data_admissao timestamp with time zone, cid_principal text, queixa text, aprazamentos_atrasados integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE v_setores uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_enfermagem(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: tela da enfermagem.'; END IF;
  SELECT array_agg(x) INTO v_setores FROM private.setores_na_escala_agora() x
   WHERE NOT private.setor_de_observacao(x)
     AND EXISTS (SELECT 1 FROM public.setores s WHERE s.id = x AND s.unidade_id = p_unidade);
  IF v_setores IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH ativos AS (
    SELECT i.* FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND i.setor_atual_id = ANY (v_setores)
  ), atr AS (
    SELECT a.paciente_id, count(*)::int AS n
      FROM private.aprazamentos_atrasados((SELECT array_agg(x.paciente_id) FROM ativos x)) a
     GROUP BY a.paciente_id
  )
  SELECT i.id, i.paciente_id, i.episodio_id, coalesce(pa.nome_social, pa.nome), pa.data_nascimento, pa.sexo,
         i.setor_atual_id, s.nome, l.identificador, i.status,
         coalesce(i.internado_em, i.data_admissao),  -- "internado há": da conversão (tarefa 4)
         i.cid_principal, ep.queixa, coalesce(atr.n, 0)
    FROM ativos i
    JOIN public.pacientes pa ON pa.id = i.paciente_id
    JOIN public.setores s ON s.id = i.setor_atual_id
    LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
    LEFT JOIN public.episodios ep ON ep.id = i.episodio_id
    LEFT JOIN atr ON atr.paciente_id = i.paciente_id
   ORDER BY s.nome, l.identificador NULLS LAST, pa.nome;
END $function$;
