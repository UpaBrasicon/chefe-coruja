-- Regulação dentro do paciente, NIR e cobrança — migration 20270421000040.
-- Cobre:
-- - conversa por pedido: o regulador pergunta (aviso ao médico e ao NIR
--   escalados no dia na origem), o NIR responde (aviso ao regulador); autor e
--   lado pelo login; histórico e auditoria; só inserção;
-- - quem não vê o pedido não lê nem escreve; enfermagem não escreve;
-- - lista de pacientes da unidade com o aviso de mensagem nova e o que o
--   regulador espera; a aba do paciente;
-- - a pendência formal também avisa os escalados no dia;
-- - a cobrança do NIR avisa o responsável e o médico e o NIR escalados no dia.
-- As ids ficam na tabela t: o corpo do teste roda igual na homologação com
-- outra preparação.
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-000000000c40', 'Rede da conversa');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-000000000c40', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-000000000c40'::uuid, 'UPA da conversa', '7654601'),
               ('21000000-0000-4000-8000-000000000c49'::uuid, 'Central da conversa', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-000000000c40', '21000000-0000-4000-8000-000000000c49', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000c40', '21000000-0000-4000-8000-000000000c40', 'Sala amarela', tipo
  FROM public.setores WHERE setores.id = '22000000-0000-4000-8000-000000000001';
-- UPA: 002 médico (solicitante), 005 NIR, 001 gestor, 004 enfermeiro. Central: 006 regulador. 003: de fora.
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000c40', 'plantonista'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000c40', 'nir'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000c40', 'gestor'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000c40', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000c49', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-000000000c40', '21000000-0000-4000-8000-000000000c40', 'Paciente da conversa', '1970-01-01', 'C-40',
   '22000000-0000-4000-8000-000000000c40', 'M');
-- o NIR escalado hoje (fim do dia), o médico não
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, fracionado) VALUES
  ('21000000-0000-4000-8000-000000000c40', '22000000-0000-4000-8000-000000000c40', '10000000-0000-4000-8000-000000000005',
   current_date, 'manha', now() - interval '10 minutes', 360, true);
SET LOCAL session_replication_role = replica;
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, tipo_internacao, status, data_admissao, setor_atual_id) VALUES
  ('25000000-0000-4000-8000-000000000c40', '20000000-0000-4000-8000-000000000c40', '21000000-0000-4000-8000-000000000c40',
   '23000000-0000-4000-8000-000000000c40', 'urgencia', 'internado', now() - interval '6 hours', '22000000-0000-4000-8000-000000000c40');
SET LOCAL session_replication_role = origin;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t VALUES
  ('origem', '21000000-0000-4000-8000-000000000c40'), ('central', '21000000-0000-4000-8000-000000000c49'),
  ('paciente', '23000000-0000-4000-8000-000000000c40'), ('internacao', '25000000-0000-4000-8000-000000000c40'),
  ('internacao_cobranca', '25000000-0000-4000-8000-000000000c40'),
  ('medico', '10000000-0000-4000-8000-000000000002'), ('nir', '10000000-0000-4000-8000-000000000005'),
  ('gestor', '10000000-0000-4000-8000-000000000001'), ('enfermeiro', '10000000-0000-4000-8000-000000000004'),
  ('regulador', '10000000-0000-4000-8000-000000000006'), ('fora', '10000000-0000-4000-8000-000000000003');

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
-- o pedido do paciente na lista da unidade
CREATE FUNCTION pg_temp.pedido_na_lista(lista jsonb, pedido text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT p FROM jsonb_array_elements(lista) l, jsonb_array_elements(l->'pedidos') p WHERE p->>'id' = pedido LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text),
  pg_temp.avisos(text, text), pg_temp.pedido_na_lista(jsonb, text) TO authenticated;

SET LOCAL ROLE authenticated;
-- o médico abre o pedido de leito
SELECT pg_temp.como(pg_temp.v('medico'));
INSERT INTO t SELECT 'pedido', (public.regulacao_solicitar(pg_temp.v('origem')::uuid, pg_temp.v('paciente')::uuid,
    '{"tipo":"leito","tipo_leito":"uti_adulto","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Quadro clínico do pedido da conversa com a central."}')->>'id');

-- ════ corpo do teste (igual na homologação) ═════════════════════════════════
-- ── 1. o regulador pergunta ─────────────────────────────────────────────────
SELECT pg_temp.como(pg_temp.v('regulador'));
SELECT pg_temp.ok((public.regulacao_conversa(pg_temp.v('pedido')::uuid)->>'meu_lado') = 'central', 'regulador escreve pela central');
INSERT INTO t SELECT 'm1', public.regulacao_conversa_enviar(pg_temp.v('pedido')::uuid, 'Tem troponina seriada? Anexe o ECG mais recente.', 'pedido');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('medico'), 'reg_conversa_') = 1, 'aviso ao médico solicitante');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('nir'), 'reg_conversa_') = 1, 'aviso ao NIR escalado no dia');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('regulador'), 'reg_conversa_') = 0, 'o autor não se avisa');
SELECT pg_temp.falha(format('SELECT public.regulacao_conversa_enviar(%L, %L)', pg_temp.v('pedido'), ' '),
  'Escreva a mensagem', 'mensagem vazia recusada');

-- ── 2. quem não vê o pedido ─────────────────────────────────────────────────
SELECT pg_temp.como(pg_temp.v('fora'));
SELECT pg_temp.falha(format('SELECT public.regulacao_conversa(%L)', pg_temp.v('pedido')), 'Solicitação não encontrada', 'de fora não lê a conversa');
SELECT pg_temp.falha(format('SELECT public.regulacao_conversa_enviar(%L, %L)', pg_temp.v('pedido'), 'Mensagem de quem é de fora.'),
  'Solicitação não encontrada', 'de fora não escreve');
SELECT pg_temp.falha(format('SELECT public.regulacao_pacientes(%L)', pg_temp.v('origem')), 'Acesso negado', 'de fora não vê a lista da unidade');
SELECT pg_temp.falha(format('SELECT public.regulacao_do_paciente(%L, %L)', pg_temp.v('origem'), pg_temp.v('paciente')), 'Acesso negado', 'de fora não vê a aba');
SELECT pg_temp.como(pg_temp.v('enfermeiro'));
SELECT pg_temp.falha(format('SELECT public.regulacao_conversa_enviar(%L, %L)', pg_temp.v('pedido'), 'Mensagem da enfermagem.'),
  'Solicitação não encontrada', 'enfermagem não escreve na conversa');
SELECT pg_temp.falha(format('SELECT public.regulacao_pacientes(%L)', pg_temp.v('origem')), 'Acesso negado', 'enfermagem não vê a lista');

-- ── 3. o NIR vê a lista, lê e responde ──────────────────────────────────────
SELECT pg_temp.como(pg_temp.v('nir'));
INSERT INTO t SELECT 'lista', public.regulacao_pacientes(pg_temp.v('origem')::uuid)::text;
SELECT pg_temp.ok((pg_temp.pedido_na_lista(pg_temp.v('lista')::jsonb, pg_temp.v('pedido'))->'conversa'->>'novas')::int = 1
              AND jsonb_array_length(pg_temp.pedido_na_lista(pg_temp.v('lista')::jsonb, pg_temp.v('pedido'))->'conversa'->'aguardando') = 1,
  'lista: mensagem nova e o que o regulador espera');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('lista')::jsonb) l
                           WHERE l->'paciente'->>'id' = pg_temp.v('paciente') AND l->'internacao'->>'id' = pg_temp.v('internacao')
                             AND l->'setor'->>'nome' IS NOT NULL),
  'lista: o internado com o setor');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_conversa(pg_temp.v('pedido')::uuid)->'mensagens') = 1, 'NIR lê a conversa');
SELECT pg_temp.ok((pg_temp.pedido_na_lista(public.regulacao_pacientes(pg_temp.v('origem')::uuid), pg_temp.v('pedido'))->'conversa'->>'novas')::int = 0,
  'depois de ler, sem mensagem nova');
SELECT public.regulacao_conversa_enviar(pg_temp.v('pedido')::uuid, 'ECG anexado. Troponina em curva, segunda coleta às 14 h.', 'pergunta');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('regulador'), 'reg_conversa_') = 1, 'aviso ao regulador da central');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.pedido_na_lista(public.regulacao_pacientes(pg_temp.v('origem')::uuid), pg_temp.v('pedido'))->'conversa'->'aguardando') = 0,
  'respondido: nada mais esperando a origem');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_do_paciente(pg_temp.v('origem')::uuid, pg_temp.v('paciente')::uuid)->'pedidos') = 1,
  'aba do paciente: o pedido da unidade');
SELECT pg_temp.como(pg_temp.v('gestor'));
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_pacientes(pg_temp.v('origem')::uuid)) >= 1, 'gestor vê a lista da unidade');
RESET ROLE;
SELECT pg_temp.ok((SELECT lado = 'origem' AND intencao = 'mensagem' AND autor_id = pg_temp.v('nir')::uuid
                     FROM public.regulacao_mensagens WHERE solicitacao_id = pg_temp.v('pedido')::uuid AND autor_id = pg_temp.v('nir')::uuid),
  'origem só manda mensagem; o autor é o login');
SELECT pg_temp.ok((SELECT count(*) FROM public.regulacao_eventos WHERE solicitacao_id = pg_temp.v('pedido')::uuid AND evento = 'mensagem') = 2
              AND (SELECT count(*) FROM public.log_auditoria WHERE acao = 'regulacao_mensagem' AND entidade_id IN
                     (SELECT id FROM public.regulacao_mensagens WHERE solicitacao_id = pg_temp.v('pedido')::uuid)) = 2,
  'mensagens no histórico do pedido e na auditoria');
SELECT pg_temp.falha(format('UPDATE public.regulacao_mensagens SET texto = %L WHERE id = %L', 'texto trocado', pg_temp.v('m1')),
  '', 'mensagem não se altera');
SET LOCAL ROLE authenticated;

-- ── 4. a pendência formal avisa também os escalados no dia ─────────────────
SELECT pg_temp.como(pg_temp.v('regulador'));
SELECT public.regulacao_pendencia(pg_temp.v('pedido')::uuid, 'Qual a função renal atual do paciente?');
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('nir'), 'reg_pendencia_') = 1 AND pg_temp.avisos(pg_temp.v('medico'), 'reg_pendencia_') = 1,
  'pendência avisa o médico e o NIR escalado');

-- ── 5. cobrança: o responsável e os escalados no dia ───────────────────────
SELECT pg_temp.como(pg_temp.v('gestor'));
SELECT public.nir_cobrar(pg_temp.v('origem')::uuid, 'aih_sem_aih', pg_temp.v('internacao_cobranca')::uuid);
SELECT pg_temp.ok(pg_temp.avisos(pg_temp.v('nir'), 'nir_aih_') = 1 AND pg_temp.avisos(pg_temp.v('medico'), 'nir_aih_') = 1,
  'cobrança avisa o médico e o NIR escalado no dia');
RESET ROLE;

ROLLBACK;
