-- Fase 4, tarefa 7 — migration 20261113000001_sla_regulacao.sql: painel de
-- SLA da regulação. Cobre:
-- - tempo em cada status, guardado a cada troca;
-- - prazos da central: valores de partida (12 h, 3 h, 72 h; fila sem prazo),
--   ajuste pelo regulador ou gestor da central, validação e auditoria;
-- - prazo da fila por prioridade, contando só o tempo com a central;
-- - pendência em 3 h; evolução em 12 h e 72 h só em leito e transferência;
-- - "Atualizar evolução" pela origem, que recomeça o relógio;
-- - painel da central e da origem, filtros;
-- - avisos do job, uma vez por dia e por relógio.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009e0', 'Rede dos Prazos');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009e0', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009e1'::uuid, 'UPA Prazos', '7654474'),
               ('21000000-0000-4000-8000-0000000009e3'::uuid, 'Central Prazos', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-0000000009e1', '21000000-0000-4000-8000-0000000009e1', 'Porta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009e0', '21000000-0000-4000-8000-0000000009e3', '10000000-0000-4000-8000-000000000003');
-- 002 médico solicitante; 004 enfermeiro; 001 gestor da UPA; 006 e 003 reguladores
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009e1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009e1', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009e1', 'gestor'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009e3', 'regulador'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-0000000009e3', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
SELECT ('23000000-0000-4000-8000-0000000009e' || n)::uuid, '21000000-0000-4000-8000-0000000009e1', 'Paciente Prazo ' || n,
       '1970-01-01', 'P-' || n, '22000000-0000-4000-8000-0000000009e1', 'M'
  FROM generate_series(1, 3) n;
-- 1: leito, urgência; 2: exame, eletiva; 3: transferência, emergência
INSERT INTO public.regulacao_solicitacoes (organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, transporte, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel)
SELECT '20000000-0000-4000-8000-0000000009e0', '21000000-0000-4000-8000-0000000009e3', '21000000-0000-4000-8000-0000000009e1', '7654474',
       ('23000000-0000-4000-8000-0000000009e' || n)::uuid, true,
       x.tipo, '0303060190', x.leito, x.transporte, 'a_definir', 'urgencia', '04', x.prioridade, 'I21.9',
       'Quadro clínico do pedido de teste dos prazos.', '10000000-0000-4000-8000-000000000002', 'medico'
  FROM (VALUES (1, 'leito', 'uti_adulto', NULL, 'urgencia'), (2, 'exame', NULL, NULL, 'eletiva'),
               (3, 'transferencia', NULL, 'ambulancia_avancada', 'emergencia')) x(n, tipo, leito, transporte, prioridade);

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
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
CREATE FUNCTION pg_temp.id(n int) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.regulacao_solicitacoes WHERE paciente_id = ('23000000-0000-4000-8000-0000000009e' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(int) TO authenticated;
CREATE FUNCTION pg_temp.numero(n int) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT numero FROM public.regulacao_solicitacoes WHERE id = pg_temp.id(n) $$;
GRANT EXECUTE ON FUNCTION pg_temp.numero(int) TO authenticated;
CREATE FUNCTION pg_temp.sla(n int) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT private.regulacao_sla(s) FROM public.regulacao_solicitacoes s WHERE s.id = pg_temp.id(n) $$;
GRANT EXECUTE ON FUNCTION pg_temp.sla(int) TO authenticated;
-- empurra para o passado o status aberto e a criação do pedido
CREATE FUNCTION pg_temp.recuar(n int, horas numeric) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.regulacao_status_tempos SET inicio = inicio - make_interval(secs => horas * 3600)
   WHERE solicitacao_id = pg_temp.id(n) AND fim IS NULL;
  UPDATE public.regulacao_solicitacoes SET criada_em = criada_em - make_interval(secs => horas * 3600) WHERE id = pg_temp.id(n);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.recuar(int, numeric) TO authenticated;
CREATE FUNCTION pg_temp.avisos(perfil text, prefixo text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.notificacoes_plantonista WHERE perfil_id = perfil::uuid AND tipo LIKE prefixo || '%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.avisos(text, text) TO authenticated;

-- ── 1. tempo em cada status e valores de partida ────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM public.regulacao_status_tempos WHERE solicitacao_id = pg_temp.id(1) AND status = 'enviada' AND fim IS NULL) = 1,
  'pedido novo começa a contar em "enviada"');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((public.regulacao_prazos('21000000-0000-4000-8000-0000000009e1')->>'evolucao_h')::int = 12
              AND (public.regulacao_prazos('21000000-0000-4000-8000-0000000009e1')->>'pendencia_h')::int = 3
              AND (public.regulacao_prazos('21000000-0000-4000-8000-0000000009e1')->>'sem_evolucao_h')::int = 72
              AND public.regulacao_prazos('21000000-0000-4000-8000-0000000009e1')->'fila'->'urgencia' = 'null'::jsonb,
  'valores de partida: 12 h, 3 h, 72 h; fila sem prazo');
SELECT pg_temp.ok(pg_temp.sla(1)->'fila'->'prazo_min' = 'null'::jsonb AND NOT (pg_temp.sla(1)->>'atrasado_central')::boolean,
  'sem prazo da fila, nada fica atrasado na central');
SELECT pg_temp.ok(pg_temp.sla(1)->'evolucao' IS NOT NULL AND pg_temp.sla(3)->'evolucao' IS NOT NULL
              AND pg_temp.sla(2)->'evolucao' = 'null'::jsonb,
  'relógio da evolução só em leito e transferência');

-- ── 2. ajuste dos prazos ────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009e3', '{"fila":{"urgencia":60}}')$$,
  'Os prazos são ajustados pelo regulador ou pelo gestor da central', 'médico da origem não ajusta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009e3', '{"evolucao_h":12,"sem_evolucao_h":12}')$$,
  'Sem evolução: até 720 horas e maior que o prazo da evolução', '72 h precisa ser maior que 12 h');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009e3', '{"fila":{"urgencia":0}}')$$,
  'Prazo da fila: de 1 minuto a 30 dias', 'prazo da fila zero recusado');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009e1', '{}')$$,
  'Esta unidade não é uma central de regulação', 'prazos só na central');
SELECT pg_temp.ok((public.regulacao_definir_prazos('21000000-0000-4000-8000-0000000009e3',
    '{"fila":{"emergencia":30,"urgencia":60,"prioritaria":null,"eletiva":null},"evolucao_h":12,"pendencia_h":3,"sem_evolucao_h":72}')->'fila'->>'urgencia')::int = 60,
  'regulador ajusta o prazo da fila');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.regulacao_prazos_historico h
                           JOIN public.log_auditoria a ON a.entidade_id = h.id AND a.acao = 'regulacao_prazos_ajustados'
                          WHERE h.central_id = '21000000-0000-4000-8000-0000000009e3'
                            AND h.antes->'fila'->'urgencia' = 'null'::jsonb AND (h.depois->'fila'->>'urgencia')::int = 60),
  'ajuste dos prazos fica na auditoria, com o antes e o depois');

-- ── 3. prazo da fila conta só o tempo com a central ─────────────────────────
SELECT pg_temp.recuar(1, 2);
SELECT pg_temp.ok((pg_temp.sla(1)->>'atrasado_central')::boolean AND (pg_temp.sla(1)->'fila'->>'central_seg')::int >= 7200,
  'urgência há 2 h com prazo de 60 min: atrasada na central');
SELECT pg_temp.ok(NOT (pg_temp.sla(2)->>'atrasado_central')::boolean, 'eletiva sem prazo não atrasa');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_pendencia(pg_temp.id(1), 'Qual a troponina mais recente?');
SELECT pg_temp.ok(NOT (pg_temp.sla(1)->'fila'->>'correndo')::boolean AND NOT (pg_temp.sla(1)->>'atrasado_central')::boolean
              AND NOT (pg_temp.sla(1)->'pendencia'->>'atrasada')::boolean,
  'em pendência o prazo da fila pausa e corre o de 3 h da origem');
RESET ROLE;
SELECT pg_temp.recuar(1, 4);
SELECT pg_temp.ok((pg_temp.sla(1)->'pendencia'->>'atrasada')::boolean AND (pg_temp.sla(1)->>'atrasado_origem')::boolean,
  'pendência sem resposta há 4 h: atrasada na origem');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.regulacao_responder_pendencia(pg_temp.id(1), 'Troponina 2,3 às 10h.');
SELECT pg_temp.ok((pg_temp.sla(1)->'fila'->>'central_seg')::int BETWEEN 7200 AND 7300 AND (pg_temp.sla(1)->'fila'->>'correndo')::boolean,
  'respondida, volta à central somando só o tempo que ficou com ela');

-- ── 4. evolução ─────────────────────────────────────────────────────────────
RESET ROLE;
UPDATE public.regulacao_solicitacoes SET criada_em = now() - interval '13 hours' WHERE id = pg_temp.id(3);
SELECT pg_temp.ok((pg_temp.sla(3)->'evolucao'->>'atrasada')::boolean AND NOT (pg_temp.sla(3)->'evolucao'->>'risco_cancelamento')::boolean,
  'transferência há 13 h sem evolução: atrasada');
UPDATE public.regulacao_solicitacoes SET criada_em = now() - interval '73 hours' WHERE id = pg_temp.id(3);
SELECT pg_temp.ok((pg_temp.sla(3)->'evolucao'->>'risco_cancelamento')::boolean, '73 h sem evolução: risco de cancelamento');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.regulacao_atualizar_evolucao(%L, %L)', pg_temp.id(3), 'Paciente estável, sem droga vasoativa.'),
  'Atualizam a evolução o solicitante', 'enfermagem não atualiza a evolução do pedido');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_atualizar_evolucao(%L, %L)', pg_temp.id(3), 'curto'),
  'Escreva a evolução', 'evolução pede texto');
SELECT pg_temp.ok(public.regulacao_atualizar_evolucao(pg_temp.id(3), 'Paciente estável, sem droga vasoativa.', 'PA 120x80, FC 88') IS NOT NULL
              AND NOT (pg_temp.sla(3)->'evolucao'->>'atrasada')::boolean,
  'médico atualiza a evolução e o relógio recomeça');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_detalhe(pg_temp.id(3))->'evolucoes') = 1
              AND (public.regulacao_detalhe(pg_temp.id(3))->>'pode_evoluir')::boolean
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.id(3))->'eventos') e WHERE e->>'evento' = 'evolucao_atualizada'),
  'evolução no detalhe e no histórico');
SELECT pg_temp.ok((SELECT (e->>'segundos')::int FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.id(1))->'tempos') e WHERE e->>'status' = 'enviada') = 7200
              AND (SELECT (e->>'segundos')::int FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.id(1))->'tempos') e WHERE e->>'status' = 'pendencia') = 14400
              AND (SELECT (e->>'atual')::boolean FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.id(1))->'tempos') e WHERE e->>'status' = 'em_analise'),
  'detalhe com o tempo em cada status');

-- ── 5. painel ───────────────────────────────────────────────────────────────
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e1')->'dados') = 3
              AND NOT (public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e1')->>'central')::boolean,
  'médico da origem vê os pedidos da unidade');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e1', '{"tipo":"exame"}')->'dados') = 1,
  'filtro por tipo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e1')$$, 'Acesso negado', 'enfermagem não vê o painel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e3')->'resumo'->>'fila_atrasada')::int = 1
              AND (public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e3')->'dados'->0->>'numero')::bigint
                  = pg_temp.numero(1),
  'central: resumo e o atrasado no topo');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e3', '{"so_atrasados":true}')->'dados') = 1
              AND jsonb_array_length(public.regulacao_sla_painel('21000000-0000-4000-8000-0000000009e3', '{"prioridade":"eletiva"}')->'dados') = 1,
  'filtros: só atrasados e prioridade');

-- ── 6. avisos do job ────────────────────────────────────────────────────────
RESET ROLE;
-- o exame (2) fica parado em pendência há 4 h; o leito (1) segue atrasado na fila
UPDATE public.regulacao_solicitacoes SET status = 'pendencia', pendencia_em = now(), pendencia_por = '10000000-0000-4000-8000-000000000006',
       pendencia_pergunta = 'Pergunta do teste.' WHERE id = pg_temp.id(2);
SELECT pg_temp.recuar(2, 4);
-- a transferência (3), emergência sem ninguém com ela, passa do prazo de 30 min
UPDATE public.regulacao_status_tempos SET inicio = now() - interval '1 hour' WHERE solicitacao_id = pg_temp.id(3) AND fim IS NULL;
SELECT private.regulacao_sla_avisar();
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_prazo_pendencia_') = 1,
  'solicitante avisado da pendência vencida');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'reg_prazo_fila_' || pg_temp.numero(1)) = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000003', 'reg_prazo_fila_' || pg_temp.numero(1)) = 0,
  'prazo da fila: avisa o regulador que está com o pedido');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'reg_prazo_fila_' || pg_temp.numero(3)) = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000003', 'reg_prazo_fila_' || pg_temp.numero(3)) = 1,
  'prazo da fila: sem ninguém com o pedido, avisa os reguladores da central');
UPDATE public.notificacoes_plantonista SET lida_em = now() WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND tipo LIKE 'reg_prazo_%';
SELECT pg_temp.ok(private.regulacao_sla_avisar() = 0
              AND NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002'
                               AND tipo LIKE 'reg_prazo_%' AND lida_em IS NULL),
  'o job não repete o aviso no mesmo dia nem volta a marcar como não lido');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'regulacao-sla-avisos'), 'job agendado');

ROLLBACK;
