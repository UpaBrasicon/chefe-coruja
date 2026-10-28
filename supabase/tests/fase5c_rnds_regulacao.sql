-- Testes da migration 20270204000001_rnds_regulacao.sql (Fase 5C, tarefa 5,
-- etapa 5.1): a regulação entra na fila da RNDS no modelo MIRA, um item por
-- mudança do status MIRA, com o retrato dos dados naquele momento.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
-- itens da fila de uma solicitação, por situação
CREATE FUNCTION pg_temp.itens(p_reg uuid, p_status text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.interop_outbox WHERE tipo_documento = 'regulacao' AND referencia_id = p_reg AND status = p_status $$;
-- retrato MIRA do item pendente
CREATE FUNCTION pg_temp.mira(p_reg uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT payload -> 'mira' FROM public.interop_outbox
   WHERE tipo_documento = 'regulacao' AND referencia_id = p_reg AND status = 'pendente' $$;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000f5101'), ('un', '00000000-0000-4000-8000-0000000f5102'),
  ('un2', '00000000-0000-4000-8000-0000000f5103'), ('central', '00000000-0000-4000-8000-0000000f5104'),
  ('pac', '00000000-0000-4000-8000-0000000f5105'), ('pac_cns', '00000000-0000-4000-8000-0000000f5106'),
  ('pac_sem', '00000000-0000-4000-8000-0000000f5107'),
  ('reg', '00000000-0000-4000-8000-0000000f5111'), ('reg_ni', '00000000-0000-4000-8000-0000000f5112'),
  ('reg_sem', '00000000-0000-4000-8000-0000000f5113'), ('reg_cons', '00000000-0000-4000-8000-0000000f5114'),
  ('gestor', '00000000-0000-4000-8000-0000000f5121');
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (pg_temp.u('gestor'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rnds.gestor.ficticio@exemplo.invalid', '{"origem": "admin"}', '{"nome_completo": "Gestor Ficticio RNDS"}', now(), now());
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.u('gestor'), 'Gestor Ficticio RNDS')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede RNDS Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA RNDS', 'upa', '9999995'),
  (pg_temp.u('un2'), pg_temp.u('org'), 'Hospital RNDS', 'hospital', '9999994'),
  (pg_temp.u('central'), pg_temp.u('org'), 'Central RNDS', 'hospital', '9999993');
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES (pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('gestor'));
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9'), ('M54.5', 'CID do teste M54.5')
ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo, cpf, cns) VALUES
  (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio CPF', '1960-01-01', 'RNDS-1', 'M', '529.982.247-25', NULL),
  (pg_temp.u('pac_cns'), pg_temp.u('un'), 'Paciente Ficticio CNS', '1970-01-01', 'RNDS-2', 'F', NULL, '898 0010 0000 0003'),
  (pg_temp.u('pac_sem'), pg_temp.u('un'), 'Paciente Ficticio Sem Documento', '1980-01-01', 'RNDS-3', 'F', NULL, NULL);

-- a tabela do status
SELECT pg_temp.ok(private.rnds_status_mira('rascunho') IS NULL, 'rascunho não vai');
SELECT pg_temp.ok(private.rnds_status_mira('aguardando_destino') = 'pending', 'aguardando destino vai como pending (9a)');
SELECT pg_temp.ok(private.rnds_status_mira('em_transito') = 'booked', 'em trânsito vai como booked (7a)');
SELECT pg_temp.ok(private.rnds_status_mira('realizada') = 'attended', 'realizada vai como attended (7a)');
SELECT pg_temp.ok(private.rnds_status_mira('negada') = 'cancelled' AND private.rnds_status_mira('falta') = 'absence'
  AND private.rnds_status_mira('devolvida') = 'returned-to-requester' AND private.rnds_status_mira('excluida') = 'excluded',
  'negada, falta, devolvida e excluída');

-- leito urgente: rascunho não entra; o envio entra como pending
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999995', pg_temp.u('pac'), false,
  'leito', '0303060190', 'clinico', 'rede', pg_temp.u('un2'), 'urgencia', '04', 'urgencia', 'I21.9',
  'Quadro clínico do pedido de teste da RNDS.', pg_temp.u('gestor'), 'gestor', 'rascunho');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg'), 'pendente') = 0, 'rascunho não entra na fila');
UPDATE public.regulacao_solicitacoes SET status = 'enviada' WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg'), 'pendente') = 1, 'envio entra na fila');
SELECT pg_temp.ok(pg_temp.mira(pg_temp.u('reg')) @> '{"status": "pending", "cnes_evento": "9999995", "modalidade": "04",
  "carater": "urgent", "cid": "I219", "procedimento": "0303060190", "paciente_cpf": "52998224725",
  "cnes_solicitante": "9999995", "cnes_executante": "9999994", "cnes_regulador": "9999993"}',
  'retrato: pending pela origem, leito 04, urgente, CID sem ponto, CPF só com dígitos e os três CNES');
SELECT pg_temp.ok((SELECT unidade_id FROM public.interop_outbox WHERE referencia_id = pg_temp.u('reg') AND status = 'pendente')
  = pg_temp.u('un'), 'o item é da unidade de origem');

-- em análise não muda o status MIRA: nenhum item novo
UPDATE public.regulacao_solicitacoes SET status = 'em_analise' WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok((SELECT count(*) FROM public.interop_outbox WHERE referencia_id = pg_temp.u('reg')) = 1,
  'em análise não gera item novo');

-- autorizada: o pending ainda não enviado é descartado e entra o booked, pela central
UPDATE public.regulacao_solicitacoes SET status = 'autorizada', autorizada_em = now() WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg'), 'descartado') = 1 AND pg_temp.itens(pg_temp.u('reg'), 'pendente') = 1,
  'status novo descarta o pendente anterior');
SELECT pg_temp.ok(pg_temp.mira(pg_temp.u('reg')) @> '{"status": "booked", "cnes_evento": "9999993", "status_origem": "autorizada"}',
  'booked pela central');

-- depois de enviado, em trânsito (ainda booked) não gera item; realizada gera attended pelo destino
UPDATE public.interop_outbox SET status = 'enviado', enviado_em = now(), id_rnds = 'teste-1'
 WHERE referencia_id = pg_temp.u('reg') AND status = 'pendente';
UPDATE public.regulacao_solicitacoes SET status = 'em_transito' WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg'), 'pendente') = 0, 'em trânsito depois de booked enviado: nada novo');
UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = now() WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg'), 'enviado') = 1 AND pg_temp.mira(pg_temp.u('reg')) @> '{"status": "attended", "cnes_evento": "9999994"}',
  'realizada: attended pelo destino; o enviado fica');
SELECT pg_temp.ok(pg_temp.mira(pg_temp.u('reg')) ->> 'realizada_em' IS NOT NULL, 'realizada leva a data');

-- paciente não identificado: fica fora até ser identificado
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg_ni'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999995', pg_temp.u('pac_cns'), true,
  'leito', '0303060190', 'clinico', 'a_definir', NULL, 'urgencia', '04', 'urgencia', 'I21.9',
  'Quadro clínico do pedido de teste da RNDS.', pg_temp.u('gestor'), 'gestor', 'enviada');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg_ni'), 'pendente') = 0, 'não identificado fica fora da fila');
UPDATE public.regulacao_solicitacoes SET paciente_nao_identificado = false WHERE id = pg_temp.u('reg_ni');
SELECT pg_temp.ok(pg_temp.mira(pg_temp.u('reg_ni')) @> '{"status": "pending", "paciente_cns": "898001000000003"}'
  AND pg_temp.mira(pg_temp.u('reg_ni')) ->> 'paciente_cpf' IS NULL AND pg_temp.mira(pg_temp.u('reg_ni')) ->> 'cnes_executante' IS NULL,
  'identificado entra, com o CNS e sem executante');

-- paciente sem CPF e sem CNS: fica fora
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg_sem'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999995', pg_temp.u('pac_sem'), false,
  'leito', '0303060190', 'clinico', 'a_definir', NULL, 'urgencia', '04', 'urgencia', 'I21.9',
  'Quadro clínico do pedido de teste da RNDS.', pg_temp.u('gestor'), 'gestor', 'enviada');
SELECT pg_temp.ok(pg_temp.itens(pg_temp.u('reg_sem'), 'pendente') = 0, 'sem CPF e sem CNS fica fora da fila');

-- consulta eletiva: modalidade 09 e routine; cancelada pela origem
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, especialidade, cbo, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg_cons'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999995', pg_temp.u('pac'), false,
  'consulta', '0301010072', 'Ortopedia', '225270', 'a_definir', NULL, 'eletivo', '07', 'eletiva', 'M54.5',
  'Quadro clínico da consulta de teste da RNDS.', pg_temp.u('gestor'), 'gestor', 'enviada');
SELECT pg_temp.ok(pg_temp.mira(pg_temp.u('reg_cons')) @> '{"modalidade": "09", "carater": "routine", "cbo": "225270"}',
  'consulta: modalidade 09 (8a), routine e CBO');
UPDATE public.regulacao_solicitacoes
   SET status = 'cancelada', cancelada_em = now(), cancelamento_origem = 'solicitante', motivo_cancelamento = 'Paciente melhorou e não precisa mais.'
 WHERE id = pg_temp.u('reg_cons');
SELECT pg_temp.ok(pg_temp.mira(pg_temp.u('reg_cons')) @> '{"status": "cancelled", "cnes_evento": "9999995"}',
  'cancelada pela origem: cancelled pelo CNES da origem');

ROLLBACK;
