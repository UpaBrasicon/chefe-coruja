-- Fase 4, tarefa 12 — migrations 20261116000001/2 (papéis de rede). Cobre:
-- - o super admin liga o módulo e aponta a Secretaria (com setor criado);
-- - papel de rede só na Secretaria (gatilho e convite só pelo super admin);
-- - o gestor libera ou retira a unidade, com histórico e auditoria;
-- - sem plantão na escala da Secretaria, nada abre;
-- - Secretaria vê agregados (mapa de vagas e resumo de regulação) das
--   unidades liberadas; não vê a lista nominal;
-- - Regulação regional vê a lista nominal e o detalhe, com acesso registrado;
-- - Faturamento da secretaria vê a produção e baixa o arquivo fechado.
BEGIN;
-- Portão 2, tarefa 4: este teste escala a mesma pessoa em mais de um setor por
-- conveniência; a regra de sobreposição tem teste próprio (portao2_escala_sobreposicao.sql)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009b0', 'Rede da Secretaria');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009b0', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009b1'::uuid, 'UPA Liberada', '7654547'),
               ('21000000-0000-4000-8000-0000000009b2'::uuid, 'UPA Fechada', '7654555'),
               ('21000000-0000-4000-8000-0000000009b9'::uuid, 'Secretaria Municipal', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo, regulacao_tipo_leito)
SELECT x.id, x.un, 'Clínica', tipo, 'clinico'
  FROM public.setores, (VALUES ('22000000-0000-4000-8000-0000000009b1'::uuid, '21000000-0000-4000-8000-0000000009b1'::uuid),
                               ('22000000-0000-4000-8000-0000000009b2'::uuid, '21000000-0000-4000-8000-0000000009b2'::uuid)) x(id, un)
 WHERE setores.id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.leitos (setor_id, identificador, status) VALUES
  ('22000000-0000-4000-8000-0000000009b1', 'L-1', 'livre'), ('22000000-0000-4000-8000-0000000009b2', 'F-1', 'livre');
-- 001 gestor das duas UPAs; 002 médico da UPA liberada
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009b1', 'gestor'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009b2', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009b1', 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000009b1', '21000000-0000-4000-8000-0000000009b1', 'Paciente da Rede', '1970-01-01', 'R-1', '22000000-0000-4000-8000-0000000009b1', 'M'),
  ('23000000-0000-4000-8000-0000000009b2', '21000000-0000-4000-8000-0000000009b2', 'Paciente Fechado', '1970-01-01', 'R-2', '22000000-0000-4000-8000-0000000009b2', 'M');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, municipio, uf)
SELECT '21000000-0000-4000-8000-0000000009b8', '20000000-0000-4000-8000-0000000009b0', 'Central da Rede', tipo, 'Campinas', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b8', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel)
VALUES
  ('2a000000-0000-4000-8000-0000000009b1', '20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b8', '21000000-0000-4000-8000-0000000009b1',
   '7654547', '23000000-0000-4000-8000-0000000009b1', true, 'leito', '0303060190', 'uti_adulto', 'a_definir', 'urgencia', '04', 'urgencia', 'I21.9',
   'Quadro clínico do pedido de teste da rede.', '10000000-0000-4000-8000-000000000002', 'medico'),
  ('2a000000-0000-4000-8000-0000000009b2', '20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b8', '21000000-0000-4000-8000-0000000009b2',
   '7654555', '23000000-0000-4000-8000-0000000009b2', true, 'leito', '0303060190', 'uti_adulto', 'a_definir', 'urgencia', '04', 'urgencia', 'I21.9',
   'Quadro clínico do pedido da unidade fechada.', '10000000-0000-4000-8000-000000000001', 'gestor');
INSERT INTO public.bpa_fechamentos (id, unidade_id, competencia, processamento, situacao, linhas, folhas, controle, arquivo, fechado_por)
VALUES ('2b000000-0000-4000-8000-0000000009b1', '21000000-0000-4000-8000-0000000009b1', '202610', '202610', 'fechada', 3, 1, 1500,
        'CONTEUDO DO BPA DE TESTE', '10000000-0000-4000-8000-000000000001');

-- 003 é o super admin deste teste
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
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
CREATE FUNCTION pg_temp.super_admin() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT '10000000-0000-4000-8000-000000000003'::text $$;
GRANT EXECUTE ON FUNCTION pg_temp.super_admin() TO authenticated;

-- ── 1. papel de rede só na Secretaria ───────────────────────────────────────
SELECT pg_temp.falha($$INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009b9', 'secretaria')$$,
  'Papel de rede só na unidade Secretaria', 'sem módulo, papel de rede não entra');

-- ── 2. super admin liga o módulo ────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.rede_definir_modulo('20000000-0000-4000-8000-0000000009b0', true, '21000000-0000-4000-8000-0000000009b9')$$,
  'Quem liga o módulo de rede é o administrador', 'gestor não liga o módulo');
SELECT pg_temp.como(pg_temp.super_admin());
SELECT pg_temp.falha($$SELECT public.rede_definir_modulo('20000000-0000-4000-8000-0000000009b0', true, '21000000-0000-4000-8000-0000000009b1')$$,
  'Use uma unidade administrativa só para a Secretaria', 'unidade com equipe de atendimento não vira Secretaria');
SELECT public.rede_definir_modulo('20000000-0000-4000-8000-0000000009b0', true, '21000000-0000-4000-8000-0000000009b9');
SELECT pg_temp.ok((SELECT (m->>'ativo')::boolean FROM jsonb_array_elements(public.rede_modulos()) m
                    WHERE m->'organizacao'->>'id' = '20000000-0000-4000-8000-0000000009b0'),
  'super admin liga o módulo com a Secretaria');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.setores WHERE unidade_id = '21000000-0000-4000-8000-0000000009b9'), 'Secretaria ganha setor para a escala');
-- pessoas de rede: 004 Secretaria, 005 Regulação regional, 006 Faturamento da secretaria
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009b9', 'secretaria'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-0000000009b9', 'regulacao_regional'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009b9', 'faturamento_rede');
SELECT pg_temp.falha($$INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009b1', 'secretaria')$$,
  'Papel de rede só na unidade Secretaria', 'papel de rede fora da Secretaria recusado');

-- convite
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT * FROM public.gerar_convite('21000000-0000-4000-8000-0000000009b1', 'secretaria')$$,
  'Pessoas de rede são cadastradas pelo administrador', 'gestor não convida papel de rede');
SELECT pg_temp.como(pg_temp.super_admin());
SELECT pg_temp.falha($$SELECT * FROM public.gerar_convite('21000000-0000-4000-8000-0000000009b9', 'plantonista')$$,
  'Na unidade Secretaria entram só os papéis de rede', 'Secretaria não recebe papel de atendimento');
SELECT pg_temp.ok((SELECT count(*) FROM public.gerar_convite('21000000-0000-4000-8000-0000000009b9', 'regulacao_regional')) = 1,
  'super admin convida papel de rede na Secretaria');

-- ── 3. gestor libera a unidade ──────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.rede_liberar_unidade('21000000-0000-4000-8000-0000000009b1', true)$$,
  'Quem libera a unidade para os papéis de rede é o gestor', 'médico não libera a unidade');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.rede_liberar_unidade('21000000-0000-4000-8000-0000000009b1', true);
SELECT public.rede_liberar_unidade('21000000-0000-4000-8000-0000000009b2', true);
SELECT public.rede_liberar_unidade('21000000-0000-4000-8000-0000000009b2', false);
SELECT pg_temp.ok((public.rede_liberacao('21000000-0000-4000-8000-0000000009b1')->>'liberada')::boolean
              AND NOT (public.rede_liberacao('21000000-0000-4000-8000-0000000009b2')->>'liberada')::boolean
              AND jsonb_array_length(public.rede_liberacao('21000000-0000-4000-8000-0000000009b1')->'pessoas') = 3,
  'gestor libera uma, retira outra e vê quem são as pessoas de rede');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.rede_liberacoes_historico WHERE unidade_id = '21000000-0000-4000-8000-0000000009b2') = 2
              AND (SELECT count(*) FROM public.log_auditoria WHERE acao IN ('rede_unidade_liberada', 'rede_unidade_retirada')
                    AND unidade_id IN ('21000000-0000-4000-8000-0000000009b1', '21000000-0000-4000-8000-0000000009b2')) = 3,
  'liberações no histórico e na auditoria');

-- ── 4. sem plantão, nada abre ───────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.rede_regulacao_resumo('21000000-0000-4000-8000-0000000009b9')$$,
  'Fora do plantão', 'Secretaria fora do plantão não vê');
RESET ROLE;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, fracionado)
SELECT '21000000-0000-4000-8000-0000000009b9', s.id, p.id, current_date, 'manha', now() - interval '10 minutes', 360, true
  FROM public.setores s, (VALUES ('10000000-0000-4000-8000-000000000004'::uuid), ('10000000-0000-4000-8000-000000000005'::uuid),
                                 ('10000000-0000-4000-8000-000000000006'::uuid)) p(id)
 WHERE s.unidade_id = '21000000-0000-4000-8000-0000000009b9';

-- ── 5. Secretaria: agregados das liberadas ──────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok(jsonb_array_length(public.rede_regulacao_resumo('21000000-0000-4000-8000-0000000009b9')) = 1
              AND (public.rede_regulacao_resumo('21000000-0000-4000-8000-0000000009b9')->0->'como_origem'->>'esperando_central')::int = 1
              AND public.rede_regulacao_resumo('21000000-0000-4000-8000-0000000009b9')::text NOT LIKE '%Paciente%',
  'Secretaria vê as contagens só da unidade liberada, sem nome');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009b9')->'unidades') = 1
              AND NOT (public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009b9')->'unidades'->0->>'editavel')::boolean,
  'Secretaria vê o mapa de vagas só das liberadas, sem editar');
SELECT pg_temp.falha($$SELECT public.rede_regulacoes('21000000-0000-4000-8000-0000000009b9')$$, 'Acesso negado', 'Secretaria não vê a lista nominal');
SELECT pg_temp.falha($$SELECT public.rede_faturamento('21000000-0000-4000-8000-0000000009b9', '202610')$$, 'Acesso negado', 'Secretaria não vê o faturamento');

-- ── 6. Regulação regional: lista nominal e detalhe com acesso registrado ───
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok(jsonb_array_length(public.rede_regulacoes('21000000-0000-4000-8000-0000000009b9')) = 1
              AND (public.rede_regulacoes('21000000-0000-4000-8000-0000000009b9')->0->'paciente'->>'nome') = 'Paciente da Rede',
  'Regulação regional vê a lista nominal só das liberadas');
SELECT pg_temp.falha($$SELECT public.rede_regulacao_detalhe('21000000-0000-4000-8000-0000000009b9', '2a000000-0000-4000-8000-0000000009b2')$$,
  'Solicitação não encontrada', 'pedido de unidade retirada não abre');
SELECT pg_temp.ok((public.rede_regulacao_detalhe('21000000-0000-4000-8000-0000000009b9', '2a000000-0000-4000-8000-0000000009b1')->>'numero') IS NOT NULL,
  'Regulação regional abre o detalhe');
SELECT pg_temp.falha(format('SELECT public.regulacao_autorizar(%L, %L, %L)', '2a000000-0000-4000-8000-0000000009b1', 'rede', '21000000-0000-4000-8000-0000000009b2'),
  'Quem decide é o médico regulador', 'Regulação regional não decide (só leitura)');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE acessado_por = '10000000-0000-4000-8000-000000000005'
                            AND papel = 'regulacao_regional' AND paciente_id = '23000000-0000-4000-8000-0000000009b1'),
  'abrir o detalhe fica no registro de acesso ao prontuário');

-- ── 7. Faturamento da secretaria ────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(jsonb_array_length(public.rede_faturamento('21000000-0000-4000-8000-0000000009b9', '202610')) = 1
              AND (public.rede_faturamento('21000000-0000-4000-8000-0000000009b9', '202610')->0->'bpa'->>'linhas')::int = 3,
  'Faturamento da secretaria vê a produção da liberada');
SELECT pg_temp.ok((public.rede_baixar_arquivo('21000000-0000-4000-8000-0000000009b9', 'bpa', '2b000000-0000-4000-8000-0000000009b1')->>'conteudo') = 'CONTEUDO DO BPA DE TESTE',
  'baixa o arquivo fechado');
SELECT pg_temp.falha($$SELECT public.rede_regulacao_resumo('21000000-0000-4000-8000-0000000009b9')$$, 'Acesso negado', 'faturamento não vê a regulação');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'rede_arquivo_baixado' AND entidade_id = '2b000000-0000-4000-8000-0000000009b1'),
  'download na auditoria');

-- ── 8. módulo desligado fecha tudo ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.super_admin());
SELECT public.rede_definir_modulo('20000000-0000-4000-8000-0000000009b0', false, '21000000-0000-4000-8000-0000000009b9');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.rede_regulacao_resumo('21000000-0000-4000-8000-0000000009b9')$$,
  'O módulo de rede está desligado', 'módulo desligado: Secretaria não vê nada');

ROLLBACK;
