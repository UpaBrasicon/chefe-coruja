-- Testes da migration 20261202000001_conta_documentos_sus.sql (Fase 5B, tarefa 4):
-- a conta da internação mostra todas as AIHs (a que vale marcada); a APAC vai na
-- conta a que está ligada; situação, número, competência/validade e arquivo do
-- mês da APAC; avisos sem travar o fechamento. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'faturamento') ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000d4201', '21000000-0000-4000-8000-000000000001', 'Paciente Documentos', '1965-05-05', 'DS-1',
   '22000000-0000-4000-8000-000000000003', 'M');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
VALUES ('25000000-0000-4000-8000-0000000d4201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'Dispneia', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours',
        '10000000-0000-4000-8000-000000000002', now() - interval '150 minutes');

CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.doc(p_conta uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.conta_detalhe(p_conta) -> 'documentos_sus' $$;
GRANT EXECUTE ON FUNCTION pg_temp.doc(uuid) TO authenticated;
INSERT INTO t SELECT 'porta', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-0000000d4201';
INSERT INTO t VALUES ('c1', to_char(private.data_atual() - interval '2 months', 'YYYYMM')), ('c2', to_char(private.data_atual() - interval '1 month', 'YYYYMM')),
                     ('c3', to_char(private.data_atual(), 'YYYYMM'));

-- APAC da porta: uma autorizada, com execução em três competências (uma no
-- arquivo, uma fora dele por crítica, uma ainda aberta); outra só solicitada
INSERT INTO public.apacs (id, unidade_id, paciente_id, episodio_id, tipo, procedimento, cid_principal, carater, status, numero,
                         validade_inicio, validade_fim, solicitada_por, solicitada_em)
VALUES ('2c000000-0000-4000-8000-0000000d4201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201',
        '25000000-0000-4000-8000-0000000d4201', '1', '0204030153', 'J44.9', '01', 'autorizada', '3526100000011',
        private.data_atual() - 70, private.data_atual() + 20, '10000000-0000-4000-8000-000000000002', now() - interval '140 minutes'),
       ('2c000000-0000-4000-8000-0000000d4202', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201',
        '25000000-0000-4000-8000-0000000d4201', '1', '0204030153', 'J44.9', '01', 'solicitada', NULL,
        NULL, NULL, '10000000-0000-4000-8000-000000000002', now() - interval '130 minutes');
INSERT INTO public.apac_execucoes (apac_id, unidade_id, competencia, tipo_atendimento, motivo_saida, executante_id, procedimentos, registrado_por)
SELECT '2c000000-0000-4000-8000-0000000d4201', '21000000-0000-4000-8000-000000000001', v, '01', '21',
       '10000000-0000-4000-8000-000000000002', '[]', '10000000-0000-4000-8000-000000000005'
  FROM t WHERE k IN ('c1', 'c2', 'c3');
INSERT INTO public.apac_fechamentos (unidade_id, competencia, apacs, controle, arquivo, excluidas, fechado_por)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, (SELECT v FROM t WHERE k = 'c1'), 1, 1111, 'x', '[]'::jsonb, '10000000-0000-4000-8000-000000000005'::uuid
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001', (SELECT v FROM t WHERE k = 'c2'), 0, 1111, 'x',
       '[{"numero": "3526100000011", "paciente": "Paciente Documentos", "criticas": []}]', '10000000-0000-4000-8000-000000000005';

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := pg_temp.doc(pg_temp.u('porta')); a jsonb; comp jsonb;
BEGIN
  IF jsonb_array_length(d -> 'aihs') <> 0 THEN RAISE EXCEPTION 'FALHOU: AIH na conta da porta'; END IF;
  IF jsonb_array_length(d -> 'apacs') <> 2 THEN RAISE EXCEPTION 'FALHOU: APACs da porta: %', d -> 'apacs'; END IF;
  SELECT x INTO a FROM jsonb_array_elements(d -> 'apacs') x WHERE x ->> 'status' = 'autorizada';
  IF a ->> 'numero' <> '3526100000011' OR a ->> 'validade_fim' IS NULL THEN RAISE EXCEPTION 'FALHOU: dados da APAC: %', a; END IF;
  comp := a -> 'competencias';
  IF jsonb_array_length(comp) <> 3
     OR NOT (comp -> 0 ->> 'fechada')::boolean OR (comp -> 0 ->> 'fora_do_arquivo')::boolean
     OR NOT (comp -> 1 ->> 'fechada')::boolean OR NOT (comp -> 1 ->> 'fora_do_arquivo')::boolean
     OR (comp -> 2 ->> 'fechada')::boolean THEN
    RAISE EXCEPTION 'FALHOU: competências da APAC: %', comp;
  END IF;
  IF d -> 'avisos' <> '["APAC ainda não autorizada."]'::jsonb THEN RAISE EXCEPTION 'FALHOU: avisos da porta: %', d -> 'avisos'; END IF;
  RAISE NOTICE 'OK  2a/3a: APAC na conta da porta, com validade e arquivo do mês por competência; APAC solicitada avisa';
END $$;
RESET ROLE;

-- internação a partir do atendimento, ainda sem AIH
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, internado_em, episodio_id)
VALUES ('26000000-0000-4000-8000-0000000d4201', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
        '23000000-0000-4000-8000-0000000d4201', 'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 hour', now() - interval '1 hour',
        '25000000-0000-4000-8000-0000000d4201');
INSERT INTO t SELECT 'int', id::text FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000d4201';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF pg_temp.doc(pg_temp.u('int')) -> 'avisos' <> '["Internação sem AIH solicitada."]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: internação sem AIH: %', pg_temp.doc(pg_temp.u('int'));
  END IF;
  RAISE NOTICE 'OK  4a: internação sem AIH avisa';
END $$;
RESET ROLE;

-- AIH pedida ainda na porta (sem internação) e rejeitada: vai para a conta da internação
INSERT INTO public.documentos_clinicos (id, documento_raiz_id, organizacao_id, unidade_id, paciente_id, tipo_documento, conteudo, conteudo_hash, autor_id)
VALUES ('27000000-0000-4000-8000-0000000d4201', '27000000-0000-4000-8000-0000000d4201', '20000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201', 'atestado',
        '{"aih":{"procCod":"03.03.14.015-1","cid":"J18.9"}}', 'teste', '10000000-0000-4000-8000-000000000002');
INSERT INTO public.aihs (id, unidade_id, paciente_id, internacao_id, episodio_id, laudo_raiz_id, laudo_id, solicitada_por, solicitada_em, status, motivo, criticas)
VALUES ('28000000-0000-4000-8000-0000000d4201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201', NULL,
        '25000000-0000-4000-8000-0000000d4201', '27000000-0000-4000-8000-0000000d4201', '27000000-0000-4000-8000-0000000d4201',
        '10000000-0000-4000-8000-000000000002', now() - interval '100 minutes', 'rejeitada', 'laudo sem exame que justifique', '[]');
-- APAC ligada à internação
INSERT INTO public.apacs (unidade_id, paciente_id, episodio_id, internacao_id, tipo, procedimento, cid_principal, carater, status, solicitada_por)
VALUES ('21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201', '25000000-0000-4000-8000-0000000d4201',
        '26000000-0000-4000-8000-0000000d4201', '1', '0204030153', 'J44.9', '01', 'rejeitada', '10000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := pg_temp.doc(pg_temp.u('int')); p jsonb := pg_temp.doc(pg_temp.u('porta'));
BEGIN
  IF jsonb_array_length(d -> 'aihs') <> 1 OR d -> 'aihs' -> 0 ->> 'status' <> 'rejeitada' OR (d -> 'aihs' -> 0 ->> 'vigente')::boolean
     OR d -> 'aihs' -> 0 ->> 'motivo' <> 'laudo sem exame que justifique' OR d -> 'aihs' -> 0 ->> 'procedimento' <> '0303140151' THEN
    RAISE EXCEPTION 'FALHOU: AIH rejeitada pedida na porta: %', d -> 'aihs';
  END IF;
  IF d -> 'avisos' <> '["A AIH desta internação foi rejeitada ou cancelada e não há outra solicitada."]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: aviso da AIH rejeitada: %', d -> 'avisos';
  END IF;
  IF jsonb_array_length(d -> 'apacs') <> 1 OR jsonb_array_length(p -> 'apacs') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: APAC da internação deveria ir só na conta da internação';
  END IF;
  RAISE NOTICE 'OK  1a/2a: AIH pedida na porta vai para a internação; rejeitada fica como histórico; APAC na conta a que está ligada';
END $$;
RESET ROLE;

-- nova AIH, também pedida pelo episódio: solicitada avisa e dá o procedimento principal; aprovada não avisa e é a que vale
INSERT INTO public.aihs (id, unidade_id, paciente_id, internacao_id, episodio_id, laudo_raiz_id, laudo_id, solicitada_por, solicitada_em, criticas)
VALUES ('28000000-0000-4000-8000-0000000d4202', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d4201',
        NULL, '25000000-0000-4000-8000-0000000d4201', '27000000-0000-4000-8000-0000000d4201',
        '27000000-0000-4000-8000-0000000d4201', '10000000-0000-4000-8000-000000000002', now() - interval '30 minutes', '[]');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF pg_temp.doc(pg_temp.u('int')) -> 'avisos' <> '["AIH ainda não aprovada pelo regulador."]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: AIH solicitada: %', pg_temp.doc(pg_temp.u('int')) -> 'avisos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.conta_detalhe(pg_temp.u('int')) -> 'itens') x
                  WHERE x ->> 'origem' = 'aih' AND x ->> 'origem_id' = '28000000-0000-4000-8000-0000000d4202') THEN
    RAISE EXCEPTION 'FALHOU: AIH pedida pelo episódio não dá o procedimento principal';
  END IF;
  RAISE NOTICE 'OK  5a: AIH ainda solicitada avisa; AIH pedida pelo episódio dá o procedimento principal';
END $$;
RESET ROLE;
UPDATE public.aihs SET status = 'aprovada', numero = '3526112345678', competencia = (SELECT v FROM t WHERE k = 'c3'), decidida_em = now()
 WHERE id = '28000000-0000-4000-8000-0000000d4202';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE d jsonb := pg_temp.doc(pg_temp.u('int'));
BEGIN
  IF jsonb_array_length(d -> 'avisos') <> 0 THEN RAISE EXCEPTION 'FALHOU: AIH aprovada ainda avisa: %', d -> 'avisos'; END IF;
  IF d -> 'aihs' -> 0 ->> 'id' <> '28000000-0000-4000-8000-0000000d4202' OR NOT (d -> 'aihs' -> 0 ->> 'vigente')::boolean
     OR d -> 'aihs' -> 0 ->> 'numero' <> '3526112345678' OR (d -> 'aihs' -> 1 ->> 'vigente')::boolean THEN
    RAISE EXCEPTION 'FALHOU: AIH que vale: %', d -> 'aihs';
  END IF;
  RAISE NOTICE 'OK  1a/3a: aprovada vem primeiro e marcada como a que vale, com número e competência; gestor também vê';
END $$;
RESET ROLE;

-- aviso não trava o fechamento (a porta ainda tem APAC solicitada)
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'internacao', desfecho_em = now() - interval '1 hour',
       desfecho_por = '10000000-0000-4000-8000-000000000002', encerrado_em = now() - interval '1 hour'
 WHERE id = '25000000-0000-4000-8000-0000000d4201';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'em_conferencia');
-- Fase 5B, tarefa 5: a conta de teste tem pendência bloqueante; o gestor libera
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.liberar_fechamento_conta(pg_temp.u('porta'), 'liberado no teste da tarefa anterior');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('porta'), 'fechada');
DO $$ BEGIN
  IF (public.conta_detalhe(pg_temp.u('porta')) ->> 'status') <> 'fechada'
     OR jsonb_array_length(pg_temp.doc(pg_temp.u('porta')) -> 'avisos') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: fechamento com aviso de documento';
  END IF;
  RAISE NOTICE 'OK  4a/5a: aviso de documento não trava o fechamento';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('authenticated', 'private.conta_documentos_sus(public.contas)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: função interna exposta';
  END IF;
  RAISE NOTICE 'OK  função interna fechada';
END $$;
ROLLBACK;
