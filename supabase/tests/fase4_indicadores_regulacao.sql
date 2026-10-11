-- Fase 4, tarefa 10 — migration 20261118000001_indicadores_regulacao.sql.
-- Cobre: tempos (mediana e p90) até a decisão, o aceite e a chegada; fila
-- atual; desfechos e motivos; cumprimento dos prazos (fila, pendência,
-- evolução, destino); gargalos; escopo de quem vê (central = rede, gestor =
-- unidade como origem e destino; médico não vê); filtros e período.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009f5', 'Rede dos Indicadores');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009f5', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009f5'::uuid, 'UPA A', '7654598'),
               ('21000000-0000-4000-8000-0000000009f6'::uuid, 'Hospital B', '7654601'),
               ('21000000-0000-4000-8000-0000000009f7'::uuid, 'Central Indicadores', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f7', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f5', 'Porta', tipo FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009f5', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009f5', 'plantonista'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-0000000009f6', 'gestor'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009f7', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
SELECT ('23000000-0000-4000-8000-0000000009f' || n)::uuid, '21000000-0000-4000-8000-0000000009f5', 'Paciente Indicador ' || n,
       '1970-01-01', 'I-' || n, '22000000-0000-4000-8000-0000000009f5', 'M'
  FROM generate_series(1, 5) n;
INSERT INTO public.regulacao_prazos (central_id, fila_urgencia_min, fila_eletiva_min, atualizado_por)
VALUES ('21000000-0000-4000-8000-0000000009f7', 180, 120, '10000000-0000-4000-8000-000000000006');

-- pedidos gravados no estado final, com o tempo em cada status escrito à mão
SET LOCAL session_replication_role = replica;
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, especialidade, cbo, destino_tipo, destino_unidade_id, carater, modalidade, prioridade, cid, quadro_clinico,
  solicitante_id, solicitante_papel, status, criada_em, autorizada_em, negada_em, motivo_negacao, devolvida_em, cancelada_em, cancelamento_origem,
  motivo_cancelamento, destino_enviado_em, destino_resposta, destino_respondido_em, realizada_em)
VALUES
  -- 1: leito urgência; 2 h com a central; aceite em 1 h; chegou
  ('2a000000-0000-4000-8000-0000000009f1', '20000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f7', '21000000-0000-4000-8000-0000000009f5',
   '7654598', '23000000-0000-4000-8000-0000000009f1', true, 'leito', '0303060190', 'uti_adulto', NULL, NULL, 'rede', '21000000-0000-4000-8000-0000000009f6',
   'urgencia', '04', 'urgencia', 'I21.9', 'Quadro clínico do pedido de teste dos indicadores.', '10000000-0000-4000-8000-000000000002', 'medico',
   'realizada', now() - interval '10 hours', now() - interval '8 hours', NULL, NULL, NULL, NULL, NULL, NULL,
   now() - interval '8 hours', 'aceita', now() - interval '7 hours', now() - interval '5 hours'),
  -- 2: exame eletivo; 4 h com a central; negado sem oferta
  ('2a000000-0000-4000-8000-0000000009f2', '20000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f7', '21000000-0000-4000-8000-0000000009f5',
   '7654598', '23000000-0000-4000-8000-0000000009f2', true, 'exame', '0303060190', NULL, NULL, NULL, 'a_definir', NULL,
   'eletivo', '07', 'eletiva', 'I21.9', 'Quadro clínico do pedido de teste dos indicadores.', '10000000-0000-4000-8000-000000000002', 'medico',
   'negada', now() - interval '6 hours', NULL, now() - interval '2 hours', 'sem_oferta', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  -- 3: leito emergência; devolvido (5 h com a origem); recusado pelo destino; em análise; 20 h sem evolução
  ('2a000000-0000-4000-8000-0000000009f3', '20000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f7', '21000000-0000-4000-8000-0000000009f5',
   '7654598', '23000000-0000-4000-8000-0000000009f3', true, 'leito', '0303060190', 'uti_adulto', NULL, NULL, 'a_definir', NULL,
   'urgencia', '04', 'emergencia', 'I21.9', 'Quadro clínico do pedido de teste dos indicadores.', '10000000-0000-4000-8000-000000000002', 'medico',
   'em_analise', now() - interval '20 hours', NULL, NULL, NULL, now() - interval '18 hours', NULL, NULL, NULL,
   now() - interval '6 hours', 'recusada', now() - interval '5 hours', NULL),
  -- 4: consulta cancelada
  ('2a000000-0000-4000-8000-0000000009f4', '20000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f7', '21000000-0000-4000-8000-0000000009f5',
   '7654598', '23000000-0000-4000-8000-0000000009f4', true, 'consulta', '0303060190', NULL, 'Cardiologia', '225120', 'a_definir', NULL,
   'eletivo', '07', 'eletiva', 'I21.9', 'Quadro clínico do pedido de teste dos indicadores.', '10000000-0000-4000-8000-000000000002', 'medico',
   'cancelada', now() - interval '3 hours', NULL, NULL, NULL, NULL, now() - interval '1 hour', 'solicitante', 'Paciente melhorou e teve alta.',
   NULL, NULL, NULL, NULL),
  -- 5: pedido do Hospital B, sem relação com a UPA A
  ('2a000000-0000-4000-8000-0000000009f5', '20000000-0000-4000-8000-0000000009f5', '21000000-0000-4000-8000-0000000009f7', '21000000-0000-4000-8000-0000000009f6',
   '7654601', '23000000-0000-4000-8000-0000000009f5', true, 'exame', '0303060190', NULL, NULL, NULL, 'a_definir', NULL,
   'eletivo', '07', 'eletiva', 'I21.9', 'Quadro clínico do pedido de teste dos indicadores.', '10000000-0000-4000-8000-000000000003', 'gestor',
   'enviada', now() - interval '1 hour', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.regulacao_status_tempos (solicitacao_id, status, inicio, fim) VALUES
  ('2a000000-0000-4000-8000-0000000009f1', 'enviada', now() - interval '10 hours', now() - interval '8 hours'),
  ('2a000000-0000-4000-8000-0000000009f1', 'aguardando_destino', now() - interval '8 hours', now() - interval '7 hours'),
  ('2a000000-0000-4000-8000-0000000009f1', 'realizada', now() - interval '5 hours', NULL),
  ('2a000000-0000-4000-8000-0000000009f2', 'enviada', now() - interval '6 hours', now() - interval '2 hours'),
  ('2a000000-0000-4000-8000-0000000009f2', 'negada', now() - interval '2 hours', now() - interval '2 hours'),
  ('2a000000-0000-4000-8000-0000000009f3', 'enviada', now() - interval '20 hours', now() - interval '18 hours'),
  ('2a000000-0000-4000-8000-0000000009f3', 'devolvida', now() - interval '18 hours', now() - interval '13 hours'),
  ('2a000000-0000-4000-8000-0000000009f3', 'em_analise', now() - interval '13 hours', NULL),
  ('2a000000-0000-4000-8000-0000000009f5', 'enviada', now() - interval '1 hour', NULL);
INSERT INTO public.regulacao_destino_respostas (solicitacao_id, destino_tipo, destino_unidade_id, resposta, motivo, texto, por, em) VALUES
  ('2a000000-0000-4000-8000-0000000009f1', 'rede', '21000000-0000-4000-8000-0000000009f6', 'aceita', NULL, NULL, '10000000-0000-4000-8000-000000000003', now() - interval '7 hours'),
  ('2a000000-0000-4000-8000-0000000009f3', 'rede', '21000000-0000-4000-8000-0000000009f6', 'recusada', 'sem_vaga', 'Sem leito de UTI no momento.', '10000000-0000-4000-8000-000000000003', now() - interval '5 hours');
SET LOCAL session_replication_role = origin;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

SET LOCAL ROLE authenticated;
-- ── 1. central: a rede inteira ──────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'c', public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f7')::text;
SELECT pg_temp.ok((pg_temp.v('c')->>'total')::int = 5 AND pg_temp.v('c')->>'escopo' = 'rede', 'central vê os 5 pedidos da rede');
SELECT pg_temp.ok(pg_temp.v('c')->'tempos'->'decisao'->'geral' = '{"n": 2, "mediana": 10800, "p90": 13680}'::jsonb,
  'decisão: só o tempo com a central; mediana 3 h e p90 3 h 48 min (2 h e 4 h)');
SELECT pg_temp.ok((pg_temp.v('c')->'tempos'->'aceite'->'geral'->>'mediana')::int = 3600
              AND (pg_temp.v('c')->'tempos'->'chegada'->'geral'->>'mediana')::int = 18000,
  'aceite do destino em 1 h; chegada 5 h depois do pedido');
SELECT pg_temp.ok((SELECT (x->>'mediana')::int FROM jsonb_array_elements(pg_temp.v('c')->'tempos'->'decisao'->'por_prioridade') x WHERE x->>'grupo' = 'eletiva') = 14400,
  'decisão por prioridade');
SELECT pg_temp.ok(pg_temp.v('c')->'desfechos' @> '{"negadas": 1, "devolvidas": 1, "canceladas": 1, "realizadas": 1, "respostas_destino": 2, "recusas_destino": 1}'::jsonb
              AND pg_temp.v('c')->'desfechos'->'negacao_por_motivo' = '{"sem_oferta": 1}'::jsonb
              AND pg_temp.v('c')->'desfechos'->'recusa_por_motivo' = '{"sem_vaga": 1}'::jsonb,
  'desfechos e motivos');
SELECT pg_temp.ok(pg_temp.v('c')->'prazos'->'fila' = '{"n": 2, "no_prazo": 1}'::jsonb
              AND pg_temp.v('c')->'prazos'->'pendencia' = '{"n": 1, "no_prazo": 0}'::jsonb
              AND pg_temp.v('c')->'prazos'->'evolucao' = '{"n": 2, "no_prazo": 1}'::jsonb
              AND pg_temp.v('c')->'prazos'->'destino' = '{"n": 2, "no_prazo": 2}'::jsonb,
  'cumprimento dos prazos: fila, pendência, evolução e destino');
SELECT pg_temp.ok(pg_temp.v('c')->'fila_atual'->'por_tipo' = '{"leito": 1, "exame": 1}'::jsonb, 'fila atual por tipo');
SELECT pg_temp.ok((SELECT (x->>'recusas')::int FROM jsonb_array_elements(pg_temp.v('c')->'gargalos'->'por_destino') x WHERE x->>'unidade' = 'Hospital B') = 1
              AND (SELECT (x->>'n')::int FROM jsonb_array_elements(pg_temp.v('c')->'gargalos'->'por_tipo_leito') x WHERE x->>'tipo_leito' = 'uti_adulto') = 2,
  'gargalos por destino e tipo de leito');
SELECT pg_temp.ok(pg_temp.v('c')::text NOT LIKE '%Paciente%', 'só números, sem nome de paciente');

-- ── 2. filtros e período ────────────────────────────────────────────────────
SELECT pg_temp.ok((public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f7', '{"tipo":"exame"}')->>'total')::int = 2, 'filtro por tipo');
SELECT pg_temp.falha($$SELECT public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f7', '{"de":"2026-10-10","ate":"2026-10-01"}')$$,
  'O fim do período vem depois do início', 'período invertido');
SELECT pg_temp.falha($$SELECT public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f7', '{"de":"2025-01-01","ate":"2026-10-01"}')$$,
  'Período de até 366 dias', 'período longo demais');

-- ── 3. gestor: a unidade como origem e como destino ─────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f5')->>'total')::int = 4, 'gestor da UPA A: os 4 pedidos dela');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok((public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f6')->>'total')::int = 2,
  'gestor do Hospital B: o pedido dele e o que recebeu como destino');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_indicadores('21000000-0000-4000-8000-0000000009f5')$$, 'Acesso negado', 'médico não vê os indicadores');

ROLLBACK;
