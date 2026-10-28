-- Testes da migration 20270205000001_rnds_envio_banco.sql (Fase 5C, tarefa 5,
-- etapa 5.3a): a carga do RAC, do SA e do MIRA, a fila do serviço de envio,
-- a configuração por unidade e a conferência noturna.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
-- o item vivo de um documento
CREATE FUNCTION pg_temp.item(p_tipo text, p_ref uuid) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.interop_outbox WHERE tipo_documento = p_tipo AND referencia_id = p_ref
     AND status IN ('pendente', 'retido', 'enviado', 'erro') ORDER BY created_at DESC LIMIT 1 $$;
CREATE FUNCTION pg_temp.status(p_item uuid) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM public.interop_outbox WHERE id = p_item $$;
-- a mensagem do erro, ou null quando não falha
CREATE FUNCTION pg_temp.falha(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- o lote, como o serviço o pede
CREATE FUNCTION pg_temp.lote() RETURNS uuid[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(id), '{}') FROM public.rnds_pegar_lote(100) $$;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000f5301'), ('un', '00000000-0000-4000-8000-0000000f5302'),
  ('un_sem', '00000000-0000-4000-8000-0000000f5303'), ('central', '00000000-0000-4000-8000-0000000f5304'),
  ('setor', '00000000-0000-4000-8000-0000000f5305'), ('setor_sem', '00000000-0000-4000-8000-0000000f5306'),
  ('pac', '00000000-0000-4000-8000-0000000f5311'),
  ('ep', '00000000-0000-4000-8000-0000000f5321'), ('ep_obs', '00000000-0000-4000-8000-0000000f5322'),
  ('ep_sem', '00000000-0000-4000-8000-0000000f5323'), ('int', '00000000-0000-4000-8000-0000000f5331'),
  ('reg', '00000000-0000-4000-8000-0000000f5341'),
  ('medico', '00000000-0000-4000-8000-0000000f5351'), ('gestor', '00000000-0000-4000-8000-0000000f5352');
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  (pg_temp.u('medico'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rnds.medico.ficticio@exemplo.invalid', '{"origem": "admin"}', '{"nome_completo": "Medico Ficticio RNDS"}', now(), now()),
  (pg_temp.u('gestor'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rnds.gestor53.ficticio@exemplo.invalid', '{"origem": "admin"}', '{"nome_completo": "Gestor Ficticio RNDS"}', now(), now());
INSERT INTO public.perfis (id, nome_completo, cpf, cns, cbo) VALUES
  (pg_temp.u('medico'), 'Medico Ficticio RNDS', '111.444.777-35', '898001000000011', '225125'),
  (pg_temp.u('gestor'), 'Gestor Ficticio RNDS', NULL, '898001000000029', NULL)
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cpf = EXCLUDED.cpf, cns = EXCLUDED.cns, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede RNDS Envio Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, uf) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA RNDS Envio', 'upa', '9999995', 'GO'),
  (pg_temp.u('un_sem'), pg_temp.u('org'), 'UPA RNDS Sem Config', 'upa', '9999992', 'GO'),
  (pg_temp.u('central'), pg_temp.u('org'), 'Central RNDS Envio', 'hospital', '9999993', 'GO');
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES (pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('gestor'));
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.u('setor'), pg_temp.u('un'), 'Porta RNDS', 'emergencia'),
  (pg_temp.u('setor_sem'), pg_temp.u('un_sem'), 'Porta RNDS Sem Config', 'emergencia');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo, cpf, cns) VALUES
  (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio RNDS', '1960-01-01', 'RNDS-53', 'M', '529.982.247-25', NULL);

-- ── configuração: nasce desligada; só a unidade configurada envia ──────────
SELECT pg_temp.ok((SELECT column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rnds_config_unidade' AND column_name = 'envio_ligado') = 'false',
  'configuração nasce com o envio desligado');
INSERT INTO public.rnds_config_unidade (unidade_id, identificador_solicitante, financiamento, envio_ligado)
VALUES (pg_temp.u('un'), '99999', '07', false);
SELECT pg_temp.ok(pg_temp.falha($q$INSERT INTO public.rnds_config_unidade (unidade_id, financiamento) VALUES ('$q$
  || pg_temp.u('un_sem') || $q$', '10')$q$) IS NOT NULL, 'financiamento fora do BRFinanciamento é recusado');

-- ── LOINC das medidas ──────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT loinc_codigo FROM public.conceito WHERE nome = 'pressao-arterial-sistolica' AND unidade_id IS NULL) = '8480-6'
  AND (SELECT loinc_codigo FROM public.conceito WHERE nome = 'pressao-arterial-diastolica' AND unidade_id IS NULL) = '8462-4'
  AND (SELECT loinc_codigo FROM public.conceito WHERE nome = 'peso' AND unidade_id IS NULL) = '29463-7'
  AND (SELECT loinc_codigo FROM public.conceito WHERE nome = 'estatura' AND unidade_id IS NULL) = '8302-2',
  'PAS, PAD, peso e estatura com o LOINC da lista BRTipoObservacao-1.0');

-- ── porta: um RAC (alta), uma observação (vira SA) e um sem configuração ────
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em,
  atendimento_medico_id, atendimento_iniciado_em, desfecho, desfecho_em, desfecho_por, encerrado_em, encerrado_por)
VALUES
  (pg_temp.u('ep'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('setor'), 'Dor de garganta', pg_temp.u('medico'), 'encerrado',
   '2026-08-10 10:00-03', pg_temp.u('medico'), '2026-08-10 10:30-03', 'alta', '2026-08-10 12:00-03', pg_temp.u('medico'),
   '2026-08-10 12:05-03', pg_temp.u('medico')),
  (pg_temp.u('ep_obs'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('setor'), 'Desidratação', pg_temp.u('medico'), 'encerrado',
   '2026-08-10 07:00-03', pg_temp.u('medico'), '2026-08-10 07:20-03', 'observacao', '2026-08-10 08:00-03', pg_temp.u('medico'),
   '2026-08-10 08:00-03', pg_temp.u('medico')),
  (pg_temp.u('ep_sem'), pg_temp.u('un_sem'), pg_temp.u('pac'), pg_temp.u('setor_sem'), 'Tosse seca', pg_temp.u('medico'), 'encerrado',
   '2026-08-10 09:00-03', pg_temp.u('medico'), '2026-08-10 09:10-03', 'evasao', '2026-08-10 09:40-03', pg_temp.u('medico'),
   '2026-08-10 09:40-03', pg_temp.u('medico'));
INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, episodio_id, tipo, cid, status, registrado_por, registrado_em) VALUES
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep'), 'primario', 'J06.9', 'confirmado', pg_temp.u('medico'), '2026-08-10 11:00-03'),
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep'), 'secundario', 'R50.9', 'hipotese', pg_temp.u('medico'), '2026-08-10 11:00-03');
INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
  profissional_id, cbo, via, registrado_por) VALUES
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep'), '0301060096', 1, '2026-08-10 10:30-03', pg_temp.u('medico'), '225125', 'quem_fez', pg_temp.u('medico')),
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep'), '0301060096', 1, '2026-08-10 11:30-03', pg_temp.u('medico'), '225125', 'quem_fez', pg_temp.u('medico')),
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep_obs'), '0301060029', 1, '2026-08-10 09:00-03', pg_temp.u('medico'), '225125', 'quem_fez', pg_temp.u('medico'));
INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, unidade, origem)
SELECT pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep'), c.id, v.em::timestamptz, pg_temp.u('medico'), v.valor, v.unidade, 'manual'
  FROM (VALUES ('pressao-arterial-sistolica', '2026-08-10 10:10-03', 140, 'mmHg'),
               ('pressao-arterial-sistolica', '2026-08-10 11:50-03', 128, 'mmHg'),
               ('pressao-arterial-diastolica', '2026-08-10 11:50-03', 82, 'mmHg')) AS v(nome, em, valor, unidade)
  JOIN public.conceito c ON c.nome = v.nome AND c.unidade_id IS NULL;

-- ── internação de observação vinda de outra unidade, com alta ──────────────
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, episodio_id, tipo_internacao, origem_admissao,
  status, data_admissao, data_alta, alta_por, cid_alta)
VALUES (pg_temp.u('int'), pg_temp.u('org'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('ep_obs'), 'observacao', 'outra_unidade',
  'alta_melhorada', '2026-08-10 08:00-03', '2026-08-10 20:00-03', pg_temp.u('medico'), 'E86');
INSERT INTO public.resumos_clinicos (unidade_id, paciente_id, internacao_id, resumo, autor_id, criado_em) VALUES
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('int'), 'Primeiro resumo.', pg_temp.u('medico'), '2026-08-10 12:00-03'),
  (pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('int'), 'Hidratado, aceitando dieta, alta para casa.', pg_temp.u('medico'), '2026-08-10 19:00-03');

-- ── conferência noturna: o que não entrou na fila entra ─────────────────────
SELECT pg_temp.ok(pg_temp.item('rac', pg_temp.u('ep')) IS NULL, 'antes da conferência o RAC não está na fila (gravado direto)');
SELECT pg_temp.ok(private.rnds_conferencia_noturna('2026-08-10') @> '{"rac": 2, "sumario_alta": 1}',
  'conferência põe na fila os dois RAC (alta e evasão) e o SA; a observação não vira RAC');
SELECT pg_temp.ok(pg_temp.item('rac', pg_temp.u('ep_obs')) IS NULL, 'episódio que virou observação não tem RAC');
SELECT pg_temp.ok(private.rnds_conferencia_noturna('2026-08-10') @> '{"rac": 0, "sumario_alta": 0, "regulacao": 0}',
  'a segunda conferência do mesmo dia não põe nada');
SELECT pg_temp.ok((SELECT rac FROM private.rnds_conferencias WHERE dia = '2026-08-10') = 0, 'a conferência fica registrada');

-- ── lote: só da unidade com envio ligado ───────────────────────────────────
SELECT pg_temp.ok(cardinality(pg_temp.lote()) = 0, 'com o envio desligado, nada sai');
UPDATE public.rnds_config_unidade SET envio_ligado = true WHERE unidade_id = pg_temp.u('un');
INSERT INTO t SELECT 'lote1', pg_temp.lote()::text;
SELECT pg_temp.ok((SELECT valor::uuid[] FROM t WHERE nome = 'lote1')
    @> ARRAY[pg_temp.item('rac', pg_temp.u('ep')), pg_temp.item('sumario_alta', pg_temp.u('int'))]
  AND NOT (SELECT valor::uuid[] FROM t WHERE nome = 'lote1') @> ARRAY[pg_temp.item('rac', pg_temp.u('ep_sem'))],
  'envio ligado: a unidade configurada sai; a outra não');
SELECT pg_temp.ok(cardinality(pg_temp.lote()) = 0, 'o lote fica travado: outro pedido não pega os mesmos itens');

-- ── carga do RAC ────────────────────────────────────────────────────────────
INSERT INTO t SELECT 'd_rac', public.rnds_dados_documento(pg_temp.item('rac', pg_temp.u('ep')))::text;
SELECT pg_temp.ok((SELECT valor::jsonb FROM t WHERE nome = 'd_rac') @> '{"tipo": "rac",
  "dados": {"contato": {"modalidade": "06", "carater": "02", "procedencia": "99", "desfecho": "01"},
            "paciente": {"cpf": "52998224725"}, "estabelecimento": {"cnes": "9999995"},
            "profissional": {"cpf": "11144477735", "cbo_codigo": "225125"}},
  "envio": {"ambiente": "homologacao", "uf": "GO", "identificador_solicitante": "99999", "profissional_cns": "898001000000011"}}',
  'RAC: urgência, demanda 99, alta 01, CPF só com dígitos, CBO e o CNS de quem assina');
SELECT pg_temp.ok((SELECT valor::jsonb #> '{dados,procedimentos}' FROM t WHERE nome = 'd_rac') @> '[{"codigo_sigtap": "0301060096", "quantidade": 2, "financiamento": "07"}]'
  AND jsonb_array_length((SELECT valor::jsonb #> '{dados,procedimentos}' FROM t WHERE nome = 'd_rac')) = 1,
  'o mesmo procedimento no mesmo dia vai uma vez, com a quantidade somada e o financiamento da unidade');
SELECT pg_temp.ok((SELECT valor::jsonb #> '{dados,condicoes}' FROM t WHERE nome = 'd_rac')
  @> '[{"codigo_cid": "J06.9", "categoria": "principal"}, {"codigo_cid": "R50.9", "categoria": "secundaria"}]',
  'diagnósticos do episódio: o primário como principal');
SELECT pg_temp.ok((SELECT valor::jsonb #> '{dados,observacoes}' FROM t WHERE nome = 'd_rac')
  @> '[{"loinc_codigo": "8480-6", "valor_num": 128}, {"loinc_codigo": "8462-4", "valor_num": 82}]'
  AND jsonb_array_length((SELECT valor::jsonb #> '{dados,observacoes}' FROM t WHERE nome = 'd_rac')) = 2,
  'medidas: a última PAS (128, não 140) e a PAD');
SELECT pg_temp.ok((SELECT valor::jsonb #>> '{dados,encontro,data_alta}' FROM t WHERE nome = 'd_rac')::timestamptz = '2026-08-10 12:00-03',
  'o fim do atendimento é a hora do desfecho');

-- ── carga do SA ─────────────────────────────────────────────────────────────
INSERT INTO t SELECT 'd_sa', public.rnds_dados_documento(pg_temp.item('sumario_alta', pg_temp.u('int')))::text;
SELECT pg_temp.ok((SELECT valor::jsonb FROM t WHERE nome = 'd_sa') @> '{"tipo": "sumario_alta",
  "dados": {"contato": {"modalidade": "06", "carater": "02", "procedencia": "12", "desfecho": "01"},
            "resumo_evolucao": "Hidratado, aceitando dieta, alta para casa.",
            "condicoes": [{"codigo_cid": "E86", "categoria": "principal"}],
            "procedimentos": [{"codigo_sigtap": "0301060029", "quantidade": 1}]}}',
  'SA de observação: modalidade 06, vinda de outra unidade (12), o último resumo, o CID da alta e o procedimento');

-- ── retenção pela carga ────────────────────────────────────────────────────
UPDATE public.rnds_config_unidade SET financiamento = NULL WHERE unidade_id = pg_temp.u('un');
SELECT pg_temp.ok(pg_temp.falha(format('SELECT public.rnds_dados_documento(%L)', pg_temp.item('rac', pg_temp.u('ep'))))
  LIKE 'retido: unidade sem financiamento%', 'sem financiamento configurado, a carga retém');
UPDATE public.rnds_config_unidade SET financiamento = '07' WHERE unidade_id = pg_temp.u('un');

-- ── resultado: retido, enviado, substituição ───────────────────────────────
SELECT pg_temp.ok(public.rnds_registrar_resultado(pg_temp.item('sumario_alta', pg_temp.u('int')), 'retido',
  p_erro => 'retido: profissional sem CBO') = 'retido', 'retido');
SELECT pg_temp.ok((SELECT proxima_tentativa_em > now() + interval '59 minutes' AND travado_ate IS NULL AND ultimo_erro = 'retido: profissional sem CBO'
  FROM public.interop_outbox WHERE id = pg_temp.item('sumario_alta', pg_temp.u('int'))), 'retido volta em 1 h, com o motivo');

SELECT pg_temp.ok(pg_temp.falha(format($q$SELECT public.rnds_registrar_resultado(%L, 'enviado')$q$, pg_temp.item('rac', pg_temp.u('ep'))))
  = 'enviado sem o id da RNDS', 'enviado exige o id da RNDS');
SELECT pg_temp.ok(public.rnds_registrar_resultado(pg_temp.item('rac', pg_temp.u('ep')), 'enviado', 'rnds-id-1',
  '{"resourceType": "Bundle"}', '{"location": "Bundle/rnds-id-1"}') = 'enviado', 'enviado');
SELECT pg_temp.ok((SELECT id_rnds = 'rnds-id-1' AND enviado_em IS NOT NULL AND bundle_enviado IS NOT NULL AND tentativas = 1
  FROM public.interop_outbox WHERE id = pg_temp.item('rac', pg_temp.u('ep'))), 'o id da RNDS, a hora e o Bundle ficam gravados');
SELECT pg_temp.ok(pg_temp.falha(format($q$SELECT public.rnds_registrar_resultado(%L, 'erro')$q$, pg_temp.item('rac', pg_temp.u('ep'))))
  LIKE '%não aceita resultado', 'item enviado não aceita outro resultado');
-- uma correção do mesmo atendimento substitui o enviado
INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status)
VALUES (pg_temp.u('un'), 'rac', pg_temp.u('ep'), '{"resourceType": "Bundle", "marcador": true}', 'pendente');
SELECT pg_temp.ok(public.rnds_dados_documento((SELECT id FROM public.interop_outbox WHERE tipo_documento = 'rac'
  AND referencia_id = pg_temp.u('ep') AND status = 'pendente')) #>> '{envio,id_rnds_anterior}' = 'rnds-id-1',
  'o documento seguinte leva o id do anterior, para substituí-lo');

-- ── nova tentativa e erro ──────────────────────────────────────────────────
INSERT INTO t SELECT 'i_rac2', id::text FROM public.interop_outbox
 WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.u('ep') AND status = 'pendente';
SELECT pg_temp.ok(public.rnds_registrar_resultado(pg_temp.u('i_rac2'), 'reenviar', p_erro => 'tempo esgotado') = 'pendente',
  'falha passageira volta à fila');
SELECT pg_temp.ok((SELECT tentativas = 1 AND proxima_tentativa_em > now() FROM public.interop_outbox WHERE id = pg_temp.u('i_rac2')),
  'com a tentativa contada e a espera');
UPDATE public.interop_outbox SET tentativas = 29 WHERE id = pg_temp.u('i_rac2');
SELECT pg_temp.ok(public.rnds_registrar_resultado(pg_temp.u('i_rac2'), 'reenviar', p_erro => 'HTTP 503') = 'erro',
  'depois de 30 tentativas vira erro');
SELECT pg_temp.ok((SELECT ultimo_erro LIKE 'sem resposta da RNDS depois de 30 tentativas%' AND proxima_tentativa_em IS NULL
  FROM public.interop_outbox WHERE id = pg_temp.u('i_rac2')), 'com o motivo e sem nova tentativa');

-- ── credencial recusada: a unidade pausa ───────────────────────────────────
UPDATE public.interop_outbox SET proxima_tentativa_em = now() - interval '1 minute'
 WHERE id = pg_temp.item('sumario_alta', pg_temp.u('int'));
SELECT pg_temp.ok(public.rnds_registrar_resultado(pg_temp.item('sumario_alta', pg_temp.u('int')), 'credencial',
  p_erro => '(EHR-ERR882) token inválido') = 'pendente', 'credencial recusada: o item volta à fila');
SELECT pg_temp.ok((SELECT pausado_em IS NOT NULL AND pausa_motivo LIKE '%ERR882%' FROM public.rnds_config_unidade
  WHERE unidade_id = pg_temp.u('un')), 'e a unidade pausa, com o motivo');
SELECT pg_temp.ok(cardinality(pg_temp.lote()) = 0, 'unidade pausada não envia');
UPDATE public.rnds_config_unidade SET pausado_em = NULL, pausa_motivo = NULL WHERE unidade_id = pg_temp.u('un');

-- ── MIRA: quem mudou o status assina ───────────────────────────────────────
SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.u('medico'), 'role', 'authenticated')::text, true);
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999995', pg_temp.u('pac'), false,
  'leito', '0303060190', 'clinico', 'a_definir', NULL, 'urgencia', '04', 'urgencia', 'E86',
  'Quadro clínico do pedido de teste da RNDS.', pg_temp.u('gestor'), 'gestor', 'enviada');
SELECT pg_temp.ok((SELECT profissional_id FROM public.interop_outbox WHERE id = pg_temp.item('regulacao', pg_temp.u('reg')))
  = pg_temp.u('medico'), 'MIRA: quem enviou a solicitação assina');
SELECT pg_temp.ok(public.rnds_dados_documento(pg_temp.item('regulacao', pg_temp.u('reg')))
  @> '{"tipo": "regulacao", "dados": {"status": "pending"}, "envio": {"profissional_cns": "898001000000011"}}',
  'carga do MIRA: o retrato e o CNS de quem assina');
-- rotina sem usuário: assina o autor do último evento
SELECT set_config('request.jwt.claims', '{}', true);
INSERT INTO public.regulacao_eventos (solicitacao_id, evento, por, em)
VALUES (pg_temp.u('reg'), 'autorizada', pg_temp.u('gestor'), now() + interval '1 second');
UPDATE public.regulacao_solicitacoes SET status = 'autorizada', autorizada_em = now() WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok((SELECT profissional_id FROM public.interop_outbox WHERE id = pg_temp.item('regulacao', pg_temp.u('reg')))
  = pg_temp.u('gestor'), 'sem usuário na sessão, assina o autor do último evento');

-- ── permissões ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'public.rnds_pegar_lote(integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.rnds_dados_documento(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rnds_registrar_resultado(uuid, text, text, jsonb, jsonb, text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.rnds_dados_documento(uuid)', 'EXECUTE'),
  'as três funções só para a chave de serviço');
SELECT pg_temp.ok(NOT has_table_privilege('authenticated', 'public.rnds_config_unidade', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.rnds_config_unidade', 'SELECT'),
  'configuração: ninguém grava pela API; anônimo não lê');
SELECT pg_temp.ok((SELECT count(*) FROM cron.job WHERE jobname = 'rnds-conferencia-noturna' AND schedule = '0 4 * * *') = 1,
  'conferência agendada para 01:00 de Brasília');

ROLLBACK;
