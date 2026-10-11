-- Fase 4, tarefa 4 — migration 20261110000001_decisao_regulacao.sql: aceite,
-- recusa e devolução. Cobre:
-- - autorizar (destino obrigatório; o resto opcional), negar (motivo da lista
--   e texto), devolver e pendência — só o regulador da central, pedido em aberto;
-- - a origem responde a pendência e corrige/reenvia o devolvido (solicitante,
--   médico assistente ou gestor); o reenvio mantém a posição na fila;
-- - avisos ao solicitante e ao médico assistente, e ao regulador na resposta;
-- - histórico e auditoria.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9'), ('I20.0', 'CID do teste I20.0') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009a0', 'Rede da Decisão');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009a0', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009a1'::uuid, 'UPA Leste', '7654407'),
               ('21000000-0000-4000-8000-0000000009a2'::uuid, 'Hospital Leste', '7654415'),
               ('21000000-0000-4000-8000-0000000009a3'::uuid, 'Central Leste', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-0000000009a1', '21000000-0000-4000-8000-0000000009a1', 'Porta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009a0', '21000000-0000-4000-8000-0000000009a3', '10000000-0000-4000-8000-000000000003');
-- 002 médico (solicitante); 004 médico assistente; 001 gestor da UPA; 006 e 003 reguladores
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009a1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009a1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009a1', 'gestor'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-0000000009a1', 'recepcao'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009a3', 'regulador'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-0000000009a3', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns)
SELECT ('23000000-0000-4000-8000-0000000009a' || n)::uuid, '21000000-0000-4000-8000-0000000009a1', 'Paciente Leste ' || n,
       '1970-01-01', 'L-' || n, '22000000-0000-4000-8000-0000000009a1', 'M', NULL
  FROM generate_series(1, 4) n;
-- quatro pedidos do médico 002, com o 004 de médico assistente; o 4º é o mais antigo
INSERT INTO public.regulacao_solicitacoes (organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico,
  medico_assistente_id, solicitante_id, solicitante_papel, criada_em)
SELECT '20000000-0000-4000-8000-0000000009a0', '21000000-0000-4000-8000-0000000009a3', '21000000-0000-4000-8000-0000000009a1', '7654407',
       ('23000000-0000-4000-8000-0000000009a' || n)::uuid, true, 'leito', '0303060190', 'uti_adulto', 'a_definir', 'urgencia', '04',
       'urgencia', 'I21.9', 'Quadro clínico do pedido de teste da decisão.', '10000000-0000-4000-8000-000000000004',
       '10000000-0000-4000-8000-000000000002', 'medico', now() - make_interval(mins => 10 * n)
  FROM generate_series(1, 4) n;

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
CREATE FUNCTION pg_temp.id(n int) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.regulacao_solicitacoes WHERE paciente_id = ('23000000-0000-4000-8000-0000000009a' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(int) TO authenticated;
CREATE FUNCTION pg_temp.campo(n int, c text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT to_jsonb(s)->>c FROM public.regulacao_solicitacoes s WHERE paciente_id = ('23000000-0000-4000-8000-0000000009a' || n)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.campo(int, text) TO authenticated;
CREATE FUNCTION pg_temp.avisos(perfil text, prefixo text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.notificacoes_plantonista WHERE perfil_id = perfil::uuid AND tipo LIKE prefixo || '%'
     AND unidade_id IN ('21000000-0000-4000-8000-0000000009a1', '21000000-0000-4000-8000-0000000009a3') $$;
GRANT EXECUTE ON FUNCTION pg_temp.avisos(text, text) TO authenticated;
CREATE FUNCTION pg_temp.ordem() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(right(d->'paciente'->>'nome', 1), ',' ORDER BY i)
    FROM jsonb_array_elements(public.regulacao_fila('21000000-0000-4000-8000-0000000009a3')->'dados') WITH ORDINALITY x(d, i) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ordem() TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. autorizar ────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_autorizar(%L, %L, %L)', pg_temp.id(1), 'rede', '21000000-0000-4000-8000-0000000009a2'),
  'Quem decide é o médico regulador', 'médico da origem não autoriza');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.regulacao_autorizar(%L, %L)', pg_temp.id(1), 'a_definir'),
  'Para autorizar, defina o destino', 'autorizar exige destino');
SELECT pg_temp.falha(format('SELECT public.regulacao_autorizar(%L, %L, %L)', pg_temp.id(1), 'rede', '21000000-0000-4000-8000-0000000009a1'),
  'O destino não pode ser a unidade de origem', 'destino não é a origem');
SELECT pg_temp.falha(format('SELECT public.regulacao_autorizar(%L, %L, NULL, %L)', pg_temp.id(1), 'externo', 'X'),
  'Informe o serviço de destino', 'destino externo precisa de nome');
SELECT public.regulacao_autorizar(pg_temp.id(1), 'rede', '21000000-0000-4000-8000-0000000009a2');
-- desde a tarefa 9 (migration 20261115000001), autorizar manda o pedido ao destino, que aceita ou recusa
SELECT pg_temp.ok(pg_temp.campo(1, 'status') = 'aguardando_destino' AND pg_temp.campo(1, 'destino_unidade_id') = '21000000-0000-4000-8000-0000000009a2'
              AND pg_temp.campo(1, 'autorizada_por') = '10000000-0000-4000-8000-000000000006' AND pg_temp.campo(1, 'data_prevista') IS NULL,
  'autorizada só com o destino; transporte e data ficam opcionais');
SELECT public.regulacao_autorizar(pg_temp.id(2), 'externo', NULL, 'Hospital Estadual X', 'ambulancia_avancada', now() + interval '2 hours', 'Leito 12 reservado');
SELECT pg_temp.ok(pg_temp.campo(2, 'transporte_central') = 'ambulancia_avancada' AND pg_temp.campo(2, 'data_prevista') IS NOT NULL
              AND pg_temp.campo(2, 'observacao_decisao') = 'Leito 12 reservado', 'autorizada com transporte, data e observação');
SELECT pg_temp.falha(format('SELECT public.regulacao_negar(%L, %L, %L)', pg_temp.id(1), 'sem_oferta', 'Sem leito na rede hoje'),
  'Este pedido não está na fila da central', 'pedido autorizado não volta a ser decidido');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_autorizada') = 2
              AND pg_temp.avisos('10000000-0000-4000-8000-000000000004', 'reg_autorizada') = 2,
  'solicitante e médico assistente avisados da autorização');

-- ── 2. pendência e resposta ─────────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia(%L, %L)', pg_temp.id(3), 'curta'), 'Escreva a pergunta', 'pendência pede pergunta');
SELECT public.regulacao_pendencia(pg_temp.id(3), 'Qual a troponina e o horário do último ECG?');
SELECT pg_temp.ok(pg_temp.campo(3, 'status') = 'pendencia' AND pg_temp.campo(3, 'assumida_por') = '10000000-0000-4000-8000-000000000006',
  'pendência: pedido segue na fila, com o regulador');
SELECT pg_temp.ok(position('3' in pg_temp.ordem()) > 0, 'pedido com pendência continua na fila');
SELECT pg_temp.falha(format('SELECT public.regulacao_pendencia(%L, %L)', pg_temp.id(3), 'Outra pergunta qualquer aqui'),
  'Já há uma pergunta esperando resposta', 'uma pergunta por vez');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.regulacao_responder_pendencia(%L, %L)', pg_temp.id(3), 'Troponina 2,3'),
  'Responde o solicitante, o médico assistente, o gestor ou o NIR', 'recepção não responde');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.regulacao_responder_pendencia(pg_temp.id(3), 'Troponina 2,3 ng/mL às 14h; ECG às 14h10 com supra inferior.');
SELECT pg_temp.ok(pg_temp.campo(3, 'status') = 'em_analise' AND pg_temp.campo(3, 'pendencia_respondida_por') = '10000000-0000-4000-8000-000000000004',
  'médico assistente responde; pedido volta a em análise com o regulador');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000006', 'reg_resposta') = 1, 'regulador que perguntou é avisado da resposta');
SELECT pg_temp.falha(format('SELECT public.regulacao_responder_pendencia(%L, %L)', pg_temp.id(3), 'De novo a resposta'),
  'Não há pergunta da central esperando resposta', 'sem pergunta, não há o que responder');

-- ── 3. negar ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha(format('SELECT public.regulacao_negar(%L, %L, %L)', pg_temp.id(3), 'sem_oferta', 'Sem leito de UTI na rede'),
  'Este pedido está com', 'outro regulador não decide pedido assumido');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.regulacao_negar(%L, %L, %L)', pg_temp.id(3), 'qualquer', 'Sem leito de UTI na rede'),
  'Escolha o motivo da negação', 'motivo fora da lista');
SELECT pg_temp.falha(format('SELECT public.regulacao_negar(%L, %L, %L)', pg_temp.id(3), 'sem_oferta', 'curto'),
  'Escreva a justificativa', 'negar pede texto');
SELECT public.regulacao_negar(pg_temp.id(3), 'sem_indicacao', 'Sem critério de UTI: troponina em queda, estável.');
SELECT pg_temp.ok(pg_temp.campo(3, 'status') = 'negada' AND pg_temp.campo(3, 'motivo_negacao') = 'sem_indicacao',
  'negada com motivo e texto');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_negada') = 1, 'origem avisada da negação');

-- ── 4. devolver, corrigir e reenviar (mantém a posição) ─────────────────────
SELECT pg_temp.ok(pg_temp.ordem() = '4', 'na fila sobrou o pedido 4');
SELECT public.regulacao_assumir(pg_temp.id(4));
SELECT pg_temp.falha(format('SELECT public.regulacao_devolver(%L, %L)', pg_temp.id(4), 'curto'), 'Escreva o que a origem precisa corrigir', 'devolver pede motivo');
SELECT public.regulacao_devolver(pg_temp.id(4), 'CID não bate com o quadro; informe os sinais vitais com hora.');
SELECT pg_temp.ok(pg_temp.campo(4, 'status') = 'devolvida' AND pg_temp.campo(4, 'assumida_por') IS NULL AND pg_temp.ordem() IS NULL,
  'devolvido sai da fila e fica sem dono');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000004', 'reg_devolvida') = 1, 'médico assistente avisado da devolução');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.regulacao_reenviar(%L, %L)', pg_temp.id(4), '{"cid": "I20.0"}'),
  'Reenvia o solicitante, o médico assistente ou o gestor', 'recepção não reenvia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.regulacao_reenviar(%L, %L)', pg_temp.id(4), '{"cid": "Z99.9"}'),
  'Informe um CID-10 válido', 'reenvio confere o CID');
INSERT INTO t SELECT 'criada_antes', pg_temp.campo(4, 'criada_em');
SELECT public.regulacao_reenviar(pg_temp.id(4), '{"cid": "I20.0", "sinais_vitais": "PA 130x80, FC 88 às 15h", "quadro_clinico": "Angina instável, dor em repouso há 2 h, sem supra."}');
SELECT pg_temp.ok(pg_temp.campo(4, 'status') = 'enviada' AND pg_temp.campo(4, 'cid') = 'I20.0'
              AND pg_temp.campo(4, 'sinais_vitais') LIKE 'PA 130x80%' AND pg_temp.campo(4, 'reenviada_em') IS NOT NULL
              AND pg_temp.campo(4, 'criada_em') = (SELECT valor FROM t WHERE nome = 'criada_antes'),
  'gestor corrige e reenvia; a espera conta do pedido original');
SELECT pg_temp.falha(format('SELECT public.regulacao_reenviar(%L, %L)', pg_temp.id(4), '{}'),
  'Só se reenvia pedido devolvido', 'só pedido devolvido é reenviado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(pg_temp.ordem() = '4', 'reenviado volta à fila');
SELECT pg_temp.ok((SELECT string_agg(e->>'evento', ',' ORDER BY e->>'em')
                     FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.id(4))->'eventos') e)
                  = 'assumida,devolvida,reenviada', 'histórico: assumida, devolvida, reenviada');

-- ── 5. prioridade avisa a origem; detalhe traz a decisão ────────────────────
SELECT public.regulacao_priorizar(pg_temp.id(4), 'prioritaria', 'Estável, sem supra, pode aguardar o leito clínico');
SELECT pg_temp.ok(pg_temp.avisos('10000000-0000-4000-8000-000000000002', 'reg_prioridade') = 1, 'mudança de prioridade avisa a origem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.id(2))->>'observacao_decisao') = 'Leito 12 reservado'
              AND (public.regulacao_detalhe(pg_temp.id(3))->>'motivo_negacao') = 'sem_indicacao'
              AND (public.regulacao_detalhe(pg_temp.id(3))->>'pendencia_resposta') LIKE 'Troponina%'
              AND (public.regulacao_detalhe(pg_temp.id(4))->>'origem_pode_responder')::boolean,
  'a origem vê a decisão, a negação, a resposta e se pode responder');

RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao IN ('regulacao_autorizada', 'regulacao_negada', 'regulacao_devolvida', 'regulacao_reenviada')
                    AND unidade_id IN ('21000000-0000-4000-8000-0000000009a1', '21000000-0000-4000-8000-0000000009a3')) = 5,
  'auditoria das decisões e do reenvio');

ROLLBACK;
