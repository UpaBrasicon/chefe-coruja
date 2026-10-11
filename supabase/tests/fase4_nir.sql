-- Fase 4, tarefa 11 — migrations 20261117000001/2 (NIR). Cobre:
-- - o NIR abre pedido só com o médico assistente; não evolui, não corrige o
--   devolvido, não cancela; anexa, responde pendência e marca saída;
-- - no destino, o NIR não aceita nem recusa, mas marca a chegada;
-- - painel de pendências (AIH, APAC, regulação) com o responsável e o tempo
--   parado; só NIR no plantão e gestor; "Cobrar" avisa e fica registrado.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009e5', 'Rede do NIR');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009e5', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009e5'::uuid, 'UPA do NIR', '7654563'),
               ('21000000-0000-4000-8000-0000000009e6'::uuid, 'Hospital do NIR', '7654571'),
               ('21000000-0000-4000-8000-0000000009e7'::uuid, 'Central do NIR', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009e5', '21000000-0000-4000-8000-0000000009e7', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT x.id, x.un, x.nome, tipo
  FROM public.setores, (VALUES ('22000000-0000-4000-8000-0000000009e5'::uuid, '21000000-0000-4000-8000-0000000009e5'::uuid, 'Porta'),
                               ('22000000-0000-4000-8000-0000000009e6'::uuid, '21000000-0000-4000-8000-0000000009e6'::uuid, 'Enfermaria')) x(id, un, nome)
 WHERE setores.id = '22000000-0000-4000-8000-000000000001';
-- UPA: 002 médico, 005 NIR, 001 gestor, 004 enfermeiro, 006 regulador da unidade (AIH/APAC)
-- Hospital: 003 médico, 004 NIR. Central: 006 regulador
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009e5', 'plantonista'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-0000000009e5', 'nir'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009e5', 'gestor'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009e5', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009e5', 'regulador'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-0000000009e6', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009e6', 'nir'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009e7', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
SELECT ('23000000-0000-4000-8000-0000000009e' || n)::uuid, '21000000-0000-4000-8000-0000000009e5', 'Paciente NIR ' || n,
       '1970-01-01', 'N-' || n, '22000000-0000-4000-8000-0000000009e5', 'M'
  FROM generate_series(1, 3) n;
INSERT INTO public.leitos (id, setor_id, identificador, status) VALUES ('24000000-0000-4000-8000-0000000009e6', '22000000-0000-4000-8000-0000000009e6', 'ENF-1', 'livre');
-- NIR no plantão agora (UPA e hospital)
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, fracionado) VALUES
  ('21000000-0000-4000-8000-0000000009e5', '22000000-0000-4000-8000-0000000009e5', '10000000-0000-4000-8000-000000000005', current_date, 'manha', now() - interval '10 minutes', 360, true),
  ('21000000-0000-4000-8000-0000000009e6', '22000000-0000-4000-8000-0000000009e6', '10000000-0000-4000-8000-000000000004', current_date, 'manha', now() - interval '10 minutes', 360, true);

-- AIH e APAC paradas (gravadas direto, sem os gatilhos do ciclo)
SET LOCAL session_replication_role = replica;
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, tipo_internacao, status, data_admissao, setor_atual_id) VALUES
  ('25000000-0000-4000-8000-0000000009e1', '20000000-0000-4000-8000-0000000009e5', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e1', 'urgencia', 'internado', now() - interval '30 hours', '22000000-0000-4000-8000-0000000009e5'),
  ('25000000-0000-4000-8000-0000000009e2', '20000000-0000-4000-8000-0000000009e5', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e2', 'observacao', 'em_observacao', now() - interval '5 hours', '22000000-0000-4000-8000-0000000009e5'),
  ('25000000-0000-4000-8000-0000000009e3', '20000000-0000-4000-8000-0000000009e5', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e3', 'urgencia', 'internado', now() - interval '50 hours', '22000000-0000-4000-8000-0000000009e5');
INSERT INTO public.aihs (id, unidade_id, paciente_id, internacao_id, laudo_raiz_id, laudo_id, status, solicitada_por, solicitada_em, decidida_em, motivo) VALUES
  ('26000000-0000-4000-8000-0000000009e3', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e3', '25000000-0000-4000-8000-0000000009e3',
   gen_random_uuid(), gen_random_uuid(), 'rejeitada', '10000000-0000-4000-8000-000000000002', now() - interval '40 hours', now() - interval '20 hours', 'CID incompatível'),
  ('26000000-0000-4000-8000-0000000009e4', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e2', NULL,
   gen_random_uuid(), gen_random_uuid(), 'solicitada', '10000000-0000-4000-8000-000000000002', now() - interval '3 hours', NULL, NULL);
INSERT INTO public.apacs (id, unidade_id, paciente_id, procedimento, cid_principal, carater, status, solicitada_por, solicitada_em, decidida_em) VALUES
  ('27000000-0000-4000-8000-0000000009e1', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e1', '0303060190', 'I21.9', '01', 'solicitada', '10000000-0000-4000-8000-000000000002', now() - interval '2 hours', NULL),
  ('27000000-0000-4000-8000-0000000009e2', '21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e2', '0303060190', 'I21.9', '01', 'rejeitada', '10000000-0000-4000-8000-000000000002', now() - interval '9 hours', now() - interval '8 hours');
SET LOCAL session_replication_role = origin;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
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
CREATE FUNCTION pg_temp.campo(i text, c text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT to_jsonb(s)->>c FROM public.regulacao_solicitacoes s WHERE s.id = i::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.campo(text, text) TO authenticated;
CREATE FUNCTION pg_temp.avisos(perfil text, prefixo text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.notificacoes_plantonista WHERE perfil_id = perfil::uuid AND tipo LIKE prefixo || '%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.avisos(text, text) TO authenticated;
CREATE FUNCTION pg_temp.item(m jsonb, tipo text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT i FROM jsonb_array_elements(m->'itens') i WHERE i->>'tipo' = tipo LIMIT 1 $$;

SET LOCAL ROLE authenticated;
-- ── 1. o NIR abre o pedido com o médico assistente ──────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok((public.regulacao_contexto('21000000-0000-4000-8000-0000000009e5')->>'pode_solicitar')::boolean
              AND (public.regulacao_contexto('21000000-0000-4000-8000-0000000009e5')->>'sou_nir')::boolean, 'NIR pode solicitar');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e1',
    '{"tipo":"leito","tipo_leito":"uti_adulto","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Quadro clínico do pedido aberto pelo NIR."}')$$,
  'O NIR abre o pedido com o médico assistente', 'NIR sem médico assistente: recusado');
INSERT INTO t SELECT 'p1', (public.regulacao_solicitar('21000000-0000-4000-8000-0000000009e5', '23000000-0000-4000-8000-0000000009e1',
    '{"tipo":"leito","tipo_leito":"uti_adulto","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Quadro clínico do pedido aberto pelo NIR.","medico_assistente_id":"10000000-0000-4000-8000-000000000002"}')->>'id');
SELECT pg_temp.ok(pg_temp.campo(pg_temp.v('p1'), 'solicitante_papel') = 'nir'
              AND pg_temp.campo(pg_temp.v('p1'), 'medico_assistente_id') = '10000000-0000-4000-8000-000000000002',
  'pedido aberto como NIR, com o médico assistente');
SELECT pg_temp.falha(format('SELECT public.regulacao_atualizar_evolucao(%L, %L)', pg_temp.v('p1'), 'Paciente estável, sem droga vasoativa.'),
  'Atualizam a evolução', 'NIR não atualiza a evolução clínica');
SELECT pg_temp.falha(format('SELECT public.regulacao_cancelar(%L, %L)', pg_temp.v('p1'), 'Motivo do cancelamento do teste.'),
  'Cancela quem solicitou', 'NIR não cancela');
SELECT pg_temp.ok((public.regulacao_anexos(pg_temp.v('p1')::uuid)->>'pode_anexar')::boolean, 'NIR anexa documentos');

-- pendência: o NIR responde
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_pendencia(pg_temp.v('p1')::uuid, 'Qual a hora da última troponina?');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.regulacao_responder_pendencia(pg_temp.v('p1')::uuid, 'Troponina colhida às 10h, resultado em anexo.');
SELECT pg_temp.ok(pg_temp.campo(pg_temp.v('p1'), 'status') = 'em_analise', 'NIR responde a pendência');

-- ── 2. destino: o NIR não aceita, mas marca saída (origem) e chegada (destino)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_autorizar(pg_temp.v('p1')::uuid, 'rede', '21000000-0000-4000-8000-0000000009e6');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_destino_lista('21000000-0000-4000-8000-0000000009e6')) = 1, 'NIR do destino vê o recebido');
SELECT pg_temp.falha(format('SELECT public.regulacao_destino_aceitar(%L)', pg_temp.v('p1')),
  'Responde pelo destino o médico plantonista ou o gestor', 'NIR do destino não aceita');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.regulacao_destino_aceitar(pg_temp.v('p1')::uuid, '24000000-0000-4000-8000-0000000009e6', NULL);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.regulacao_marcar_saida(pg_temp.v('p1')::uuid);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.regulacao_marcar_chegada(pg_temp.v('p1')::uuid, true);
SELECT pg_temp.ok(pg_temp.campo(pg_temp.v('p1'), 'status') = 'realizada', 'NIR marca saída na origem e chegada no destino');

-- ── 3. painel de pendências ─────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'painel', public.nir_pendencias('21000000-0000-4000-8000-0000000009e5')::text;
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('painel')::jsonb, 'aih_sem_aih')->>'ref_id') = '25000000-0000-4000-8000-0000000009e1'
              AND (SELECT count(*) FROM jsonb_array_elements(pg_temp.v('painel')::jsonb->'itens') i WHERE i->>'tipo' = 'aih_sem_aih') = 1,
  'internação sem AIH aparece; a observação e a que já tem AIH não');
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('painel')::jsonb, 'aih_sem_decisao')->>'responsavel') = 'Médico regulador da unidade'
              AND (pg_temp.item(pg_temp.v('painel')::jsonb, 'aih_rejeitada')->>'titulo') LIKE '%CID incompatível%'
              AND pg_temp.item(pg_temp.v('painel')::jsonb, 'apac_sem_decisao') IS NOT NULL
              AND pg_temp.item(pg_temp.v('painel')::jsonb, 'apac_rejeitada') IS NOT NULL,
  'AIH sem decisão e rejeitada, APAC sem decisão e rejeitada, com o responsável');
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('painel')::jsonb, 'aih_rejeitada')->>'parado_seg')::bigint >= 20 * 3600
              AND (pg_temp.v('painel')::jsonb->'resumo'->>'aih')::int = 3,
  'tempo parado e resumo por assunto');

-- ── 4. cobrar ───────────────────────────────────────────────────────────────
SELECT pg_temp.ok(public.nir_cobrar('21000000-0000-4000-8000-0000000009e5', 'aih_sem_decisao', '26000000-0000-4000-8000-0000000009e4') = 1
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'nir_aih_') = 1,
  'cobrar avisa o regulador da unidade');
SELECT public.nir_cobrar('21000000-0000-4000-8000-0000000009e5', 'aih_rejeitada', '26000000-0000-4000-8000-0000000009e3');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'nir_aih_') = 1, 'AIH rejeitada: cobra quem solicitou');
SELECT pg_temp.ok((pg_temp.item(public.nir_pendencias('21000000-0000-4000-8000-0000000009e5'), 'aih_sem_decisao')->'ultima_cobranca'->>'por') IS NOT NULL,
  'a última cobrança aparece no painel');
SELECT pg_temp.falha($$SELECT public.nir_cobrar('21000000-0000-4000-8000-0000000009e5', 'aih_sem_decisao', '26000000-0000-4000-8000-0000000009e3')$$,
  'Esta pendência não está mais em aberto', 'não se cobra o que não está pendente');

-- ── 5. quem vê ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok(jsonb_array_length(public.nir_pendencias('21000000-0000-4000-8000-0000000009e5')->'itens') >= 5, 'gestor vê o painel sem escala');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.nir_pendencias('21000000-0000-4000-8000-0000000009e5')$$, 'Acesso negado', 'enfermagem não vê o painel do NIR');
RESET ROLE;
UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = '10000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.nir_pendencias('21000000-0000-4000-8000-0000000009e5')$$, 'Fora do plantão', 'NIR fora do plantão não vê');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.nir_cobrancas WHERE unidade_id = '21000000-0000-4000-8000-0000000009e5') = 2
              AND (SELECT count(*) FROM public.log_auditoria WHERE acao = 'nir_cobranca' AND unidade_id = '21000000-0000-4000-8000-0000000009e5') = 2,
  'cobranças registradas e auditadas');

ROLLBACK;
