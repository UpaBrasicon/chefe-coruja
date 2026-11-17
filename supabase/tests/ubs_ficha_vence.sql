-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000001_ubs_ficha_vence.sql (percurso da UBS, U1).
-- Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. ficha da UBS de ontem, sem atendimento (na escuta e no consultório): vence
--    como evasão, com relato, data, marca "vencida" e auditoria;
-- 2. ficha de hoje, ficha já em atendimento e ficha da UPA: não mudam;
-- 3. consulta marcada cuja ficha venceu: a agenda marca "não aguardou";
-- 4. rodar de novo não vence nada; o job está agendado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000071a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000071a2'),
  ('cons', '00000000-0000-4000-8000-0000000071a3'),
  ('upa',  '00000000-0000-4000-8000-0000000071a4'),
  ('porta','00000000-0000-4000-8000-0000000071a5'),
  ('rec',  '00000000-0000-4000-8000-0000000071a6'),
  ('med',  '00000000-0000-4000-8000-0000000071a7'),
  ('pac',  '00000000-0000-4000-8000-0000000071a8'),
  ('pac2', '00000000-0000-4000-8000-0000000071d2'),
  ('pac3', '00000000-0000-4000-8000-0000000071d3'),
  ('pac4', '00000000-0000-4000-8000-0000000071d4'),
  ('pac5', '00000000-0000-4000-8000-0000000071d5'),
  ('pupa', '00000000-0000-4000-8000-0000000071a9'),
  ('ag',   '00000000-0000-4000-8000-0000000071b0'),
  ('e_escuta', '00000000-0000-4000-8000-0000000071c1'),
  ('e_cons',   '00000000-0000-4000-8000-0000000071c2'),
  ('e_hoje',   '00000000-0000-4000-8000-0000000071c3'),
  ('e_atend',  '00000000-0000-4000-8000-0000000071c4'),
  ('e_upa',    '00000000-0000-4000-8000-0000000071c5'),
  ('e_agenda', '00000000-0000-4000-8000-0000000071c6');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u1.local' FROM ids WHERE nome IN ('rec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U1');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U1', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U1', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Porta', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento) VALUES
  (pg_temp.id('pac'), pg_temp.id('ubs'), 'Paciente do U1', date '1970-01-01'),
  (pg_temp.id('pac2'), pg_temp.id('ubs'), 'Paciente 2 do U1', date '1970-01-01'),
  (pg_temp.id('pac3'), pg_temp.id('ubs'), 'Paciente 3 do U1', date '1970-01-01'),
  (pg_temp.id('pac4'), pg_temp.id('ubs'), 'Paciente 4 do U1', date '1970-01-01'),
  (pg_temp.id('pac5'), pg_temp.id('ubs'), 'Paciente 5 do U1', date '1970-01-01'),
  (pg_temp.id('pupa'), pg_temp.id('upa'), 'Paciente da UPA do U1', date '1970-01-01');

-- ontem: na escuta (triagem) e no consultório (atendimento), sem atendimento
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, tipo_atendimento_aps) VALUES
  (pg_temp.id('e_escuta'), pg_temp.id('ubs'), pg_temp.id('pac'), pg_temp.id('cons'), 'triagem', 'Tosse', pg_temp.id('rec'), now() - interval '2 days', 'escuta_inicial'),
  (pg_temp.id('e_cons'), pg_temp.id('ubs'), pg_temp.id('pac2'), pg_temp.id('cons'), 'atendimento', 'Retorno', pg_temp.id('rec'), now() - interval '30 hours', 'consulta_no_dia'),
  (pg_temp.id('e_hoje'), pg_temp.id('ubs'), pg_temp.id('pac3'), pg_temp.id('cons'), 'atendimento', 'Febre', pg_temp.id('rec'),
     greatest(now() - interval '1 minute', date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'), 'consulta_no_dia');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, tipo_atendimento_aps, atendimento_iniciado_em) VALUES
  (pg_temp.id('e_atend'), pg_temp.id('ubs'), pg_temp.id('pac4'), pg_temp.id('cons'), 'atendimento', 'Cefaleia', pg_temp.id('rec'), now() - interval '3 days', 'consulta_no_dia', now() - interval '3 days');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em) VALUES
  (pg_temp.id('e_upa'), pg_temp.id('upa'), pg_temp.id('pupa'), pg_temp.id('porta'), 'triagem', 'Dor', pg_temp.id('rec'), now() - interval '2 days');

-- consulta marcada ontem, paciente chegou e a ficha não foi atendida
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, tipo_atendimento_aps) VALUES
  (pg_temp.id('e_agenda'), pg_temp.id('ubs'), pg_temp.id('pac5'), pg_temp.id('cons'), 'atendimento', 'Consulta marcada', pg_temp.id('rec'), now() - interval '26 hours', 'consulta_agendada');
INSERT INTO public.agendamentos (id, unidade_id, perfil_id, tipo, paciente_id, tipo_atendimento_aps, inicio, fim, situacao, marcado_por, situacao_em, situacao_por, episodio_id)
VALUES (pg_temp.id('ag'), pg_temp.id('ubs'), pg_temp.id('med'), 'consulta', pg_temp.id('pac5'), 'consulta_agendada',
        now() - interval '26 hours', now() - interval '25 hours 40 minutes', 'presente', pg_temp.id('rec'), now() - interval '26 hours', pg_temp.id('rec'), pg_temp.id('e_agenda'));
UPDATE public.episodios SET agendamento_id = pg_temp.id('ag') WHERE id = pg_temp.id('e_agenda');

-- 1. vence o que é de ontem e não foi atendido
-- (na homologação podem vencer também fichas de outros pacientes: conta só as do cenário)
SELECT pg_temp.ok(private.ubs_vencer_fichas() >= 3, '1. a rotina vence fichas');
SELECT pg_temp.ok((SELECT count(*) FROM public.episodios WHERE etapa = 'encerrado'
                     AND id IN (pg_temp.id('e_escuta'), pg_temp.id('e_cons'), pg_temp.id('e_agenda'))) = 3,
                  '1. vencem as 3 fichas do cenário (escuta, consultório e consulta marcada)');
SELECT pg_temp.ok((SELECT bool_and(etapa = 'encerrado' AND desfecho = 'evasao' AND desfecho_em IS NOT NULL AND encerrado_em IS NOT NULL
                                    AND desfecho_motivo LIKE 'Não aguardou:%' AND (desfecho_detalhes ->> 'vencida')::boolean)
                     FROM public.episodios WHERE id IN (pg_temp.id('e_escuta'), pg_temp.id('e_cons'), pg_temp.id('e_agenda'))),
                  '1. vencida = evasão com relato, data e marca "vencida"');
SELECT pg_temp.ok((SELECT desfecho_detalhes ->> 'etapa_anterior' FROM public.episodios WHERE id = pg_temp.id('e_escuta')) = 'triagem',
                  '1. guarda a etapa em que a ficha estava');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao = 'ficha_vencida'
                     AND entidade_id IN (pg_temp.id('e_escuta'), pg_temp.id('e_cons'), pg_temp.id('e_agenda'))) = 3,
                  '1. cada ficha vencida tem auditoria');

-- 2. o resto não muda
SELECT pg_temp.ok((SELECT etapa FROM public.episodios WHERE id = pg_temp.id('e_hoje')) = 'atendimento', '2. ficha de hoje continua na fila');
SELECT pg_temp.ok((SELECT etapa FROM public.episodios WHERE id = pg_temp.id('e_atend')) = 'atendimento', '2. ficha em atendimento continua com o médico');
SELECT pg_temp.ok((SELECT etapa FROM public.episodios WHERE id = pg_temp.id('e_upa')) = 'triagem', '2. ficha da UPA não vence');

-- 3. a agenda segue o episódio
SELECT pg_temp.ok((SELECT situacao FROM public.agendamentos WHERE id = pg_temp.id('ag')) = 'nao_aguardou', '3. consulta marcada vira "não aguardou"');

-- 4. idempotente e agendado
SELECT pg_temp.ok(private.ubs_vencer_fichas() = 0, '4. rodar de novo não vence nada');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ubs-ficha-vence' AND schedule = '5 3 * * *'), '4. job diário às 00:05 de Brasília');

ROLLBACK;
