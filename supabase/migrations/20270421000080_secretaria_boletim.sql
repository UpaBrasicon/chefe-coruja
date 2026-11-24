-- ════════════════════════════════════════════════════════════════════════════
-- Boletim bimestral do Gestor da secretaria (pedido do RT, 24/11/2026).
--
-- O modelo é a apresentação bimestral de indicadores que a secretaria
-- municipal já usa (dois meses lado a lado, com a variação). O mapa de cada
-- página do modelo para os dados do app e as decisões do RT estão nas notas da
-- sessão (boletim-secretaria-mapa.md e dados-reunioes-bi.md):
--   • número exato no boletim do Gestor da secretaria (sem "< 5");
--   • turno diurno de 07:00 a 19:00 e noturno de 19:00 a 07:00 (Brasília);
--   • a estabilização é marcada no cadastro do setor de cada unidade;
--   • SAPS 3 e características clínicas (Epimed) ficam fora, com nota da fonte;
--   • P1: mais quatro indicadores de contrato (atendidos no tempo-alvo da cor,
--     retorno em 72 h, permanência na porta abaixo de 24 h e taxa de
--     transferência) e a visão mensal além da bimestral;
--   • P2: metas do contrato por unidade (meta, realizado, cumpriu);
--   • SE1 e SE2: a Rede da secretaria mostra o estado de cada unidade em uma
--     linha e conta a pessoa uma vez, não o vínculo.
--
-- Expand: coluna nova com padrão, tabela nova e funções novas. Nada que existe
-- muda de forma; nenhuma função existente é redefinida.
--
-- 1. setores.estabilizacao (boolean, padrão false): o setor que conta como
--    estabilização no boletim. A tela Setores e leitos marca e desmarca.
-- 2. public.metas_contrato: meta do contrato de gestão por unidade e
--    indicador, com sentido (maior ou menor é melhor), peso e vigência. Sem
--    dado de paciente. Leitura pelo gestor da unidade, pela secretaria da
--    unidade e pelo administrador; gravação só pelas RPCs
--    salvar_meta_contrato e remover_meta_contrato (secretaria da unidade ou
--    administrador, segundo fator e auditoria).
-- 3. public.secretaria_boletim(p_unidade, p_mes_a, p_mes_b): o boletim de dois
--    meses de uma unidade, ou de todas as unidades da minha secretaria
--    (p_unidade nulo). Só agregado: contagens, médias, taxas e listas de CID,
--    causa, especialidade e destino; nenhum identificador de paciente.
--    private.boletim_mes faz a conta de um mês.
-- 4. public.secretaria_estado_unidades(): a linha de cada unidade na Rede da
--    secretaria (leitos ocupados agora, escala de hoje, vagas abertas até o
--    fim do mês, regulações vencidas e pessoas, cada uma uma vez). Ocupados e
--    regulações vencidas de 1 a 4 voltam vazios (private.suprimir, ADR 0002),
--    como em secretaria_indicadores.
--
-- Teste: supabase/tests/secretaria_boletim.sql
-- Rollback: docs/rede/ROLLBACK-20270421000080.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. setor da estabilização ─────────────────────────────────────────────
ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS estabilizacao boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.setores.estabilizacao IS
  'O setor conta como estabilização no boletim da secretaria (decisão do RT, 24/11/2026). Marcado em Setores e leitos.';

-- ── 2. metas do contrato ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.metas_contrato (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  -- chave do indicador no boletim (catálogo em src/lib/boletim.ts)
  indicador      text NOT NULL CHECK (indicador ~ '^[a-z0-9_]{3,60}$'),
  meta           numeric NOT NULL CHECK (meta >= 0),
  -- 'maior': cumpre quando o realizado fica na meta ou acima; 'menor': na meta ou abaixo
  sentido        text NOT NULL CHECK (sentido IN ('maior', 'menor')),
  -- peso no repasse, em pontos percentuais (opcional)
  peso           numeric CHECK (peso IS NULL OR (peso >= 0 AND peso <= 100)),
  vigente_de     date NOT NULL,
  vigente_ate    date,
  observacao     text CHECK (observacao IS NULL OR length(observacao) <= 500),
  criado_por     uuid NOT NULL REFERENCES public.perfis(id),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.perfis(id),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_contrato_vigencia CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_de)
);
CREATE INDEX IF NOT EXISTS metas_contrato_unidade ON public.metas_contrato (unidade_id, indicador, vigente_de);
COMMENT ON TABLE public.metas_contrato IS
  'Metas do contrato de gestão por unidade (P2 do RT, 24/11/2026). Sem dado de paciente. Gravação só por salvar_meta_contrato e remover_meta_contrato.';

ALTER TABLE public.metas_contrato ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.metas_contrato FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.metas_contrato TO authenticated;

-- quem define a meta: a secretaria da unidade e o administrador da organização
CREATE OR REPLACE FUNCTION private.pode_definir_metas(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
       private.eh_super_admin()
    OR private.secretaria_gere_unidade(p_unidade)
    OR EXISTS (SELECT 1 FROM public.unidades u
                WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id)),
    false)
$$;
REVOKE ALL ON FUNCTION private.pode_definir_metas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_definir_metas(uuid) TO authenticated;

-- quem lê: os mesmos e o gestor da unidade
DROP POLICY IF EXISTS metas_contrato_select ON public.metas_contrato;
CREATE POLICY metas_contrato_select ON public.metas_contrato FOR SELECT TO authenticated
  USING (private.pode_definir_metas(unidade_id) OR coalesce(private.gestor_da_unidade(unidade_id), false));

-- Cria (p_id nulo) ou muda uma meta. A mesma unidade e indicador não têm duas
-- metas com vigência sobreposta.
CREATE OR REPLACE FUNCTION public.salvar_meta_contrato(
  p_unidade uuid, p_indicador text, p_meta numeric, p_sentido text, p_vigente_de date,
  p_id uuid DEFAULT NULL, p_peso numeric DEFAULT NULL, p_vigente_ate date DEFAULT NULL, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_id uuid;
  v_antes public.metas_contrato;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_eu IS NULL OR p_unidade IS NULL OR NOT private.pode_definir_metas(p_unidade) THEN
    RAISE EXCEPTION 'As metas do contrato são da secretaria da unidade e do administrador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_indicador IS NULL OR p_indicador !~ '^[a-z0-9_]{3,60}$' THEN
    RAISE EXCEPTION 'Indicador inválido.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_meta IS NULL OR p_meta < 0 THEN RAISE EXCEPTION 'Meta inválida.' USING ERRCODE = 'check_violation'; END IF;
  IF p_sentido IS NULL OR p_sentido NOT IN ('maior', 'menor') THEN
    RAISE EXCEPTION 'Sentido inválido.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_peso IS NOT NULL AND (p_peso < 0 OR p_peso > 100) THEN
    RAISE EXCEPTION 'O peso vai de 0 a 100.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_vigente_de IS NULL OR (p_vigente_ate IS NOT NULL AND p_vigente_ate < p_vigente_de) THEN
    RAISE EXCEPTION 'Vigência inválida.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_observacao IS NOT NULL AND length(p_observacao) > 500 THEN
    RAISE EXCEPTION 'Observação com mais de 500 caracteres.' USING ERRCODE = 'check_violation';
  END IF;

  -- uma meta por vez para a mesma unidade e indicador
  PERFORM pg_advisory_xact_lock(hashtext('metas_contrato:' || p_unidade::text || ':' || p_indicador));

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_antes FROM public.metas_contrato WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Meta não encontrada.' USING ERRCODE = 'no_data_found'; END IF;
    IF v_antes.unidade_id <> p_unidade THEN
      RAISE EXCEPTION 'A meta é de outra unidade.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.metas_contrato m
              WHERE m.unidade_id = p_unidade AND m.indicador = p_indicador
                AND m.id IS DISTINCT FROM p_id
                AND m.vigente_de <= coalesce(p_vigente_ate, 'infinity'::date)
                AND coalesce(m.vigente_ate, 'infinity'::date) >= p_vigente_de) THEN
    RAISE EXCEPTION 'Já existe meta deste indicador com vigência no mesmo período.' USING ERRCODE = 'unique_violation';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.metas_contrato (unidade_id, indicador, meta, sentido, peso, vigente_de, vigente_ate, observacao, criado_por)
    VALUES (p_unidade, p_indicador, p_meta, p_sentido, p_peso, p_vigente_de, p_vigente_ate, nullif(btrim(p_observacao), ''), v_eu)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.metas_contrato
       SET indicador = p_indicador, meta = p_meta, sentido = p_sentido, peso = p_peso,
           vigente_de = p_vigente_de, vigente_ate = p_vigente_ate, observacao = nullif(btrim(p_observacao), ''),
           atualizado_por = v_eu, atualizado_em = now()
     WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  PERFORM private.registrar_auditoria('meta_contrato_salva', 'metas_contrato', v_id, p_unidade,
    jsonb_build_object('indicador', p_indicador, 'meta', p_meta, 'sentido', p_sentido, 'peso', p_peso,
                       'vigente_de', p_vigente_de, 'vigente_ate', p_vigente_ate,
                       'antes', CASE WHEN p_id IS NULL THEN NULL ELSE to_jsonb(v_antes) - 'criado_por' - 'atualizado_por' END));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_meta_contrato(uuid, text, numeric, text, date, uuid, numeric, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_meta_contrato(uuid, text, numeric, text, date, uuid, numeric, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remover_meta_contrato(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_antes public.metas_contrato;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v_antes FROM public.metas_contrato WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta não encontrada.' USING ERRCODE = 'no_data_found'; END IF;
  IF private.meu_perfil_id() IS NULL OR NOT private.pode_definir_metas(v_antes.unidade_id) THEN
    RAISE EXCEPTION 'As metas do contrato são da secretaria da unidade e do administrador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.metas_contrato WHERE id = p_id;
  PERFORM private.registrar_auditoria('meta_contrato_removida', 'metas_contrato', p_id, v_antes.unidade_id,
    to_jsonb(v_antes) - 'criado_por' - 'atualizado_por');
END $$;
REVOKE ALL ON FUNCTION public.remover_meta_contrato(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_meta_contrato(uuid) TO authenticated;

-- ── 3. o boletim ──────────────────────────────────────────────────────────
-- nome do CID pela CID-10 do app (código com ou sem ponto)
CREATE OR REPLACE FUNCTION private.boletim_cid_nome(p_cid text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.descricao FROM terminologia.cid10 c
   WHERE c.codigo IN (upper(btrim(p_cid)), replace(upper(btrim(p_cid)), '.', ''))
   ORDER BY length(c.codigo) DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.boletim_cid_nome(text) FROM PUBLIC, anon, authenticated;

-- Um mês do boletim para um conjunto de unidades. Só chamada por
-- public.secretaria_boletim, que confere o acesso.
--
-- Porta: fichas do mês pela chegada (fora a agenda e a atenção primária, fora
-- as canceladas); atendida = teve início de atendimento médico. Público pela
-- ficha (ou pela última classificação); turno pela hora da chegada.
-- Internação: as passagens de cada internação por setor saem dos eventos ADT
-- (eventos_adt: o setor depois de cada evento); sem evento, a internação
-- inteira fica no setor atual. A ala do setor: estabilização (marcada no
-- cadastro), enfermaria pediátrica (internação ou isolamento com público
-- pediátrico) ou enfermaria adulto (as demais de internação e isolamento).
-- Paciente-dia = horas de passagem no mês / 24; ocupação = paciente-dia /
-- (leitos ativos hoje × dias do mês até agora); giro = saídas / leitos;
-- permanência média = paciente-dia / saídas.
CREATE OR REPLACE FUNCTION private.boletim_mes(p_unidades uuid[], p_ini date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_de timestamptz := p_ini::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ate timestamptz := (p_ini + interval '1 month')::date::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_dias numeric;
  v_porta jsonb;
  v_cids jsonb;
  v_int jsonb;
  v_saidas bigint;
  v_obitos jsonb;
  v_enc jsonb;
  v_prod jsonb;
  v_notif jsonb;
  v_atendidas bigint;
  v_transf bigint;
  v_ob_int bigint;
BEGIN
  -- dias do mês até agora (mês corrente) ou o mês inteiro
  v_dias := greatest(extract(epoch FROM least(now(), v_ate) - v_de) / 86400.0, 0);

  -- ── porta ──
  WITH alvos AS (
    SELECT u AS unidade_id, private.tempos_alvo_unidade(u) AS t FROM unnest(p_unidades) AS u
  ), ep AS (
    SELECT e.id, e.paciente_id, e.chegada_em, e.atendimento_iniciado_em AS atendido_em, e.desfecho,
           CASE WHEN e.desfecho = 'internacao' THEN e.desfecho_em ELSE coalesce(e.encerrado_em, e.desfecho_em) END AS saiu_em,
           coalesce(e.publico, cl.publico_ult) AS publico,
           (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
             AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::time < time '19:00' AS diurno,
           coalesce(cl.primeira_em, e.classificado_em) AS classificado_em,
           coalesce(cr.cor, e.cor_atual) AS cor,
           a.t AS alvos
      FROM public.episodios e
      JOIN alvos a ON a.unidade_id = e.unidade_id
      LEFT JOIN LATERAL (
        SELECT min(c.criado_em) FILTER (WHERE NOT c.reclassificacao) AS primeira_em,
               (array_agg(c.publico ORDER BY c.criado_em DESC))[1] AS publico_ult
          FROM public.classificacoes_risco c WHERE c.episodio_id = e.id) cl ON true
      -- a cor da classificação mais recente antes do médico (como indicador_espera_medico)
      LEFT JOIN LATERAL (
        SELECT c.cor FROM public.classificacoes_risco c
         WHERE c.episodio_id = e.id AND c.criado_em <= coalesce(e.atendimento_iniciado_em, now())
         ORDER BY c.criado_em DESC LIMIT 1) cr ON true
     WHERE e.unidade_id = ANY (p_unidades)
       AND e.chegada_em >= v_de AND e.chegada_em < v_ate
       AND e.agendamento_id IS NULL AND e.tipo_atendimento_aps IS NULL
       AND e.desfecho IS DISTINCT FROM 'cancelado'
  ), ep2 AS (
    SELECT ep.*,
           ep.atendido_em IS NOT NULL AS atendido,
           ep.atendido_em IS NOT NULL AND ep.classificado_em IS NOT NULL AND ep.cor IS NOT NULL AND ep.alvos ? ep.cor AS avaliado,
           ep.atendido_em IS NOT NULL AND ep.classificado_em IS NOT NULL AND ep.cor IS NOT NULL AND ep.alvos ? ep.cor
             -- minutos inteiros: o alvo imediato (0) só atrasa com 1 min completo
             AND floor(extract(epoch FROM ep.atendido_em - ep.classificado_em) / 60) <= (ep.alvos ->> ep.cor)::int AS no_alvo,
           -- retorno: outra ficha do mesmo paciente que terminou até 72 h antes desta chegada
           EXISTS (SELECT 1 FROM public.episodios p
                    WHERE p.paciente_id = ep.paciente_id AND p.id <> ep.id
                      AND p.chegada_em < ep.chegada_em
                      AND p.agendamento_id IS NULL AND p.tipo_atendimento_aps IS NULL
                      AND p.desfecho IS DISTINCT FROM 'cancelado'
                      AND coalesce(p.encerrado_em, p.desfecho_em) >= ep.chegada_em - interval '72 hours'
                      AND coalesce(p.encerrado_em, p.desfecho_em) <= ep.chegada_em) AS retorno
      FROM ep
  ), cid AS (
    SELECT x.publico, d.cid, count(DISTINCT x.id) AS n, mode() WITHIN GROUP (ORDER BY d.descricao) AS descricao
      FROM ep2 x
      JOIN public.diagnosticos_episodio d ON d.episodio_id = x.id AND d.tipo = 'primario' AND d.encerramento IS NULL
     WHERE x.publico IN ('adulto', 'pediatrico')
     GROUP BY x.publico, d.cid
  ), cid_top AS (
    SELECT c.*, row_number() OVER (PARTITION BY c.publico ORDER BY c.n DESC, c.cid) AS pos FROM cid c
  )
  SELECT jsonb_build_object(
           'fichas', count(*),
           'atendidas', count(*) FILTER (WHERE atendido),
           'nao_atendidas', count(*) FILTER (WHERE NOT atendido),
           'taxa_atendimento', CASE WHEN count(*) > 0 THEN round(100.0 * count(*) FILTER (WHERE atendido) / count(*), 1) END,
           'turnos', jsonb_build_object(
             'adulto_diurno', count(*) FILTER (WHERE atendido AND publico = 'adulto' AND diurno),
             'adulto_noturno', count(*) FILTER (WHERE atendido AND publico = 'adulto' AND NOT diurno),
             'pediatrico_diurno', count(*) FILTER (WHERE atendido AND publico = 'pediatrico' AND diurno),
             'pediatrico_noturno', count(*) FILTER (WHERE atendido AND publico = 'pediatrico' AND NOT diurno),
             'sem_publico', count(*) FILTER (WHERE atendido AND publico IS NULL)),
           'espera_classificacao_min', round((avg(extract(epoch FROM classificado_em - chegada_em) / 60.0)
                                              FILTER (WHERE classificado_em >= chegada_em))::numeric, 1),
           'espera_medico_min', round((avg(extract(epoch FROM atendido_em - classificado_em) / 60.0)
                                       FILTER (WHERE atendido_em >= classificado_em))::numeric, 1),
           'no_alvo', jsonb_build_object(
             'avaliados', count(*) FILTER (WHERE avaliado),
             'dentro', count(*) FILTER (WHERE no_alvo),
             'pct', CASE WHEN count(*) FILTER (WHERE avaliado) > 0
                         THEN round(100.0 * count(*) FILTER (WHERE no_alvo) / count(*) FILTER (WHERE avaliado), 1) END,
             'por_cor', (SELECT jsonb_object_agg(c.cor, jsonb_build_object(
                            'avaliados', (SELECT count(*) FROM ep2 y WHERE y.cor = c.cor AND y.avaliado),
                            'dentro', (SELECT count(*) FROM ep2 y WHERE y.cor = c.cor AND y.no_alvo)))
                           FROM unnest(ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul']) AS c(cor))),
           'retorno_72h', jsonb_build_object(
             'retornos', count(*) FILTER (WHERE retorno),
             'pct', CASE WHEN count(*) > 0 THEN round(100.0 * count(*) FILTER (WHERE retorno) / count(*), 1) END),
           'permanencia_24h', jsonb_build_object(
             'saidas', count(*) FILTER (WHERE saiu_em IS NOT NULL),
             'menos_24h', count(*) FILTER (WHERE saiu_em IS NOT NULL AND saiu_em - chegada_em < interval '24 hours'),
             'pct', CASE WHEN count(*) FILTER (WHERE saiu_em IS NOT NULL) > 0
                         THEN round(100.0 * count(*) FILTER (WHERE saiu_em IS NOT NULL AND saiu_em - chegada_em < interval '24 hours')
                                    / count(*) FILTER (WHERE saiu_em IS NOT NULL), 1) END)),
         jsonb_build_object(
           'adulto', coalesce((SELECT jsonb_agg(jsonb_build_object('cid', t.cid, 'nome', coalesce(private.boletim_cid_nome(t.cid), t.descricao, t.cid), 'n', t.n) ORDER BY t.pos)
                                 FROM cid_top t WHERE t.publico = 'adulto' AND t.pos <= 5), '[]'::jsonb),
           'pediatrico', coalesce((SELECT jsonb_agg(jsonb_build_object('cid', t.cid, 'nome', coalesce(private.boletim_cid_nome(t.cid), t.descricao, t.cid), 'n', t.n) ORDER BY t.pos)
                                     FROM cid_top t WHERE t.publico = 'pediatrico' AND t.pos <= 5), '[]'::jsonb)),
         count(*) FILTER (WHERE atendido)
    INTO v_porta, v_cids, v_atendidas
    FROM ep2;

  -- ── internação por ala ──
  WITH al AS (
    SELECT s.id AS setor_id,
           CASE WHEN s.estabilizacao THEN 'estabilizacao'
                WHEN s.tipo::text IN ('internacao', 'isolamento')
                     AND (s.publico = 'pediatrico' OR coalesce(s.regulacao_tipo_leito, '') LIKE '%pediatric%') THEN 'enfermaria_pediatrica'
                WHEN s.tipo::text IN ('internacao', 'isolamento') THEN 'enfermaria_adulto' END AS ala,
           (SELECT count(*) FROM public.leitos l WHERE l.setor_id = s.id AND l.ativo) AS leitos,
           s.ativo
      FROM public.setores s WHERE s.unidade_id = ANY (p_unidades)
  ), it AS (
    SELECT i.id, i.data_admissao, i.data_alta, i.cid_principal, i.setor_atual_id, i.origem_admissao
      FROM public.internacoes i
     WHERE i.unidade_id = ANY (p_unidades) AND i.data_admissao < v_ate
       AND (i.data_alta IS NULL OR i.data_alta >= v_de)
  ), ev AS (
    SELECT e.internacao_id, e.seq, e.created_at AS em, e.tipo_evento,
           coalesce(CASE WHEN (e.estado_depois ->> 'setor') ~ '^[0-9a-fA-F-]{36}$' THEN (e.estado_depois ->> 'setor')::uuid END,
                    e.setor_destino_id, e.setor_origem_id) AS setor_id
      FROM public.eventos_adt e WHERE e.internacao_id IN (SELECT it.id FROM it)
  ), seg AS (
    SELECT ev.internacao_id, ev.seq, ev.setor_id, ev.em AS inicio, ev.tipo_evento,
           lead(ev.em) OVER (PARTITION BY ev.internacao_id ORDER BY ev.seq) AS proximo
      FROM ev
  ), seg2 AS (
    -- a alta, o óbito e a saída para fora não abrem passagem
    SELECT s.internacao_id, s.seq, s.setor_id, s.inicio,
           CASE WHEN s.proximo IS NULL AND it.data_alta IS NULL THEN NULL
                ELSE least(coalesce(s.proximo, 'infinity'::timestamptz), coalesce(it.data_alta, 'infinity'::timestamptz)) END AS fim
      FROM seg s JOIN it ON it.id = s.internacao_id
     WHERE s.tipo_evento NOT IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito')
    UNION ALL
    -- internação sem evento: inteira no setor atual
    SELECT it.id, 0, it.setor_atual_id, it.data_admissao, it.data_alta
      FROM it WHERE NOT EXISTS (SELECT 1 FROM ev WHERE ev.internacao_id = it.id)
  ), ilhas AS (
    SELECT x.*, sum(x.muda) OVER (PARTITION BY x.internacao_id ORDER BY x.seq) AS grupo
      FROM (SELECT seg2.*,
                   CASE WHEN seg2.setor_id IS NOT DISTINCT FROM lag(seg2.setor_id) OVER (PARTITION BY seg2.internacao_id ORDER BY seg2.seq)
                        THEN 0 ELSE 1 END AS muda
              FROM seg2) x
  ), estadas AS (
    SELECT i.internacao_id, i.setor_id, min(i.inicio) AS inicio,
           CASE WHEN bool_or(i.fim IS NULL) THEN NULL ELSE max(i.fim) END AS fim, min(i.seq) AS seq0
      FROM ilhas i GROUP BY i.internacao_id, i.setor_id, i.grupo
  ), estadas2 AS (
    SELECT e.*, lag(e.setor_id) OVER (PARTITION BY e.internacao_id ORDER BY e.seq0) AS setor_antes
      FROM estadas e
  ), ea AS (
    SELECT e.internacao_id, e.inicio, e.fim, al.ala, it.cid_principal,
           greatest(e.inicio, v_de) AS ini_m,
           least(coalesce(e.fim, now()), v_ate) AS fim_m,
           CASE WHEN e.setor_antes IS NULL AND it.origem_admissao = 'outra_unidade' THEN 'outra_unidade'
                WHEN ant.ala IN ('enfermaria_adulto', 'enfermaria_pediatrica') THEN 'enfermaria'
                WHEN ant.ala = 'estabilizacao' THEN 'estabilizacao'
                ELSE 'emergencia' END AS origem
      FROM estadas2 e
      JOIN it ON it.id = e.internacao_id
      JOIN al ON al.setor_id = e.setor_id AND al.ala IS NOT NULL
      LEFT JOIN al ant ON ant.setor_id = e.setor_antes
     WHERE e.inicio < v_ate AND coalesce(e.fim, now()) > v_de
  ), por_ala AS (
    SELECT a.ala,
           count(*) AS total,
           count(*) FILTER (WHERE a.inicio >= v_de) AS novas,
           count(*) FILTER (WHERE a.inicio < v_de) AS anteriores,
           round(sum(greatest(extract(epoch FROM a.fim_m - a.ini_m), 0)) / 86400.0, 1) AS paciente_dia,
           count(*) FILTER (WHERE a.fim IS NOT NULL AND a.fim >= v_de AND a.fim < v_ate) AS saidas
      FROM ea a GROUP BY a.ala
  ), leitos_ala AS (
    SELECT al.ala, sum(al.leitos) AS leitos FROM al WHERE al.ala IS NOT NULL AND al.ativo GROUP BY al.ala
  ), diag AS (
    SELECT a.ala, a.cid_principal AS cid, count(DISTINCT a.internacao_id) AS n,
           row_number() OVER (PARTITION BY a.ala ORDER BY count(DISTINCT a.internacao_id) DESC, a.cid_principal) AS pos
      FROM ea a WHERE a.cid_principal IS NOT NULL GROUP BY a.ala, a.cid_principal
  ), origem AS (
    SELECT a.ala, jsonb_object_agg(a.origem, a.n) AS por_origem
      FROM (SELECT ea.ala, ea.origem, count(*) AS n FROM ea WHERE ea.inicio >= v_de GROUP BY ea.ala, ea.origem) a
     GROUP BY a.ala
  )
  SELECT coalesce(jsonb_object_agg(k.ala, jsonb_build_object(
           'total', coalesce(p.total, 0),
           'novas', coalesce(p.novas, 0),
           'anteriores', coalesce(p.anteriores, 0),
           'leitos', coalesce(l.leitos, 0),
           'paciente_dia', coalesce(p.paciente_dia, 0),
           'saidas', coalesce(p.saidas, 0),
           'ocupacao', CASE WHEN coalesce(l.leitos, 0) > 0 AND v_dias > 0
                            THEN round(100.0 * coalesce(p.paciente_dia, 0) / (l.leitos * v_dias), 1) END,
           'giro', CASE WHEN coalesce(l.leitos, 0) > 0 THEN round(coalesce(p.saidas, 0)::numeric / l.leitos, 1) END,
           'permanencia_media_dias', CASE WHEN coalesce(p.saidas, 0) > 0 THEN round(p.paciente_dia / p.saidas, 1) END,
           'diagnosticos', coalesce((SELECT jsonb_agg(jsonb_build_object('cid', d.cid, 'nome', coalesce(private.boletim_cid_nome(d.cid), d.cid), 'n', d.n) ORDER BY d.pos)
                                       FROM diag d WHERE d.ala = k.ala AND d.pos <= 5), '[]'::jsonb),
           'origem', coalesce(o.por_origem, '{}'::jsonb))), '{}'::jsonb)
    INTO v_int
    FROM unnest(ARRAY['enfermaria_adulto', 'enfermaria_pediatrica', 'estabilizacao']) AS k(ala)
    LEFT JOIN por_ala p ON p.ala = k.ala
    LEFT JOIN leitos_ala l ON l.ala = k.ala
    LEFT JOIN origem o ON o.ala = k.ala;

  -- saídas de internação (alta, óbito, transferência) no mês com o último setor numa ala
  SELECT count(*) INTO v_saidas
    FROM public.internacoes i
    JOIN public.setores s ON s.id = i.setor_atual_id
   WHERE i.unidade_id = ANY (p_unidades) AND i.data_alta >= v_de AND i.data_alta < v_ate
     AND (s.estabilizacao OR s.tipo::text IN ('internacao', 'isolamento'));

  -- ── óbitos ──
  WITH o AS (
    SELECT ob.hora_obito,
           CASE WHEN s.estabilizacao THEN 'estabilizacao'
                WHEN s.tipo::text IN ('internacao', 'isolamento') THEN 'enfermaria'
                ELSE 'porta' END AS onde,
           coalesce(i.data_admissao, e.chegada_em) AS entrou_em,
           coalesce(nullif(btrim(ob.causa_a), ''),
                    CASE ob.encaminhamento WHEN 'svo' THEN 'SVO' WHEN 'iml' THEN 'IML'
                                           WHEN 'causa_desconhecida' THEN 'Causa desconhecida' ELSE 'Causa não informada' END) AS causa
      FROM public.obitos ob
      LEFT JOIN public.setores s ON s.id = ob.setor_id
      LEFT JOIN public.internacoes i ON i.id = ob.internacao_id
      LEFT JOIN public.episodios e ON e.id = ob.episodio_id
     WHERE ob.unidade_id = ANY (p_unidades) AND ob.anulado_em IS NULL
       AND ob.hora_obito >= v_de AND ob.hora_obito < v_ate
  ), causas AS (
    SELECT o.onde, mode() WITHIN GROUP (ORDER BY o.causa) AS causa, count(*) AS n
      FROM o GROUP BY o.onde, lower(o.causa)
  )
  SELECT jsonb_build_object(
           'total', count(*),
           'estabilizacao', count(*) FILTER (WHERE onde = 'estabilizacao'),
           'enfermaria', count(*) FILTER (WHERE onde = 'enfermaria'),
           'porta', count(*) FILTER (WHERE onde = 'porta'),
           'ate_24h', count(*) FILTER (WHERE entrou_em IS NOT NULL AND hora_obito - entrou_em < interval '24 hours'),
           'apos_24h', count(*) FILTER (WHERE entrou_em IS NOT NULL AND hora_obito - entrou_em >= interval '24 hours'),
           'causas', jsonb_build_object(
             'estabilizacao', coalesce((SELECT jsonb_agg(jsonb_build_object('causa', c.causa, 'n', c.n) ORDER BY c.n DESC, c.causa)
                                          FROM causas c WHERE c.onde = 'estabilizacao'), '[]'::jsonb),
             'enfermaria', coalesce((SELECT jsonb_agg(jsonb_build_object('causa', c.causa, 'n', c.n) ORDER BY c.n DESC, c.causa)
                                       FROM causas c WHERE c.onde = 'enfermaria'), '[]'::jsonb),
             'porta', coalesce((SELECT jsonb_agg(jsonb_build_object('causa', c.causa, 'n', c.n) ORDER BY c.n DESC, c.causa)
                                  FROM causas c WHERE c.onde = 'porta'), '[]'::jsonb))),
         count(*) FILTER (WHERE onde IN ('estabilizacao', 'enfermaria'))
    INTO v_obitos, v_ob_int
    FROM o;

  -- ── encaminhamentos e APAC ──
  WITH r AS (
    SELECT rs.tipo, rs.status, rs.destino_unidade_id, rs.destino_externo,
           CASE WHEN rs.tipo = 'exame'
                THEN coalesce((SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = rs.procedimento LIMIT 1), rs.procedimento)
                ELSE coalesce(nullif(btrim(rs.especialidade), ''),
                              CASE WHEN rs.tipo_leito IS NOT NULL THEN 'Leito ' || replace(rs.tipo_leito, '_', ' ') END,
                              (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = rs.procedimento LIMIT 1),
                              rs.procedimento) END AS item,
           coalesce(du.nome, nullif(btrim(rs.destino_externo), ''), 'Destino a definir') AS destino,
           CASE WHEN rs.internacao_id IS NOT NULL THEN 'Internação' ELSE 'Porta' END AS origem
      FROM public.regulacao_solicitacoes rs
      LEFT JOIN public.unidades du ON du.id = rs.destino_unidade_id
     WHERE rs.unidade_origem_id = ANY (p_unidades)
       AND rs.criada_em >= v_de AND rs.criada_em < v_ate
       AND rs.status NOT IN ('rascunho', 'excluida')
  ), itens AS (
    SELECT (r.tipo = 'exame') AS exame, r.item, count(*) AS n,
           mode() WITHIN GROUP (ORDER BY r.destino) AS destino,
           mode() WITHIN GROUP (ORDER BY r.origem) AS origem,
           row_number() OVER (PARTITION BY (r.tipo = 'exame') ORDER BY count(*) DESC, r.item) AS pos
      FROM r GROUP BY (r.tipo = 'exame'), r.item
  )
  SELECT jsonb_build_object(
           'total', count(*),
           'por_tipo', jsonb_build_object(
             'consulta', count(*) FILTER (WHERE tipo = 'consulta'),
             'exame', count(*) FILTER (WHERE tipo = 'exame'),
             'leito', count(*) FILTER (WHERE tipo = 'leito'),
             'transferencia', count(*) FILTER (WHERE tipo = 'transferencia')),
           'especialidades', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', i.item, 'n', i.n, 'destino', i.destino, 'origem', i.origem) ORDER BY i.pos)
                                         FROM itens i WHERE NOT i.exame AND i.pos <= 5), '[]'::jsonb),
           'exames', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', i.item, 'n', i.n, 'destino', i.destino, 'origem', i.origem) ORDER BY i.pos)
                                 FROM itens i WHERE i.exame AND i.pos <= 5), '[]'::jsonb),
           'apac', (SELECT count(*) FROM public.apacs a
                     WHERE a.unidade_id = ANY (p_unidades) AND a.solicitada_em >= v_de AND a.solicitada_em < v_ate
                       AND a.status <> 'cancelada')),
         -- transferência regulada com destino: leito ou transferência autorizada em diante
         count(*) FILTER (WHERE tipo IN ('leito', 'transferencia')
                            AND status IN ('autorizada', 'agendada', 'em_transito', 'realizada')
                            AND (destino_unidade_id IS NOT NULL OR destino_externo IS NOT NULL))
    INTO v_enc, v_transf
    FROM r;

  -- ── produção ──
  SELECT jsonb_build_object(
           'procedimentos', coalesce(sum(p.quantidade), 0),
           -- SIGTAP grupo 04 (procedimentos cirúrgicos: na UPA, as pequenas cirurgias)
           'pequenos_procedimentos', coalesce(sum(p.quantidade) FILTER (WHERE left(p.procedimento, 2) = '04'), 0))
    INTO v_prod
    FROM public.procedimentos_realizados p
   WHERE p.unidade_id = ANY (p_unidades) AND p.cancelado_em IS NULL
     AND p.realizado_em >= v_de AND p.realizado_em < v_ate;

  SELECT v_prod || jsonb_build_object(
           'exames_feitos', count(*),
           'laboratorio', count(*) FILTER (WHERE x.grupo = 'laboratorio'),
           'ecg', count(*) FILTER (WHERE x.ecg),
           'raio_x', count(*) FILTER (WHERE x.rx))
    INTO v_prod
    FROM (
      SELECT coalesce(e.grupo, private.grupo_do_procedimento(e.procedimento)) AS grupo,
             e.procedimento = '0211020036'
               OR (e.procedimento IS NULL AND (e.exame ILIKE '%eletrocardio%' OR e.exame ILIKE '%ECG%')) AS ecg,
             left(e.procedimento, 4) = '0204'
               OR (e.procedimento IS NULL AND (e.exame ILIKE '%raio%x%' OR e.exame ILIKE 'rx %' OR e.exame ILIKE '%radiografia%')) AS rx
        FROM public.exames_pedidos e
       WHERE e.unidade_id = ANY (p_unidades)
         AND (e.situacao IN ('realizado', 'resultado') OR e.realizado_em IS NOT NULL)
         AND e.situacao <> 'cancelado'
         AND coalesce(e.realizado_em, e.resolvido_em, e.coletado_em, e.pedido_em) >= v_de
         AND coalesce(e.realizado_em, e.resolvido_em, e.coletado_em, e.pedido_em) < v_ate) x;

  -- ── notificações ──
  SELECT jsonb_build_object(
           'total', count(*),
           'dengue', count(*) FILTER (WHERE k = 'dengue'),
           'srag', count(*) FILTER (WHERE k = 'srag'),
           'covid', count(*) FILTER (WHERE k = 'covid'))
    INTO v_notif
    FROM (
      SELECT CASE
               WHEN a.lnnc_item = '10' OR upper(coalesce(a.cid, '')) ~ '^A9[017]' OR a.agravo ILIKE '%dengue%' THEN 'dengue'
               WHEN a.lnnc_item = '59' OR a.agravo ILIKE '%SRAG%' OR a.agravo ILIKE '%respirat_ria aguda grave%' THEN 'srag'
               WHEN a.lnnc_item IN ('57', '60') OR upper(coalesce(a.cid, '')) LIKE 'U07%' OR a.agravo ILIKE '%covid%' THEN 'covid'
             END AS k
        FROM public.agravos_notificacao a
       WHERE a.unidade_id = ANY (p_unidades) AND a.situacao <> 'descartado'
         AND a.suspeito_em >= v_de AND a.suspeito_em < v_ate) x;

  RETURN jsonb_build_object(
    'mes', p_ini,
    'porta', v_porta,
    'cids_porta', v_cids,
    'internacao', v_int,
    'saidas_internacao', v_saidas,
    'obitos', v_obitos || jsonb_build_object(
      'taxa_mortalidade', CASE WHEN v_saidas > 0 THEN round(100.0 * v_ob_int / v_saidas, 1) END),
    'encaminhamentos', v_enc,
    'producao', v_prod,
    'notificacoes', v_notif,
    'contrato', jsonb_build_object(
      'pct_no_alvo', v_porta -> 'no_alvo' -> 'pct',
      'retorno_72h', v_porta -> 'retorno_72h' -> 'pct',
      'permanencia_menor_24h', v_porta -> 'permanencia_24h' -> 'pct',
      'transferencias', v_transf,
      'taxa_transferencia', CASE WHEN v_atendidas > 0 THEN round(100.0 * v_transf / v_atendidas, 1) END));
END $$;
REVOKE ALL ON FUNCTION private.boletim_mes(uuid[], date) FROM PUBLIC, anon, authenticated;

-- O boletim de dois meses (p_mes_a e p_mes_b, qualquer dia do mês) de uma
-- unidade, ou de todas as unidades ativas da minha secretaria (p_unidade nulo).
-- A unidade: a secretaria dela ou o administrador da organização.
CREATE OR REPLACE FUNCTION public.secretaria_boletim(p_unidade uuid, p_mes_a date, p_mes_b date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_a date;
  v_b date;
  v_unidades uuid[];
BEGIN
  IF private.meu_perfil_id() IS NULL THEN
    RAISE EXCEPTION 'O boletim é de quem cuida da secretaria.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_mes_a IS NULL OR p_mes_b IS NULL
     OR extract(year FROM p_mes_a) NOT BETWEEN 2000 AND 2100 OR extract(year FROM p_mes_b) NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Mês inválido.';
  END IF;
  v_a := date_trunc('month', p_mes_a)::date;
  v_b := date_trunc('month', p_mes_b)::date;

  IF p_unidade IS NULL THEN
    SELECT array_agg(u.id ORDER BY u.nome) INTO v_unidades
      FROM public.unidades u
     WHERE u.ativo AND u.id IN (SELECT private.unidades_da_minha_secretaria());
    IF v_unidades IS NULL THEN
      RAISE EXCEPTION 'O boletim é de quem cuida da secretaria.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    IF NOT private.pode_definir_metas(p_unidade) THEN
      RAISE EXCEPTION 'O boletim é de quem cuida da secretaria.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_unidades := ARRAY[p_unidade];
  END IF;

  RETURN jsonb_build_object(
    'rede', p_unidade IS NULL,
    'unidades', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'tipo', u.tipo) ORDER BY u.nome)
                            FROM public.unidades u WHERE u.id = ANY (v_unidades)), '[]'::jsonb),
    -- tempo-alvo até o médico por cor (só com uma unidade: cada uma tem o seu)
    'alvos', CASE WHEN p_unidade IS NOT NULL THEN private.tempos_alvo_unidade(p_unidade) END,
    'estabilizacao_marcada', EXISTS (SELECT 1 FROM public.setores s
                                      WHERE s.unidade_id = ANY (v_unidades) AND s.ativo AND s.estabilizacao),
    'meses', jsonb_build_array(private.boletim_mes(v_unidades, v_a), private.boletim_mes(v_unidades, v_b)),
    -- as metas da unidade com vigência em algum dos dois meses
    'metas', CASE WHEN p_unidade IS NULL THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'indicador', m.indicador, 'meta', m.meta, 'sentido', m.sentido,
                                          'peso', m.peso, 'vigente_de', m.vigente_de, 'vigente_ate', m.vigente_ate)
                       ORDER BY m.indicador, m.vigente_de)
        FROM public.metas_contrato m
       WHERE m.unidade_id = p_unidade
         AND m.vigente_de < (greatest(v_a, v_b) + interval '1 month')::date
         AND (m.vigente_ate IS NULL OR m.vigente_ate >= least(v_a, v_b))), '[]'::jsonb) END);
END $$;
REVOKE ALL ON FUNCTION public.secretaria_boletim(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_boletim(uuid, date, date) TO authenticated;

-- ── 4. a linha de cada unidade na Rede da secretaria (SE1 e SE2) ──────────
CREATE OR REPLACE FUNCTION public.secretaria_estado_unidades()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date;
BEGIN
  IF private.meu_perfil_id() IS NULL OR NOT EXISTS (SELECT 1 FROM private.unidades_da_minha_secretaria()) THEN
    RAISE EXCEPTION 'O estado das unidades é de quem cuida da secretaria.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_fim := (date_trunc('month', v_hoje) + interval '1 month' - interval '1 day')::date;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', u.id,
      'leitos', lt.total,
      'ocupados', private.suprimir(lt.ocupados),
      'ocupacao', CASE WHEN lt.total > 0 AND private.suprimir(lt.ocupados) IS NOT NULL AND private.suprimir(lt.total) IS NOT NULL
                       THEN round(100.0 * lt.ocupados / lt.total, 1) END,
      'hoje', jsonb_build_object('plantoes', fx.faixas, 'cobertas', fx.cobertas, 'com_vaga', fx.com_vaga, 'vagas', fx.vagas),
      'vagas_ate_fim_do_mes', va.vagas,
      'regulacoes_vencidas', private.suprimir(rg.n),
      -- cada pessoa uma vez, não cada vínculo (como pessoas_total de secretaria_indicadores)
      'pessoas', pe.n) ORDER BY u.nome)
      FROM public.unidades u
      CROSS JOIN LATERAL (
        SELECT count(*) AS total, count(*) FILTER (WHERE l.status = 'ocupado') AS ocupados
          FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
         WHERE s.unidade_id = u.id AND s.ativo AND l.ativo) lt
      CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE jsonb_array_length(f.escalados) > 0 OR jsonb_array_length(f.abertas) > 0) AS faixas,
               count(*) FILTER (WHERE jsonb_array_length(f.escalados) > 0 AND jsonb_array_length(f.abertas) = 0) AS cobertas,
               count(*) FILTER (WHERE jsonb_array_length(f.abertas) > 0) AS com_vaga,
               coalesce(sum(jsonb_array_length(f.abertas)), 0) AS vagas
          FROM private.escala_faixas(u.id, v_hoje, v_hoje) f) fx
      CROSS JOIN LATERAL (
        SELECT coalesce(sum(jsonb_array_length(f.abertas)), 0) AS vagas
          FROM private.escala_faixas(u.id, v_hoje, v_fim) f) va
      CROSS JOIN LATERAL (
        -- vencida: na origem (resposta à central ou evolução), na fila da central ou sem resposta do destino
        SELECT count(*) AS n
          FROM public.regulacao_solicitacoes s
          CROSS JOIN LATERAL (SELECT private.regulacao_sla(s) AS sla) x
         WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino')
           AND ((s.unidade_origem_id = u.id
                 AND (coalesce((x.sla ->> 'atrasado_origem')::boolean, false) OR coalesce((x.sla ->> 'atrasado_central')::boolean, false)))
             OR (s.destino_unidade_id = u.id AND coalesce((x.sla ->> 'atrasado_destino')::boolean, false)))) rg
      CROSS JOIN LATERAL (
        SELECT count(DISTINCT v.perfil_id) AS n FROM public.vinculos v WHERE v.unidade_id = u.id AND v.ativo) pe
     WHERE u.ativo AND u.id IN (SELECT private.unidades_da_minha_secretaria())), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.secretaria_estado_unidades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_estado_unidades() TO authenticated;
