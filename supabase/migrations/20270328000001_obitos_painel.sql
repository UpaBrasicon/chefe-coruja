-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 10 do Portão de 11/10/2026: óbitos em Indicadores do gestor e no
-- painel do administrador.
-- Diagnóstico e decisão do RT (10/11/2026, A em P1 a P8):
--   docs/gestor/LACUNA-10-OBITOS-PAINEL-DIAGNOSTICO.md
--
-- Fonte (só de referência de nomenclatura; a UPA não é hospital):
--   Portaria SAS/MS nº 312/2002, "Padronização da Nomenclatura do Censo
--   Hospitalar": saídas (2.1.5) são alta, evasão, desistência, transferência
--   externa e óbito; a transferência interna não conta. O app não usa o nome
--   "taxa de mortalidade institucional" (3.7): o texto da portaria se
--   contradiz sobre as 24 horas. O número é "óbitos sobre saídas", com
--   numerador e denominador à vista.
--
-- O que faz:
--   P1/P2  public.indicador_obitos(unidade, de, até, setor): total; por
--          origem (porta, observação, internação); por setor do óbito; por
--          tipo de morte e encaminhamento; adulto ou pediátrico (pediatria até
--          13a 11m 29d, private.pediatrico_em, na data do óbito); menos de
--          24 h ou 24 h ou mais desde a chegada à unidade; óbitos sobre saídas
--          (porta, observação e internação), com numerador e denominador.
--          Gestor da unidade (ou super admin), com segundo fator.
--   P3     a lista com nome (até 300) para o gestor; a consulta fica na trilha
--          ('ver_obitos', no máximo uma a cada 15 min), só com a quantidade.
--   P4     período pela hora do óbito, no dia do plantão (7h às 7h), como o
--          resto do BI. Da barra valem o período e o setor do óbito.
--   P5     o gestor vê a própria unidade sem supressão; public.painel_organizacao
--          passa a contar todos os óbitos (porta, observação e internação, da
--          tabela obitos e os registros anteriores) pela hora do óbito, com a
--          mesma supressão de 1 a 4 e sem quebra ao lado do total.
--   P6     óbitos de antes da lacuna 5 (só em episodios.desfecho = 'obito' ou
--          internacoes.status = 'obito', sem registro vigente em obitos para o
--          episódio, a internação ou o paciente) entram uma vez, marcados como
--          "registro anterior" (sem tipo de morte nem encaminhamento).
--   P8     a exportação CSV é feita na tela, só com os números.
--
-- Contas (private.obitos_no_periodo e private.saidas_no_periodo):
--   - óbito novo: public.obitos com anulado_em nulo, pela hora_obito;
--   - registro anterior da porta: a hora_obito do desfecho_detalhes (ou o
--     encerramento do episódio); da observação ou internação: a hora_obito
--     do alta_detalhes (ou a data_alta);
--   - chegada à unidade: a chegada do episódio do óbito; na observação e na
--     internação, a do episódio da internação; sem episódio, a admissão;
--   - origem da observação ou internação anterior: internado_em nulo = só
--     esteve em observação (20261119000004);
--   - saídas da porta: episodios.desfecho em alta, alta após medicação, alta a
--     pedido, transferência, evasão ou óbito, pelo encerramento; 'observacao',
--     'internacao' e 'cancelado' não são saída (o paciente segue na
--     observação ou na internação e sai por lá). Saídas da observação e da
--     internação: internacoes.status em alta melhorada, alta a pedido,
--     evasão, transferência externa ou óbito, pela data_alta. Cada paciente
--     sai uma vez: sem dupla contagem entre porta e internação.
--   - com setor escolhido, numerador e denominador são do mesmo setor (setor
--     do episódio na porta; setor atual da internação).
--
-- Fora (decisão do RT): rede, API e Power BI; quem chega morto (P7).
--
-- painel_organizacao é trocada trecho a trecho pelo texto atual
-- (pg_get_functiondef), como em 20270326000001: trecho que sumiu para a
-- migration com erro; trecho já trocado é pulado (reaplicável); CRLF fica CRLF.
-- Só expande: funções novas e uma linha trocada numa função.
-- Teste: supabase/tests/obitos_painel.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 de
-- painel_organizacao volta ao de antes): o bloco comentado no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- hora gravada como texto nos jsonb antigos; texto inválido vira nulo
CREATE OR REPLACE FUNCTION private.obito_instante(p text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  RETURN nullif(btrim(coalesce(p, '')), '')::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.obito_instante(text) FROM PUBLIC, anon, authenticated;

-- ── os óbitos de uma unidade no período [p_desde, p_ate) ───────────────────
-- Uma linha por óbito: a tabela obitos (vigentes) e os registros anteriores
-- à lacuna 5 que não têm registro vigente (P6).
CREATE OR REPLACE FUNCTION private.obitos_no_periodo(p_unidade uuid, p_desde timestamptz, p_ate timestamptz, p_setor uuid DEFAULT NULL)
RETURNS TABLE (obito_id uuid, paciente_id uuid, episodio_id uuid, internacao_id uuid, origem text, setor_id uuid,
               hora_obito timestamptz, chegada_em timestamptz, tipo_morte text, encaminhamento text, registro_anterior boolean)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT x.* FROM (
    SELECT o.id, o.paciente_id, o.episodio_id, o.internacao_id, o.origem, o.setor_id, o.hora_obito,
           coalesce(e.chegada_em, i.data_admissao), o.tipo_morte, o.encaminhamento, false
      FROM public.obitos o
      LEFT JOIN public.internacoes i ON i.id = o.internacao_id
      LEFT JOIN public.episodios e ON e.id = coalesce(o.episodio_id, i.episodio_id)
     WHERE o.unidade_id = p_unidade AND o.anulado_em IS NULL
       AND o.hora_obito >= p_desde AND o.hora_obito < p_ate
    UNION ALL
    -- registro anterior da porta
    SELECT NULL::uuid, e.paciente_id, e.id, NULL::uuid, 'porta', e.setor_id,
           coalesce(private.obito_instante(e.desfecho_detalhes ->> 'hora_obito'), e.encerrado_em),
           e.chegada_em, NULL::text, NULL::text, true
      FROM public.episodios e
     WHERE e.unidade_id = p_unidade AND e.desfecho = 'obito'
       AND NOT EXISTS (SELECT 1 FROM public.obitos o
                        WHERE o.anulado_em IS NULL AND (o.episodio_id = e.id OR o.paciente_id = e.paciente_id))
    UNION ALL
    -- registro anterior da observação ou da internação
    SELECT NULL::uuid, i.paciente_id, i.episodio_id, i.id,
           CASE WHEN i.internado_em IS NULL THEN 'observacao' ELSE 'internacao' END, i.setor_atual_id,
           coalesce(private.obito_instante(i.alta_detalhes ->> 'hora_obito'), i.data_alta),
           coalesce(e.chegada_em, i.data_admissao), NULL::text, NULL::text, true
      FROM public.internacoes i
      LEFT JOIN public.episodios e ON e.id = i.episodio_id
     WHERE i.unidade_id = p_unidade AND i.status = 'obito'
       AND NOT EXISTS (SELECT 1 FROM public.obitos o
                        WHERE o.anulado_em IS NULL AND (o.internacao_id = i.id OR o.paciente_id = i.paciente_id))
  ) x (obito_id, paciente_id, episodio_id, internacao_id, origem, setor_id, hora_obito, chegada_em, tipo_morte, encaminhamento, registro_anterior)
  WHERE x.hora_obito >= p_desde AND x.hora_obito < p_ate
    AND (p_setor IS NULL OR x.setor_id = p_setor)
$$;
REVOKE ALL ON FUNCTION private.obitos_no_periodo(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

-- ── as saídas de uma unidade no período [p_desde, p_ate) ───────────────────
CREATE OR REPLACE FUNCTION private.saidas_no_periodo(p_unidade uuid, p_desde timestamptz, p_ate timestamptz, p_setor uuid DEFAULT NULL)
RETURNS TABLE (origem text, saidas bigint)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT 'porta'::text, count(*)
    FROM public.episodios e
   WHERE e.unidade_id = p_unidade
     AND e.desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito')
     AND e.encerrado_em >= p_desde AND e.encerrado_em < p_ate
     AND (p_setor IS NULL OR e.setor_id = p_setor)
  UNION ALL
  SELECT o.origem, count(i.id)
    FROM (VALUES ('observacao'), ('internacao')) o (origem)
    LEFT JOIN public.internacoes i
      ON i.unidade_id = p_unidade
     AND i.status IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito')
     AND i.data_alta >= p_desde AND i.data_alta < p_ate
     AND (p_setor IS NULL OR i.setor_atual_id = p_setor)
     AND o.origem = CASE WHEN i.internado_em IS NULL THEN 'observacao' ELSE 'internacao' END
   GROUP BY o.origem
$$;
REVOKE ALL ON FUNCTION private.saidas_no_periodo(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

-- ── P1 a P4: o cartão "Óbitos" do gestor ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.indicador_obitos(p_unidade uuid, p_de date, p_ate date, p_setor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_res   jsonb;
  v_ator  uuid := private.meu_perfil_id();
  v_desde timestamptz;
  v_ate   timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.gestor_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado: indicador do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  IF p_ate - p_de > 366 THEN RAISE EXCEPTION 'Período de no máximo um ano.'; END IF;
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = p_setor AND s.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Setor de outra unidade.';
  END IF;
  -- P4: o dia do plantão, das 7h de p_de às 7h do dia seguinte a p_ate (como private.episodios_filtrados)
  v_desde := (p_de + time '07:00') AT TIME ZONE 'America/Sao_Paulo';
  v_ate := ((p_ate + 1) + time '07:00') AT TIME ZONE 'America/Sao_Paulo';

  WITH ob AS (
    SELECT x.*, pa.nome AS paciente_nome, s.nome AS setor_nome,
           private.dia_do_plantao(x.hora_obito) AS dia,
           CASE WHEN pa.data_nascimento IS NULL THEN 'sem_data_nascimento'
                WHEN private.pediatrico_em(pa.data_nascimento, (x.hora_obito AT TIME ZONE 'America/Sao_Paulo')::date) THEN 'pediatrico'
                ELSE 'adulto' END AS faixa,
           CASE WHEN x.chegada_em IS NULL THEN 'sem_chegada'
                WHEN x.hora_obito - x.chegada_em < interval '24 hours' THEN 'menos_de_24h'
                ELSE 'de_24h_ou_mais' END AS tempo
      FROM private.obitos_no_periodo(p_unidade, v_desde, v_ate, p_setor) x
      JOIN public.pacientes pa ON pa.id = x.paciente_id
      LEFT JOIN public.setores s ON s.id = x.setor_id
  ), sa AS (
    SELECT * FROM private.saidas_no_periodo(p_unidade, v_desde, v_ate, p_setor)
  ), t AS (
    SELECT (SELECT count(*) FROM ob) AS obitos, (SELECT coalesce(sum(sa.saidas), 0) FROM sa)::bigint AS saidas
  )
  SELECT jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'setor_id', p_setor,
    'total', t.obitos,
    'registro_anterior', (SELECT count(*) FROM ob WHERE ob.registro_anterior),
    'por_origem', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ob WHERE ob.origem = m))
                     FROM unnest(ARRAY['porta', 'observacao', 'internacao']) m),
    'por_tipo', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ob WHERE coalesce(ob.tipo_morte, 'registro_anterior') = m))
                   FROM unnest(ARRAY['natural_assistida', 'natural_sem_assistencia_ou_a_esclarecer', 'violenta_ou_suspeita', 'registro_anterior']) m),
    'por_encaminhamento', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ob WHERE coalesce(ob.encaminhamento, 'registro_anterior') = m))
                             FROM unnest(ARRAY['unidade', 'svo', 'causa_desconhecida', 'iml', 'registro_anterior']) m),
    'por_faixa', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ob WHERE ob.faixa = m))
                    FROM unnest(ARRAY['adulto', 'pediatrico', 'sem_data_nascimento']) m),
    'por_tempo', (SELECT jsonb_object_agg(m, (SELECT count(*) FROM ob WHERE ob.tempo = m))
                    FROM unnest(ARRAY['menos_de_24h', 'de_24h_ou_mais', 'sem_chegada']) m),
    'por_setor', coalesce((
      SELECT jsonb_agg(jsonb_build_object('setor_id', g.setor_id, 'setor', coalesce(g.setor_nome, 'Sem setor'), 'obitos', g.n)
                       ORDER BY g.n DESC, g.setor_nome)
        FROM (SELECT ob.setor_id, ob.setor_nome, count(*) AS n FROM ob GROUP BY ob.setor_id, ob.setor_nome) g), '[]'::jsonb),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', g.dia, 'obitos', g.n) ORDER BY g.dia)
        FROM (SELECT ob.dia, count(*) AS n FROM ob GROUP BY ob.dia) g), '[]'::jsonb),
    'saidas', (SELECT jsonb_object_agg(sa.origem, sa.saidas) FROM sa) || jsonb_build_object('total', t.saidas),
    'obitos_sobre_saidas', jsonb_build_object(
      'numerador', t.obitos, 'denominador', t.saidas,
      'percentual', CASE WHEN t.saidas > 0 THEN round(100.0 * t.obitos / t.saidas, 1) END),
    'setores', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) ORDER BY s.ordem, s.nome)
        FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo), '[]'::jsonb),
    -- P3: a lista com nome, só para o gestor da unidade
    'casos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'nome', c.paciente_nome, 'hora_obito', c.hora_obito, 'chegada_em', c.chegada_em, 'origem', c.origem,
               'setor', c.setor_nome, 'tipo_morte', c.tipo_morte, 'encaminhamento', c.encaminhamento,
               'registro_anterior', c.registro_anterior, 'faixa', c.faixa, 'tempo', c.tempo) ORDER BY c.hora_obito DESC)
        FROM (SELECT * FROM ob ORDER BY ob.hora_obito DESC LIMIT 300) c), '[]'::jsonb))
    INTO v_res
    FROM t;

  -- nome de paciente na tela do gestor: fica na trilha (1 registro a cada 15 min), só com a quantidade
  IF jsonb_array_length(v_res -> 'casos') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.unidade_id = p_unidade AND a.acao = 'ver_obitos'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_obitos', 'obitos', NULL, p_unidade,
      jsonb_build_object('quantidade', jsonb_array_length(v_res -> 'casos')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.indicador_obitos(uuid, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicador_obitos(uuid, date, date, uuid) TO authenticated;

-- ── P5: o painel do administrador conta todos os óbitos ────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro.
-- Corpo gravado com quebra de linha CRLF continua CRLF (o rollback volta ao mesmo md5).
CREATE OR REPLACE FUNCTION pg_temp.trocar_obitos_painel(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
    v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
    IF position(v_novo IN def) > 0 THEN CONTINUE; END IF;
    IF position(v_ant IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, v_ant;
    END IF;
    IF (length(def) - length(replace(def, v_ant, ''))) / length(v_ant) <> 1 THEN
      RAISE EXCEPTION '%: trecho aparece mais de uma vez: %', f, v_ant;
    END IF;
    def := replace(def, v_ant, v_novo);
    mudou := true;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;

SELECT pg_temp.trocar_obitos_painel('public.painel_organizacao(integer)'::regprocedure, ARRAY[
  $a$(SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.encerrado_em > now() - make_interval(days => v_dias) AND e.desfecho = 'obito') AS obitos,$a$,
  $b$(SELECT count(*) FROM private.obitos_no_periodo(u.id, now() - make_interval(days => v_dias), 'infinity'::timestamptz)) AS obitos,  -- lacuna 10 (P5): porta, observação e internação, pela hora do óbito$b$]);

DROP FUNCTION pg_temp.trocar_obitos_painel(regprocedure, text[]);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_obitos_painel(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
--   v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
--     v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
--     IF position(v_novo IN def) > 0 THEN
--       def := replace(def, v_novo, v_ant);
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN EXECUTE def; END IF;
-- END $$;
-- -- a chamada pg_temp.trocar_obitos_painel acima, igual, com o nome
-- -- pg_temp.desfazer_obitos_painel (o mesmo par: ele troca o novo pelo antigo)
-- DROP FUNCTION IF EXISTS public.indicador_obitos(uuid, date, date, uuid),
--   private.saidas_no_periodo(uuid, timestamptz, timestamptz, uuid),
--   private.obitos_no_periodo(uuid, timestamptz, timestamptz, uuid),
--   private.obito_instante(text);
-- ════════════════════════════════════════════════════════════════════════════
