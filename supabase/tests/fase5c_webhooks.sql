-- Testes da migration 20270201000001_webhooks.sql (Fase 5C, tarefa 4, etapa
-- 4.1): destinos de webhook (só o super admin cadastra; o gestor vê, desliga e
-- reenvia), segredo no Vault, eventos enxutos dos seis fatos do backlog e uma
-- entrega por destino. Sem destino ativo, nada é gravado.
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
-- quantos eventos do tipo há para o recurso (lido como postgres)
CREATE FUNCTION pg_temp.eventos(p_tipo text, p_recurso uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.webhook_eventos WHERE tipo = p_tipo AND recurso_id = p_recurso $$;
GRANT EXECUTE ON FUNCTION pg_temp.eventos(text, uuid) TO authenticated;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000f4b01'), ('un', '00000000-0000-4000-8000-0000000f4b02'),
  ('un2', '00000000-0000-4000-8000-0000000f4b03'), ('central', '00000000-0000-4000-8000-0000000f4b04'),
  ('setor', '00000000-0000-4000-8000-0000000f4b05'), ('setor2', '00000000-0000-4000-8000-0000000f4b06'),
  ('pac', '00000000-0000-4000-8000-0000000f4b07'), ('pac2', '00000000-0000-4000-8000-0000000f4b08'),
  ('pac3', '00000000-0000-4000-8000-0000000f4b09'), ('epi', '00000000-0000-4000-8000-0000000f4b0a'),
  ('int', '00000000-0000-4000-8000-0000000f4b0b'), ('presc', '00000000-0000-4000-8000-0000000f4b0c'),
  ('reg', '00000000-0000-4000-8000-0000000f4b0d'),
  ('super', '00000000-0000-4000-8000-0000000f4b11'), ('gestor', '00000000-0000-4000-8000-0000000f4b12'),
  ('plant', '00000000-0000-4000-8000-0000000f4b13');
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(k), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'webhooks.' || k || '.ficticio@exemplo.invalid', '{"origem": "admin"}', jsonb_build_object('nome_completo', 'Ficticio ' || k), now(), now()
  FROM unnest(ARRAY['super', 'gestor', 'plant']) k;
INSERT INTO public.perfis (id, nome_completo) VALUES
  (pg_temp.u('super'), 'Super Ficticio Webhooks'), (pg_temp.u('gestor'), 'Gestor Ficticio Webhooks'),
  (pg_temp.u('plant'), 'Plantonista Ficticio Webhooks')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.super_admins (perfil_id) VALUES (pg_temp.u('super')) ON CONFLICT DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede Webhooks Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA Webhooks', 'upa', '9999995'),
  (pg_temp.u('un2'), pg_temp.u('org'), 'Hospital Webhooks', 'hospital', '9999994'),
  (pg_temp.u('central'), pg_temp.u('org'), 'Central Webhooks', 'hospital', NULL);
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES (pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('super'));
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.u('setor'), pg_temp.u('un'), 'PS Webhooks', 'emergencia'),
  (pg_temp.u('setor2'), pg_temp.u('un2'), 'Enfermaria Webhooks', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('gestor'), pg_temp.u('un'), 'gestor'), (pg_temp.u('plant'), pg_temp.u('un'), 'plantonista') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

-- endereço: só https com nome público
SELECT pg_temp.ok(private.webhook_url_valida('https://erp.exemplo.com.br/webhooks/chefe-coruja?x=1'), 'https público aceito');
SELECT pg_temp.ok(private.webhook_url_valida('https://ERP.Exemplo.com.br:8443/hook'), 'maiúsculas e porta aceitas');
SELECT pg_temp.ok(NOT private.webhook_url_valida('http://erp.exemplo.com.br/hook'), 'http recusado');
SELECT pg_temp.ok(NOT private.webhook_url_valida('https://localhost/hook'), 'localhost recusado');
SELECT pg_temp.ok(NOT private.webhook_url_valida('https://10.0.0.5/hook'), 'IP recusado');
SELECT pg_temp.ok(NOT private.webhook_url_valida('https://erp.internal/hook'), 'rede interna recusada');
SELECT pg_temp.ok(NOT private.webhook_url_valida('https://[::1]/hook'), 'IPv6 recusado');

-- sem destino: o paciente entra e nada é gravado
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo)
VALUES (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio Webhooks', '1980-01-01', 'WH-0001', 'F');
SELECT pg_temp.ok(pg_temp.eventos('paciente.criado', pg_temp.u('pac')) = 0, 'sem destino, nenhum evento');

SET LOCAL ROLE authenticated;
-- a chave da API (super admin)
SELECT pg_temp.como(pg_temp.u('super'));
INSERT INTO t SELECT 'chave', (public.api_criar_chave('ERP de teste', 'test', ARRAY[pg_temp.u('un'), pg_temp.u('un2')],
  ARRAY['pacientes', 'atendimentos']) ->> 'id');

-- só o super admin cadastra
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.falha(format('SELECT public.webhook_criar_destino(%L, %L, %L, ARRAY[%L]::uuid[], ARRAY[%L])',
  'ERP', 'https://erp.exemplo.com.br/hook', pg_temp.u('chave'), pg_temp.u('un'), 'paciente.criado'),
  'Só a administração da plataforma cadastra', 'gestor não cadastra destino');
SELECT pg_temp.como(pg_temp.u('super'));
SELECT pg_temp.falha(format('SELECT public.webhook_criar_destino(%L, %L, %L, ARRAY[%L]::uuid[], ARRAY[%L])',
  'ERP', 'https://erp.exemplo.com.br/hook', pg_temp.u('chave'), pg_temp.u('central'), 'paciente.criado'),
  'As unidades do destino precisam estar na chave', 'unidade fora da chave recusada');
SELECT pg_temp.falha(format('SELECT public.webhook_criar_destino(%L, %L, %L, ARRAY[%L]::uuid[], ARRAY[%L])',
  'ERP', 'https://erp.exemplo.com.br/hook', pg_temp.u('chave'), pg_temp.u('un'), 'paciente.apagado'),
  'Escolha os eventos da lista', 'evento fora da lista recusado');
SELECT pg_temp.falha(format('SELECT public.webhook_criar_destino(%L, %L, %L, ARRAY[%L]::uuid[], ARRAY[%L])',
  'ERP', 'http://erp.exemplo.com.br/hook', pg_temp.u('chave'), pg_temp.u('un'), 'paciente.criado'),
  'Endereço inválido', 'http recusado no cadastro');

-- destino A: a UPA, todos os eventos; destino B: o hospital, só a regulação
INSERT INTO t SELECT 'resA', public.webhook_criar_destino('ERP da UPA', 'https://erp.exemplo.com.br/hook', pg_temp.u('chave'),
  ARRAY[pg_temp.u('un')], private.webhook_tipos())::text;
INSERT INTO t SELECT 'resB', public.webhook_criar_destino('Regulação do hospital', 'https://hospital.exemplo.com.br/hook', pg_temp.u('chave'),
  ARRAY[pg_temp.u('un2')], ARRAY['regulacao.status_alterado'])::text;
INSERT INTO t SELECT 'A', pg_temp.v('resA')::jsonb ->> 'id';
INSERT INTO t SELECT 'B', pg_temp.v('resB')::jsonb ->> 'id';
SELECT pg_temp.ok(pg_temp.v('resA')::jsonb ->> 'segredo' LIKE 'whsec_%' AND length(pg_temp.v('resA')::jsonb ->> 'segredo') = 38,
  'segredo whsec_ devolvido no cadastro');

RESET ROLE;
SELECT pg_temp.ok((SELECT s.decrypted_secret FROM vault.decrypted_secrets s JOIN public.webhook_destinos d ON d.segredo_id = s.id
                    WHERE d.id = pg_temp.u('A')) = pg_temp.v('resA')::jsonb ->> 'segredo', 'segredo guardado no Vault');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao = 'webhook_destino_criado'
                    AND entidade_id IN (pg_temp.u('A'), pg_temp.u('B'))) = 2, 'cadastro na auditoria');

-- os eventos
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo, cpf) VALUES
  (pg_temp.u('pac2'), pg_temp.u('un'), 'Paciente Ficticia Dois', '1990-02-02', 'WH-0002', 'F', NULL),
  (pg_temp.u('pac3'), pg_temp.u('un2'), 'Paciente Ficticio Tres', '1975-03-03', 'WH-0003', 'M', NULL);
SELECT pg_temp.ok(pg_temp.eventos('paciente.criado', pg_temp.u('pac2')) = 1, 'paciente.criado na UPA');
SELECT pg_temp.ok(pg_temp.eventos('paciente.criado', pg_temp.u('pac3')) = 0, 'hospital sem esse evento no destino: nada gravado');
SELECT pg_temp.ok((SELECT dados = jsonb_build_object('unidade_id', pg_temp.u('un'), 'paciente_id', pg_temp.u('pac2'))
                     FROM public.webhook_eventos WHERE recurso_id = pg_temp.u('pac2')), 'evento enxuto: só ids, sem nome nem documento');
SELECT pg_temp.ok((SELECT situacao = 'pendente' AND destino_id = pg_temp.u('A') FROM public.webhook_entregas e
                     JOIN public.webhook_eventos ev ON ev.id = e.evento_id WHERE ev.recurso_id = pg_temp.u('pac2')), 'entrega pendente para o destino A');

INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
VALUES (pg_temp.u('epi'), pg_temp.u('un'), pg_temp.u('pac2'), pg_temp.u('setor'), 'Teste webhooks', pg_temp.u('gestor'), now() - interval '3 hours');
SELECT pg_temp.ok(pg_temp.eventos('atendimento.aberto', pg_temp.u('epi')) = 1, 'atendimento.aberto');

INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, criada_por, episodio_id, assinada_em)
VALUES (pg_temp.u('presc'), pg_temp.u('un'), pg_temp.u('pac2'), pg_temp.u('gestor'), 'assinada', pg_temp.u('gestor'), pg_temp.u('epi'), now());
SELECT pg_temp.ok(pg_temp.eventos('prescricao.assinada', pg_temp.u('presc')) = 1, 'prescricao.assinada');
UPDATE public.prescricoes SET observacoes = 'sem mudança de status' WHERE id = pg_temp.u('presc');
SELECT pg_temp.ok(pg_temp.eventos('prescricao.assinada', pg_temp.u('presc')) = 1, 'sem mudança de status, sem evento novo');

INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id, internado_em)
VALUES (pg_temp.u('int'), pg_temp.u('org'), pg_temp.u('un'), pg_temp.u('pac2'), 'internado', pg_temp.u('setor'), now() - interval '2 hours',
        pg_temp.u('epi'), now() - interval '2 hours');
SELECT pg_temp.ok(pg_temp.eventos('internacao.iniciada', pg_temp.u('int')) = 1, 'internacao.iniciada');
UPDATE public.internacoes SET status = 'alta_melhorada', data_alta = now(), motivo_alta = 'Alta de teste' WHERE id = pg_temp.u('int');
SELECT pg_temp.ok(pg_temp.eventos('internacao.alta', pg_temp.u('int')) = 1, 'internacao.alta');

UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now() WHERE id = pg_temp.u('epi') AND etapa <> 'encerrado';
SELECT pg_temp.ok(pg_temp.eventos('atendimento.encerrado', pg_temp.u('epi')) = 1, 'atendimento.encerrado (uma vez só)');

-- regulação: origem na UPA (destino A) e destino no hospital (destino B)
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  paciente_nao_identificado, tipo, procedimento, tipo_leito, destino_tipo, destino_unidade_id, carater, modalidade, prioridade,
  cid, quadro_clinico, solicitante_id, solicitante_papel, status)
VALUES (pg_temp.u('reg'), pg_temp.u('org'), pg_temp.u('central'), pg_temp.u('un'), '9999995', pg_temp.u('pac2'), false,
  'leito', '0303060190', 'clinico', 'rede', pg_temp.u('un2'), 'urgencia', '04', 'urgencia', 'I21.9',
  'Quadro clínico do pedido de teste dos webhooks.', pg_temp.u('gestor'), 'gestor', 'rascunho');
SELECT pg_temp.ok(pg_temp.eventos('regulacao.status_alterado', pg_temp.u('reg')) = 0, 'rascunho não gera evento');
UPDATE public.regulacao_solicitacoes SET status = 'enviada' WHERE id = pg_temp.u('reg');
UPDATE public.regulacao_solicitacoes SET status = 'em_analise' WHERE id = pg_temp.u('reg');
SELECT pg_temp.ok(pg_temp.eventos('regulacao.status_alterado', pg_temp.u('reg')) = 4, 'regulação: dois status, origem e destino');
SELECT pg_temp.ok((SELECT dados ->> 'status_anterior' IS NULL FROM public.webhook_eventos
                    WHERE recurso_id = pg_temp.u('reg') AND dados ->> 'status' = 'enviada' AND unidade_id = pg_temp.u('un')),
  'envio do rascunho: sem status anterior');
SELECT pg_temp.ok((SELECT dados ->> 'status_anterior' = 'enviada' FROM public.webhook_eventos
                    WHERE recurso_id = pg_temp.u('reg') AND dados ->> 'status' = 'em_analise' AND unidade_id = pg_temp.u('un2')),
  'em análise: status anterior enviada, na unidade de destino');
SELECT pg_temp.ok((SELECT count(*) FROM public.webhook_entregas e JOIN public.webhook_eventos ev ON ev.id = e.evento_id
                    WHERE ev.recurso_id = pg_temp.u('reg') AND e.destino_id = pg_temp.u('B')) = 2, 'destino B recebe só a regulação do hospital');

-- leitura: o gestor vê o destino da UPA; o plantonista não vê nada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.ok((SELECT jsonb_array_length(public.webhook_destinos_lista()) = 1
                      AND public.webhook_destinos_lista() -> 0 ->> 'id' = pg_temp.v('A')
                      AND (public.webhook_destinos_lista() -> 0 ->> 'pode_editar')::boolean = false), 'gestor vê só o destino da unidade');
SELECT pg_temp.ok(jsonb_array_length(public.webhook_entregas_do_destino(pg_temp.u('A'))) = 8, 'gestor vê as entregas do destino A');
SELECT pg_temp.falha(format('SELECT public.webhook_entregas_do_destino(%L)', pg_temp.u('B')), 'Acesso negado', 'gestor não vê destino de outra unidade');
SELECT pg_temp.falha(format('SELECT public.webhook_girar_segredo(%L)', pg_temp.u('A')), 'Só a administração da plataforma troca', 'gestor não troca o segredo');
SELECT pg_temp.como(pg_temp.u('plant'));
SELECT pg_temp.ok(public.webhook_destinos_lista() = '[]'::jsonb, 'plantonista não vê destino');
SELECT pg_temp.falha('SELECT count(*) FROM public.webhook_entregas', 'permission denied', 'tabela fechada para o REST');

-- o gestor desliga: as pendentes são canceladas e nada novo entra
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.falha(format('SELECT public.webhook_desligar_destino(%L, %L)', pg_temp.u('A'), 'curto'), 'Escreva o motivo', 'desligar exige motivo');
SELECT public.webhook_desligar_destino(pg_temp.u('A'), 'ERP em manutenção na unidade');
SELECT pg_temp.ok((SELECT bool_and(situacao = 'cancelada') FROM jsonb_to_recordset(public.webhook_entregas_do_destino(pg_temp.u('A'))) x(situacao text)),
  'pendentes do destino desligado canceladas');
INSERT INTO t SELECT 'entrega', public.webhook_entregas_do_destino(pg_temp.u('A')) -> 0 ->> 'id';
SELECT pg_temp.falha(format('SELECT public.webhook_reenviar(%L)', pg_temp.u('entrega')), 'O destino está desligado', 'não reenvia para destino desligado');
SELECT pg_temp.falha(format('SELECT public.webhook_religar_destino(%L)', pg_temp.u('A')), 'Só a administração da plataforma religa', 'gestor não religa');
RESET ROLE;
INSERT INTO public.pacientes (unidade_id, nome, data_nascimento, prontuario, sexo)
VALUES (pg_temp.u('un'), 'Paciente Ficticio Quatro', '2001-04-04', 'WH-0004', 'M');
SELECT pg_temp.ok((SELECT count(*) FROM public.webhook_eventos WHERE unidade_id = pg_temp.u('un') AND tipo = 'paciente.criado') = 1,
  'destino desligado: paciente novo sem evento');

-- o super admin religa e troca o segredo; o gestor reenvia
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('super'));
SELECT public.webhook_religar_destino(pg_temp.u('A'));
INSERT INTO t SELECT 'novo', public.webhook_girar_segredo(pg_temp.u('A')) ->> 'segredo';
SELECT pg_temp.ok(pg_temp.v('novo') LIKE 'whsec_%' AND pg_temp.v('novo') <> pg_temp.v('resA')::jsonb ->> 'segredo', 'segredo trocado');
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT public.webhook_reenviar(pg_temp.u('entrega'));
SELECT pg_temp.falha(format('SELECT public.webhook_reenviar(%L)', pg_temp.u('entrega')), 'Esta entrega já está na fila', 'reenvio repetido recusado');
RESET ROLE;
SELECT pg_temp.ok((SELECT situacao = 'pendente' AND tentativas = 0 AND reenviada_por = pg_temp.u('gestor')
                     FROM public.webhook_entregas WHERE id = pg_temp.u('entrega')), 'entrega de volta à fila');
SELECT pg_temp.ok((SELECT s.decrypted_secret FROM vault.decrypted_secrets s JOIN public.webhook_destinos d ON d.segredo_id = s.id
                    WHERE d.id = pg_temp.u('A')) = pg_temp.v('novo'), 'Vault com o segredo novo');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE entidade_id IN (pg_temp.u('A'), pg_temp.u('entrega'))
                    AND acao IN ('webhook_destino_desligado', 'webhook_destino_religado', 'webhook_segredo_trocado', 'webhook_entrega_reenviada')) = 4,
  'desligar, religar, trocar segredo e reenviar na auditoria');

-- chave revogada: o destino para de receber
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('super'));
SELECT public.api_revogar_chave(pg_temp.u('chave'), 'Fim do teste dos webhooks');
RESET ROLE;
INSERT INTO public.pacientes (unidade_id, nome, data_nascimento, prontuario, sexo)
VALUES (pg_temp.u('un'), 'Paciente Ficticio Cinco', '2002-05-05', 'WH-0005', 'F');
SELECT pg_temp.ok((SELECT count(*) FROM public.webhook_eventos WHERE unidade_id = pg_temp.u('un') AND tipo = 'paciente.criado') = 1,
  'chave revogada: paciente novo sem evento');

ROLLBACK;
