-- Internação do NIR pelo modelo do RT — migrations 20270425000030 e 031.
-- Cobre:
-- - NIR2: o NIR avisa o médico (pendência com dono médico): aviso ao médico
--   de plantão no setor, situação "médico avisado", histórico e auditoria;
--   reavisar soma o aviso; resolver grava autor e hora;
-- - quem não é da unidade e a enfermagem não criam nem leem;
-- - NIR3: a lista das pendências da unidade;
-- - NIR2: os médicos do setor; NIR4: o mapa de leitos com o internado;
-- - o NIR atualiza a evolução do pedido (autor = login, papel 'nir'), o
--   detalhe diz pode_evoluir e o papel, e as pendências de evolução abertas
--   ficam resolvidas; a enfermagem não atualiza.
-- As ids ficam na tabela t: o corpo do teste roda igual na homologação com
-- outra preparação.
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-000000000d30', 'Rede do NIR');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-000000000d30', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-000000000d30'::uuid, 'UPA do NIR', '7654630'),
               ('21000000-0000-4000-8000-000000000d39'::uuid, 'Central do NIR', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-000000000d30', '21000000-0000-4000-8000-000000000d39', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000d30', '21000000-0000-4000-8000-000000000d30', 'Observação do NIR', tipo
  FROM public.setores WHERE setores.id = '22000000-0000-4000-8000-000000000001';
-- UPA: 002 médico (de plantão no setor), 005 NIR, 001 gestor, 004 enfermeiro. Central: 006 regulador. 003: de fora.
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000d30', 'plantonista'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000d30', 'nir'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000d30', 'gestor'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000d30', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000d39', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-000000000d30', '21000000-0000-4000-8000-000000000d30', 'Paciente do NIR', '1970-01-01', 'N-30',
   '22000000-0000-4000-8000-000000000d30', 'F');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, fracionado) VALUES
  ('21000000-0000-4000-8000-000000000d30', '22000000-0000-4000-8000-000000000d30', '10000000-0000-4000-8000-000000000002',
   current_date, 'manha', now() - interval '10 minutes', 360, true),
  ('21000000-0000-4000-8000-000000000d30', '22000000-0000-4000-8000-000000000d30', '10000000-0000-4000-8000-000000000005',
   current_date, 'manha', now() - interval '10 minutes', 360, true);
SET LOCAL session_replication_role = replica;
INSERT INTO public.leitos (id, setor_id, identificador, tipo, status) VALUES
  ('24000000-0000-4000-8000-000000000d30', '22000000-0000-4000-8000-000000000d30', 'OBS-01', 'observacao', 'ocupado'),
  ('24000000-0000-4000-8000-000000000d31', '22000000-0000-4000-8000-000000000d30', 'OBS-02', 'observacao', 'livre');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, tipo_internacao, status, data_admissao, setor_atual_id, leito_atual_id) VALUES
  ('25000000-0000-4000-8000-000000000d30', '20000000-0000-4000-8000-000000000d30', '21000000-0000-4000-8000-000000000d30',
   '23000000-0000-4000-8000-000000000d30', 'urgencia', 'internado', now() - interval '6 hours', '22000000-0000-4000-8000-000000000d30',
   '24000000-0000-4000-8000-000000000d30');
SET LOCAL session_replication_role = origin;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t VALUES
  ('origem', '21000000-0000-4000-8000-000000000d30'), ('setor', '22000000-0000-4000-8000-000000000d30'),
  ('paciente', '23000000-0000-4000-8000-000000000d30'),
  ('medico', '10000000-0000-4000-8000-000000000002'), ('nir', '10000000-0000-4000-8000-000000000005'),
  ('gestor', '10000000-0000-4000-8000-000000000001'), ('enfermeiro', '10000000-0000-4000-8000-000000000004'),
  ('fora', '10000000-0000-4000-8000-000000000003');

CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.avisos(perfil text, prefixo text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.notificacoes_plantonista WHERE perfil_id = perfil::uuid AND tipo LIKE prefixo || '%'
                                                     AND created_at >= now() $$;
CREATE FUNCTION pg_temp.pend(p_id text) RETURNS public.regulacao_pendencias_unidade LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.regulacao_pendencias_unidade WHERE id = p_id::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text),
  pg_temp.avisos(text, text), pg_temp.pend(text) TO authenticated;

SET LOCAL ROLE authenticated;
-- o médico abre o pedido de leito
SELECT pg_temp.como(pg_temp.v('medico'));
INSERT INTO t SELECT 'pedido', (public.regulacao_solicitar(pg_temp.v('origem')::uuid, pg_temp.v('paciente')::uuid,
    '{"tipo":"leito","tipo_leito":"uti_adulto","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Quadro clínico do pedido do teste do NIR."}')->>'id');

-- ════ corpo do teste (igual na homologação) ═════════════════════════════════
-- ── 1. o NIR avisa o médico ─────────────────────────────────────────────────
SELECT pg_temp.como(pg_temp.v('nir'));
SELECT pg_temp.ok((public.nir_medicos_do_setor(pg_temp.v('origem')::uuid, pg_temp.v('setor')::uuid)->>'no_plantao')::boolean
              AND (public.nir_medicos_do_setor(pg_temp.v('origem')::uuid, pg_temp.v('setor')::uuid)->'medicos'->0->>'id') = pg_temp.v('medico'),
  'médicos do setor: o de plantão agora');
INSERT INTO t SELECT 'p1', public.regulacao_pendencia_unidade_criar(pg_temp.v('pedido')::uuid, 'evolucao',
  'Atualizar evolução clínica na regulação', 'alta');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('medico'), 'reg_nirmed_') = 1, 'aviso ao médico de plantão no setor');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('nir'), 'reg_nirmed_') = 0, 'o autor não se avisa');
SELECT pg_temp.ok((pg_temp.pend(pg_temp.v('p1'))).status = 'medico_avisado' AND (pg_temp.pend(pg_temp.v('p1'))).avisos = 1
              AND (pg_temp.pend(pg_temp.v('p1'))).criada_por = pg_temp.v('nir')::uuid
              AND (pg_temp.pend(pg_temp.v('p1'))).setor_id = pg_temp.v('setor')::uuid,
  'pendência: médico avisado, autor = login, setor do paciente');
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia_unidade_criar(%L, %L, %L)', pg_temp.v('pedido'), 'exame', 'ab'),
  'Escreva a pendência', 'pendência curta recusada');
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia_unidade_criar(%L, %L, %L, %L, ARRAY[%L]::uuid[])',
  pg_temp.v('pedido'), 'exame', 'Liberar exame pedido pela central', 'normal', pg_temp.v('enfermeiro')),
  'Escolha médicos desta unidade', 'só médicos da unidade');
-- pendência do próprio NIR (sem aviso)
INSERT INTO t SELECT 'p2', public.regulacao_pendencia_unidade_criar(pg_temp.v('pedido')::uuid, 'exame',
  'Anexar o ECG pedido pela central', 'normal', NULL, 'nir');
SELECT pg_temp.ok((pg_temp.pend(pg_temp.v('p2'))).status = 'pendente' AND (pg_temp.pend(pg_temp.v('p2'))).avisos = 0,
  'pendência do NIR fica pendente, sem aviso');

-- ── 2. quem não é da unidade e a enfermagem ────────────────────────────────
SELECT pg_temp.como(pg_temp.v('fora'));
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia_unidade_criar(%L, %L, %L)', pg_temp.v('pedido'), 'exame', 'Pendência de quem é de fora'),
  'Solicitação não encontrada', 'de fora não cria');
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencias_da_unidade(%L)', pg_temp.v('origem')), 'Acesso negado', 'de fora não lê');
SELECT pg_temp.falha(format('SELECT public.nir_mapa_leitos(%L)', pg_temp.v('origem')), 'Acesso negado', 'de fora não vê o mapa');
SELECT pg_temp.como(pg_temp.v('enfermeiro'));
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia_unidade_resolver(%L)', pg_temp.v('p2')), 'Acesso negado', 'enfermagem não resolve');
SELECT pg_temp.falha(format('SELECT public.regulacao_atualizar_evolucao(%L, %L)', pg_temp.v('pedido'), 'Evolução escrita pela enfermagem.'),
  'Atualizam a evolução', 'enfermagem não atualiza a evolução do pedido');
SELECT pg_temp.falha(format('SELECT * FROM public.regulacao_pendencias_unidade'), 'permission denied', 'sem leitura direta da tabela');

-- ── 3. lista, reaviso, resolver, médicos e mapa ─────────────────────────────
SELECT pg_temp.como(pg_temp.v('nir'));
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_pendencias_da_unidade(pg_temp.v('origem')::uuid)) = 2
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_pendencias_da_unidade(pg_temp.v('origem')::uuid)) x
                           WHERE x->>'id' = pg_temp.v('p1') AND x->>'leito' = 'OBS-01' AND x->'responsaveis'->0->>'id' = pg_temp.v('medico')),
  'lista da unidade com leito e responsável');
SELECT public.regulacao_pendencia_unidade_reavisar(pg_temp.v('p1')::uuid);
SELECT pg_temp.ok((pg_temp.pend(pg_temp.v('p1'))).avisos = 2, 'reaviso soma');
SELECT public.regulacao_pendencia_unidade_resolver(pg_temp.v('p2')::uuid, 'ECG anexado ao pedido');
SELECT pg_temp.ok((pg_temp.pend(pg_temp.v('p2'))).status = 'resolvida' AND (pg_temp.pend(pg_temp.v('p2'))).resolvida_por = pg_temp.v('nir')::uuid
              AND (pg_temp.pend(pg_temp.v('p2'))).resolvida_em IS NOT NULL,
  'resolvida com autor e hora');
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia_unidade_resolver(%L)', pg_temp.v('p2')), 'Esta pendência já foi resolvida', 'não resolve duas vezes');
INSERT INTO t SELECT 'mapa', public.nir_mapa_leitos(pg_temp.v('origem')::uuid)::text;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('mapa')::jsonb->'setores') s, jsonb_array_elements(s->'leitos') l
                           WHERE s->>'id' = pg_temp.v('setor') AND l->>'identificador' = 'OBS-01' AND l->>'paciente_id' = pg_temp.v('paciente'))
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('mapa')::jsonb->'setores') s, jsonb_array_elements(s->'leitos') l
                           WHERE l->>'identificador' = 'OBS-02' AND l->>'paciente_id' IS NULL)
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('mapa')::jsonb->'internados') i
                           WHERE i->>'paciente_id' = pg_temp.v('paciente') AND i->>'sexo' = 'F'),
  'mapa: leito ocupado com o paciente, leito livre, internado com sexo');

-- ── 4. o NIR atualiza a evolução do pedido ──────────────────────────────────
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.v('pedido')::uuid)->>'pode_evoluir')::boolean, 'NIR pode evoluir o pedido');
SELECT public.regulacao_atualizar_evolucao(pg_temp.v('pedido')::uuid, 'Paciente estável, aguardando vaga. Sem droga vasoativa.');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.v('pedido')::uuid)->'evolucoes'->0->>'papel') = 'nir', 'evolução com o papel do NIR');
SELECT pg_temp.ok((pg_temp.pend(pg_temp.v('p1'))).status = 'resolvida' AND (pg_temp.pend(pg_temp.v('p1'))).resolvida_por = pg_temp.v('nir')::uuid,
  'pendência de evolução resolvida ao salvar');
SELECT pg_temp.como(pg_temp.v('medico'));
SELECT public.regulacao_atualizar_evolucao(pg_temp.v('pedido')::uuid, 'Reavaliado: mantém necessidade de UTI.');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.v('pedido')::uuid)->'evolucoes') e WHERE e->>'papel' = 'medico')
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.v('pedido')::uuid)->'evolucoes') e WHERE e->>'papel' = 'nir'),
  'evolução do médico com o papel médico, a do NIR com o do NIR');
RESET ROLE;
SELECT pg_temp.ok((SELECT bool_and(autor_id = pg_temp.v('nir')::uuid) FROM public.regulacao_evolucoes
                    WHERE solicitacao_id = pg_temp.v('pedido')::uuid AND autor_papel = 'nir'), 'autor da evolução = login do NIR');
SELECT pg_temp.ok((SELECT count(*) FROM public.regulacao_eventos WHERE solicitacao_id = pg_temp.v('pedido')::uuid AND evento LIKE 'pendencia_unidade%') >= 4
              AND (SELECT count(*) FROM public.log_auditoria WHERE acao = 'regulacao_pendencia_unidade') >= 4,
  'pendências no histórico do pedido e na auditoria');

ROLLBACK;
