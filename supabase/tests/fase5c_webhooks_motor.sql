-- Testes das migrations 20270201000002_webhooks_motor.sql e
-- 20270201000003_api_prescricao_regulacao.sql (Fase 5C, tarefa 4, etapa 4.2):
-- lote e resultado do motor (agenda das tentativas, 24 h, reserva), desligamento
-- automático com aviso ao gestor, cron sem configuração não chama nada, e a
-- leitura de prescrição e regulação pela API v1.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(uuid) TO authenticated;
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
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
-- leitura pela porta da API, como a Edge Function faz
CREATE FUNCTION pg_temp.ler(p_chave text, p_recurso text, p_id uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1_leitura(p_chave, '200.1.1.1', 'teste', p_recurso, jsonb_build_object('id', p_id)) $$;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000f4c01'), ('un', '00000000-0000-4000-8000-0000000f4c02'),
  ('un2', '00000000-0000-4000-8000-0000000f4c03'), ('central', '00000000-0000-4000-8000-0000000f4c04'),
  ('setor', '00000000-0000-4000-8000-0000000f4c05'), ('pac', '00000000-0000-4000-8000-0000000f4c07'),
  ('epi', '00000000-0000-4000-8000-0000000f4c0a'), ('presc', '00000000-0000-4000-8000-0000000f4c0c'),
  ('item1', '00000000-0000-4000-8000-0000000f4c0e'), ('item2', '00000000-0000-4000-8000-0000000f4c0f'),
  ('reg', '00000000-0000-4000-8000-0000000f4c0d'),
  ('super', '00000000-0000-4000-8000-0000000f4c11'), ('gestor', '00000000-0000-4000-8000-0000000f4c12');
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(k), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'webhooks.motor.' || k || '.ficticio@exemplo.invalid', '{"origem": "admin"}', jsonb_build_object('nome_completo', 'Ficticio ' || k), now(), now()
  FROM unnest(ARRAY['super', 'gestor']) k;
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm) VALUES
  (pg_temp.u('super'), 'Super Ficticio Motor', NULL, NULL), (pg_temp.u('gestor'), 'Medica Ficticia Motor', '123456', 'SP')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, crm = EXCLUDED.crm, uf_crm = EXCLUDED.uf_crm;
INSERT INTO public.super_admins (perfil_id) VALUES (pg_temp.u('super')) ON CONFLICT DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede Motor Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA Motor', 'upa', '9999993'),
  (pg_temp.u('un2'), pg_temp.u('org'), 'Hospital Motor', 'hospital', '9999992'),
  (pg_temp.u('central'), pg_temp.u('org'), 'Central Motor', 'hospital', NULL);
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por) VALUES (pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('super'));
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.u('setor'), pg_temp.u('un'), 'PS Motor', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.u('gestor'), pg_temp.u('un'), 'gestor') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

-- agenda das tentativas
SELECT pg_temp.ok(private.webhook_proxima(1, now(), now()) = now() + interval '5 seconds', '2ª tentativa em 5 s');
SELECT pg_temp.ok(private.webhook_proxima(6, now() - interval '10 hours', now()) = now() + interval '10 hours', '7ª tentativa em 10 h');
SELECT pg_temp.ok(private.webhook_proxima(6, now() - interval '20 hours', now()) IS NULL, 'passaria de 24 h: desiste');
SELECT pg_temp.ok(private.webhook_proxima(7, now(), now()) IS NULL, 'depois da 7ª: desiste');

-- chaves e destino
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('super'));
INSERT INTO t SELECT 'resChave', public.api_criar_chave('Receptor de teste', 'test', ARRAY[pg_temp.u('un'), pg_temp.u('un2')],
  ARRAY['pacientes', 'atendimentos', 'prescricoes', 'regulacao'])::text;
INSERT INTO t SELECT 'resSo2', public.api_criar_chave('Hospital só regulação', 'test', ARRAY[pg_temp.u('un2')], ARRAY['regulacao'])::text;
INSERT INTO t SELECT 'resSemRec', public.api_criar_chave('Sem os recursos novos', 'test', ARRAY[pg_temp.u('un')], ARRAY['pacientes'])::text;
INSERT INTO t SELECT 'chave', pg_temp.v('resChave')::jsonb ->> 'id';
INSERT INTO t SELECT 'texto', pg_temp.v('resChave')::jsonb ->> 'chave';
INSERT INTO t SELECT 'texto2', pg_temp.v('resSo2')::jsonb ->> 'chave';
INSERT INTO t SELECT 'textoSem', pg_temp.v('resSemRec')::jsonb ->> 'chave';
INSERT INTO t SELECT 'resA', public.webhook_criar_destino('Receptor da UPA', 'https://receptor.exemplo.com.br/hook', pg_temp.u('chave'),
  ARRAY[pg_temp.u('un')], private.webhook_tipos())::text;
INSERT INTO t SELECT 'A', pg_temp.v('resA')::jsonb ->> 'id';
SELECT pg_temp.falha('SELECT public.webhook_lote(10)', 'permission denied', 'login comum não pega lote');
RESET ROLE;

-- os fatos: paciente, atendimento, prescrição com item alterado, regulação para o hospital
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo)
VALUES (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio Motor', '1980-01-01', 'WM-0001', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
VALUES (pg_temp.u('epi'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('setor'), 'Teste motor', pg_temp.u('gestor'), now() - interval '1 hour');
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, criada_por, episodio_id, assinada_em, observacoes)
VALUES (pg_temp.u('presc'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('gestor'), 'assinada', pg_temp.u('gestor'), pg_temp.u('epi'), now(),
        'Observação livre que não sai pela API');
-- a trava de peso da prescrição não é o que se testa aqui
ALTER TABLE public.prescricao_itens DISABLE TRIGGER trg_prescricao_exige_idade_peso;
INSERT INTO public.prescricao_itens (id, prescricao_id, descricao, dose, posologia, ordem, tipo, via, versao)
VALUES (pg_temp.u('item1'), pg_temp.u('presc'), 'Dipirona 500 mg/mL', '1 g', '6/6 h', 1, 'medicamento', 'IV', 1);
INSERT INTO public.prescricao_itens (id, prescricao_id, descricao, dose, posologia, ordem, tipo, via, versao, substitui_item_id, motivo_alteracao)
VALUES (pg_temp.u('item2'), pg_temp.u('presc'), 'Dipirona 500 mg/mL', '1 g', '8/8 h', 1, 'medicamento', 'IV', 2, pg_temp.u('item1'), 'Ajuste de intervalo');
ALTER TABLE public.prescricao_itens ENABLE TRIGGER trg_prescricao_exige_idade_peso;
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999993', pg_temp.u('pac'), false,
  'leito', '0303060190', 'clinico', 'rede', pg_temp.u('un2'), 'urgencia', '04', 'urgencia', 'I21.9',
  'Quadro clínico livre que não sai pela API do teste.', pg_temp.u('gestor'), 'gestor', 'enviada');

-- motor: lote
SELECT pg_temp.ok((SELECT count(*) FROM public.webhook_entregas WHERE destino_id = pg_temp.u('A')) = 4, 'quatro entregas na fila');
INSERT INTO t SELECT 'lote', public.webhook_lote(2)::text;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.v('lote')::jsonb) = 2, 'lote respeita o limite');
SELECT pg_temp.ok((SELECT bool_and(x ->> 'segredo' = pg_temp.v('resA')::jsonb ->> 'segredo' AND (x ->> 'tentativa')::int = 1
                       AND x ->> 'url' = 'https://receptor.exemplo.com.br/hook')
                     FROM jsonb_array_elements(pg_temp.v('lote')::jsonb) x), 'lote leva endereço, segredo e número da tentativa');
SELECT pg_temp.ok((SELECT (x ->> 'corpo')::jsonb ?& ARRAY['id', 'type', 'timestamp', 'data'] FROM jsonb_array_elements(pg_temp.v('lote')::jsonb) x LIMIT 1),
  'corpo no formato {id, type, timestamp, data}');
INSERT INTO t SELECT 'e1', pg_temp.v('lote')::jsonb -> 0 ->> 'id';
INSERT INTO t SELECT 'e2', pg_temp.v('lote')::jsonb -> 1 ->> 'id';
SELECT pg_temp.ok(jsonb_array_length(public.webhook_lote(10)) = 2, 'reservadas não voltam no lote seguinte');
SELECT pg_temp.ok(public.webhook_lote(10) = '[]'::jsonb, 'fila vazia');

-- resultado: sucesso, falha e desistência
SELECT pg_temp.ok(public.webhook_resultado(pg_temp.u('e1'), 204) ->> 'situacao' = 'entregue', '2xx: entregue');
SELECT pg_temp.ok(public.webhook_resultado(pg_temp.u('e1'), 500) ->> 'situacao' = 'entregue', 'resultado repetido não muda nada');
SELECT pg_temp.ok(public.webhook_resultado(pg_temp.u('e2'), 503, 'Service Unavailable') ->> 'situacao' = 'pendente', '5xx: nova tentativa');
SELECT pg_temp.ok((SELECT proxima_em BETWEEN clock_timestamp() + interval '4 seconds' AND clock_timestamp() + interval '6 seconds'
                      AND ultimo_status = 503 AND ultimo_erro = 'Service Unavailable'
                     FROM public.webhook_entregas WHERE id = pg_temp.u('e2')), 'próxima em 5 s, com o status e o erro');
SELECT pg_temp.ok((SELECT falhando_desde IS NOT NULL FROM public.webhook_destinos WHERE id = pg_temp.u('A')), 'destino marcado falhando');
UPDATE public.webhook_entregas SET tentativas = 7 WHERE id = pg_temp.u('e2');
SELECT pg_temp.ok(public.webhook_resultado(pg_temp.u('e2'), 0, 'tempo esgotado') ->> 'situacao' = 'falhou', 'última tentativa sem resposta: falhou');
SELECT pg_temp.ok((SELECT ultimo_status IS NULL FROM public.webhook_entregas WHERE id = pg_temp.u('e2')), 'sem resposta: sem status HTTP');

-- reenvio manual recomeça a contagem
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT public.webhook_reenviar(pg_temp.u('e2'));
RESET ROLE;
SELECT pg_temp.ok((SELECT tentativas = 0 AND situacao = 'pendente' FROM public.webhook_entregas WHERE id = pg_temp.u('e2')), 'reenvio volta à fila do zero');
UPDATE public.webhook_entregas SET tentativas = 1, criada_em = now() - interval '2 days' WHERE id = pg_temp.u('e2');
SELECT pg_temp.ok(public.webhook_resultado(pg_temp.u('e2'), 500) ->> 'situacao' = 'pendente', 'as 24 h contam do reenvio, não do evento');
UPDATE public.webhook_entregas SET situacao = 'entregue' WHERE id = pg_temp.u('e2');

-- sem a configuração do motor no Vault, o cron não chama nada
UPDATE public.webhook_entregas SET proxima_em = now() - interval '1 minute' WHERE destino_id = pg_temp.u('A') AND situacao = 'pendente';
DELETE FROM vault.secrets WHERE name IN ('webhooks_motor_url', 'webhooks_motor_segredo');
SELECT private.webhook_acordar_motor();
SELECT pg_temp.ok(true, 'cron sem configuração não falha');
SELECT pg_temp.ok(public.webhook_motor_autorizado(repeat('x', 40)) = false, 'sem segredo no Vault, ninguém chama o motor');
SELECT vault.create_secret(repeat('s', 40), 'webhooks_motor_segredo', 'teste');
SELECT pg_temp.ok(public.webhook_motor_autorizado(repeat('s', 40)), 'segredo do Vault autoriza o motor');
SELECT pg_temp.ok(NOT public.webhook_motor_autorizado(repeat('s', 39) || 'x') AND NOT public.webhook_motor_autorizado(NULL), 'segredo errado ou vazio não autoriza');
SELECT pg_temp.ok((SELECT count(*) FROM cron.job WHERE jobname IN ('webhooks-motor', 'webhooks-manutencao')) = 2, 'cron agendado');

-- desligamento automático depois de 3 dias falhando, com aviso ao gestor
SELECT private.webhook_manutencao();
SELECT pg_temp.ok((SELECT desligado_em IS NULL FROM public.webhook_destinos WHERE id = pg_temp.u('A')), 'falhando há pouco: segue ligado');
UPDATE public.webhook_destinos SET falhando_desde = now() - interval '3 days 1 minute' WHERE id = pg_temp.u('A');
SELECT private.webhook_manutencao();
SELECT pg_temp.ok((SELECT desligado_automatico AND desligado_em IS NOT NULL FROM public.webhook_destinos WHERE id = pg_temp.u('A')), '3 dias falhando: desligado sozinho');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.webhook_entregas WHERE destino_id = pg_temp.u('A') AND situacao = 'pendente'), 'pendentes canceladas');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.u('gestor') AND tipo LIKE 'webhook_desligado_%'),
  'gestor avisado');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'webhook_destino_desligado' AND entidade_id = pg_temp.u('A')
                            AND payload ->> 'tipo' = 'automatico'), 'desligamento automático na auditoria');

-- limpeza dos eventos antigos
UPDATE public.webhook_eventos SET ocorrido_em = now() - interval '91 days' WHERE unidade_id = pg_temp.u('un') AND tipo = 'paciente.criado';
SELECT private.webhook_manutencao();
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.webhook_eventos WHERE unidade_id = pg_temp.u('un') AND tipo = 'paciente.criado'), 'evento de 91 dias sai');

-- leitura pela API: prescrição
INSERT INTO t SELECT 'rp', pg_temp.ler(pg_temp.v('texto'), 'prescricao', pg_temp.u('presc'))::text;
SELECT pg_temp.ok((pg_temp.v('rp')::jsonb ->> 'status')::int = 200, 'prescrição: 200');
SELECT pg_temp.ok((SELECT c ->> 'status' = 'assinada' AND c -> 'medico' ->> 'crm' = '123456' AND jsonb_array_length(c -> 'itens') = 1
                      AND c -> 'itens' -> 0 ->> 'posologia' = '8/8 h' AND (c -> 'itens' -> 0 ->> 'versao')::int = 2
                      AND NOT c ? 'observacoes' AND c -> 'paciente' ? 'id' AND NOT c::text LIKE '%Observação livre%'
                     FROM (SELECT pg_temp.v('rp')::jsonb -> 'corpo' AS c) x), 'prescrição: só a versão vigente do item, sem texto livre');
SELECT pg_temp.ok((pg_temp.ler(pg_temp.v('texto2'), 'prescricao', pg_temp.u('presc')) ->> 'status')::int = 404, 'prescrição de unidade fora da chave: 404');
SELECT pg_temp.ok((pg_temp.ler(pg_temp.v('textoSem'), 'prescricao', pg_temp.u('presc')) ->> 'status')::int = 403, 'chave sem o recurso: 403');
SELECT pg_temp.ok((pg_temp.ler(pg_temp.v('texto'), 'prescricao', gen_random_uuid()) ->> 'status')::int = 404, 'prescrição inexistente: 404');

-- leitura pela API: regulação (origem e destino)
INSERT INTO t SELECT 'rr', pg_temp.ler(pg_temp.v('texto2'), 'regulacao', pg_temp.u('reg'))::text;
SELECT pg_temp.ok((pg_temp.v('rr')::jsonb ->> 'status')::int = 200, 'regulação pela chave do destino: 200');
SELECT pg_temp.ok((SELECT c ->> 'status' = 'enviada' AND c -> 'destino' ->> 'unidade_id' = pg_temp.v('un2') AND c ->> 'tipo' = 'leito'
                      AND NOT c ? 'quadro_clinico' AND NOT c::text LIKE '%Quadro clínico livre%'
                     FROM (SELECT pg_temp.v('rr')::jsonb -> 'corpo' AS c) x), 'regulação: campos estruturados, sem quadro clínico');
UPDATE public.regulacao_solicitacoes SET status = 'rascunho' WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok((pg_temp.ler(pg_temp.v('texto'), 'regulacao', pg_temp.u('reg')) ->> 'status')::int = 404, 'rascunho não sai pela API');
SELECT pg_temp.ok((SELECT count(*) FROM public.api_acessos a JOIN public.api_chaves c ON c.id = a.chave_id
                    WHERE c.id = pg_temp.u('chave') AND a.recurso IN ('prescricao', 'regulacao')) = 3, 'cada leitura em api_acessos');

ROLLBACK;
