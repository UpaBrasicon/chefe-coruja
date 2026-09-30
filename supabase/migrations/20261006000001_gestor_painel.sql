-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — Painel do Gestor (P/index.html 6879–7019,
-- valsPainel 25224–25345) e Indicadores (9456–9559).
--
-- O que o protótipo guardava no estado da tela vira banco:
--
--  * AUDITORIA DE CHECK-IN (previsto × realizado): cada plantão do dia da
--    escala com o check-in que casou com ele (pelo plantão ou pelo mesmo
--    profissional, data e turno) e os check-ins do dia sem plantão na escala.
--    Tolerância de 15 minutos, a mesma do painel do gestor ("sem check-in há
--    mais de 15 minutos"). Situações: confere, atraso, fora do raio, atraso e
--    fora do raio, sem check-in, sem escala; e as que não são divergência
--    (a começar, aguardando os 15 minutos).
--  * PANORAMA DA UNIDADE (o carrossel): os números vêm de uma chamada só
--    (panorama_gestor), da unidade inteira, contados agora; o catálogo dos
--    painéis e das medidas fica na tela. O que o gestor TIROU do carrossel
--    (painel "p:<chave>" ou medida "c:<painel>|<medida>") vive em
--    panorama_preferencias, por gestor e unidade — no protótipo era do
--    navegador.
--  * PEDIDO DE MEDIDA ("Adicionar uma medida"): o texto do gestor fica
--    registrado, em preparo e sem número, até alguém montar a consulta. Nada
--    é inventado na tela.
--  * PERGUNTA SOBRE A GESTÃO: a Central tem busca com IA, mas é a biblioteca
--    CLÍNICA (fontes e fichas); ela não conhece escala, leito nem estoque.
--    Aqui a pergunta é respondida pelo banco da unidade, por tema
--    reconhecido (ocupação, carga de plantões, alta e permanência, farmácia,
--    check-in, porta). Tema não reconhecido diz que não sabe e oferece virar
--    pedido de medida.
--
-- Acesso: gestor da unidade (private.gestor_da_unidade), com segundo fator.
-- Nenhum nome de paciente sai daqui. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. auditoria de check-in ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auditoria_checkin(p_unidade uuid, p_data date DEFAULT NULL)
RETURNS TABLE (plantao_id uuid, presenca_id uuid, perfil_id uuid, nome text, papel text, setor text, turno text,
               previsto timestamptz, fim_previsto timestamptz, realizado timestamptz, diferenca_min int,
               dentro boolean, distancia_m int, justificativa text, situacao text, divergente boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_data date := coalesce(p_data, private.data_atual());
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
                    WHEN now() < c.inicio + interval '15 minutes' THEN 'aguardando'
                    ELSE 'sem_checkin' END
             WHEN c.checkin_em > c.inicio + interval '15 minutes' AND c.checkin_dentro IS FALSE THEN 'atraso_fora_do_raio'
             WHEN c.checkin_em > c.inicio + interval '15 minutes' THEN 'atraso'
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

-- ── 2. números do panorama ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.internacao_ativa_fora_observacao(p_unidade uuid)
RETURNS SETOF public.internacoes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.* FROM public.internacoes i
   WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
     AND NOT private.setor_de_observacao(i.setor_atual_id)
$$;

CREATE TABLE IF NOT EXISTS public.panorama_preferencias (
  perfil_id     uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  fora          text[] NOT NULL DEFAULT '{}',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, unidade_id),
  CONSTRAINT panorama_preferencias_fora_tamanho CHECK (cardinality(fora) <= 200)
);
ALTER TABLE public.panorama_preferencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.panorama_preferencias FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.panorama_preferencias FROM authenticated;
GRANT SELECT ON public.panorama_preferencias TO authenticated;
DROP POLICY IF EXISTS panorama_preferencias_select ON public.panorama_preferencias;
CREATE POLICY panorama_preferencias_select ON public.panorama_preferencias FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());
DROP POLICY IF EXISTS panorama_preferencias_segundo_fator ON public.panorama_preferencias;
CREATE POLICY panorama_preferencias_segundo_fator ON public.panorama_preferencias AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());

CREATE OR REPLACE FUNCTION public.panorama_gestor(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
    'permanencia_media_d', (SELECT round(avg(extract(epoch FROM i.data_alta - i.data_admissao) / 86400)::numeric, 1)
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
END $$;

CREATE OR REPLACE FUNCTION public.definir_panorama(p_unidade uuid, p_fora text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fora text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o panorama é do gestor da unidade.';
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), '{}') INTO v_fora FROM unnest(coalesce(p_fora, '{}')) x;
  IF cardinality(v_fora) > 200 OR EXISTS (SELECT 1 FROM unnest(v_fora) x WHERE x !~ '^(p|c):.{1,120}$') THEN
    RAISE EXCEPTION 'Escolha do panorama inválida.';
  END IF;
  INSERT INTO public.panorama_preferencias (perfil_id, unidade_id, fora)
  VALUES (private.meu_perfil_id(), p_unidade, v_fora)
  ON CONFLICT (perfil_id, unidade_id) DO UPDATE SET fora = EXCLUDED.fora, atualizado_em = now();
END $$;

-- ── 3. pedido de medida ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medidas_pedidas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  autor_id    uuid NOT NULL REFERENCES public.perfis(id),
  texto       text NOT NULL CHECK (length(btrim(texto)) BETWEEN 5 AND 300),
  painel      text CHECK (painel IS NULL OR length(painel) <= 80),
  situacao    text NOT NULL DEFAULT 'em_preparo' CHECK (situacao IN ('em_preparo', 'retirada')),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  retirada_em timestamptz,
  retirada_por uuid REFERENCES public.perfis(id)
);
CREATE INDEX IF NOT EXISTS medidas_pedidas_unidade_idx ON public.medidas_pedidas (unidade_id, situacao, criado_em DESC);
ALTER TABLE public.medidas_pedidas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medidas_pedidas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.medidas_pedidas FROM authenticated;
GRANT SELECT ON public.medidas_pedidas TO authenticated;
DROP POLICY IF EXISTS medidas_pedidas_select ON public.medidas_pedidas;
CREATE POLICY medidas_pedidas_select ON public.medidas_pedidas FOR SELECT TO authenticated
  USING (private.gestor_da_unidade(unidade_id));
DROP POLICY IF EXISTS medidas_pedidas_segundo_fator ON public.medidas_pedidas;
CREATE POLICY medidas_pedidas_segundo_fator ON public.medidas_pedidas AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());

CREATE OR REPLACE FUNCTION public.pedir_medida(p_unidade uuid, p_texto text, p_painel text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_txt text := btrim(coalesce(p_texto, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o pedido de medida é do gestor da unidade.';
  END IF;
  IF length(v_txt) < 5 THEN RAISE EXCEPTION 'Descreva a medida em pelo menos 5 caracteres.'; END IF;
  IF length(v_txt) > 300 THEN RAISE EXCEPTION 'A medida tem no máximo 300 caracteres.'; END IF;
  INSERT INTO public.medidas_pedidas (unidade_id, autor_id, texto, painel)
  VALUES (p_unidade, private.meu_perfil_id(), v_txt, nullif(btrim(coalesce(p_painel, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- retirar e o desfazer do retirar (a medida volta a ficar em preparo)
CREATE OR REPLACE FUNCTION public.retirar_medida(p_id uuid, p_retirar boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.medidas_pedidas%ROWTYPE;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.medidas_pedidas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.gestor_da_unidade(m.unidade_id) THEN RAISE EXCEPTION 'Medida não encontrada.'; END IF;
  IF p_retirar THEN
    UPDATE public.medidas_pedidas SET situacao = 'retirada', retirada_em = now(), retirada_por = private.meu_perfil_id()
     WHERE id = p_id AND situacao = 'em_preparo';
  ELSE
    UPDATE public.medidas_pedidas SET situacao = 'em_preparo', retirada_em = NULL, retirada_por = NULL
     WHERE id = p_id AND situacao = 'retirada';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.medidas_pedidas_da_unidade(p_unidade uuid)
RETURNS TABLE (id uuid, texto text, painel text, criado_em timestamptz, autor_nome text, minha boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT m.id, m.texto, m.painel, m.criado_em, pf.nome_completo, m.autor_id = private.meu_perfil_id()
    FROM public.medidas_pedidas m JOIN public.perfis pf ON pf.id = m.autor_id
   WHERE m.unidade_id = p_unidade AND m.situacao = 'em_preparo'
   ORDER BY m.criado_em DESC;
END $$;

-- ── 4. pergunta sobre a gestão da unidade ───────────────────────────────────
-- Resposta: {entendida, tema, titulo, resposta, itens: [{rotulo, valor}], link}
CREATE OR REPLACE FUNCTION public.perguntar_gestao(p_unidade uuid, p_pergunta text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  q text := translate(lower(btrim(coalesce(p_pergunta, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_hoje date := private.data_atual();
  n jsonb;
  itens jsonb;
  v_media numeric;
  v_taxa numeric;
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
        SELECT s.nome, count(*) AS n, round(avg(extract(epoch FROM now() - i.data_admissao) / 86400)::numeric, 1) AS dias
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
                      || CASE WHEN x.horas > 60 THEN ' · acima de 60 h' ELSE '' END) ORDER BY x.horas DESC), '[]'::jsonb)
      INTO itens FROM (
        SELECT pf.nome_completo AS nome, sum(e.duracao_min) / 60.0 AS horas, count(*) AS n
          FROM public.escala_plantao e JOIN public.perfis pf ON pf.id = e.perfil_id
         WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_hoje - 6 AND v_hoje
         GROUP BY pf.id, pf.nome_completo
         ORDER BY sum(e.duracao_min) DESC LIMIT 8) x;
    RETURN jsonb_build_object('entendida', true, 'tema', 'carga', 'titulo', 'Carga de plantões nos últimos 7 dias',
      'resposta', 'Horas escaladas por profissional nesta unidade de ' || to_char(v_hoje - 6, 'DD/MM') || ' a ' || to_char(v_hoje, 'DD/MM')
        || '. O limite interno do Olho de Gavião é 60 horas em 7 dias; outras unidades não entram na conta.',
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
END $$;

-- ── permissões ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.internacao_ativa_fora_observacao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditoria_checkin(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.panorama_gestor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_panorama(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pedir_medida(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.retirar_medida(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.medidas_pedidas_da_unidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.perguntar_gestao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_checkin(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.panorama_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_panorama(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pedir_medida(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retirar_medida(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.medidas_pedidas_da_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perguntar_gestao(uuid, text) TO authenticated;
