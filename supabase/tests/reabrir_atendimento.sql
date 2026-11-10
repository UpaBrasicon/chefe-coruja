-- Testes da migration 20270330000001_reabrir_atendimento.sql (lacuna 8 do
-- Portão de 11/10/2026; decisão do RT em 10/11/2026: A em R1 a R10).
--  R1. reabre o autor do desfecho ou o gestor; outro médico, a enfermagem e a
--      recepção, não;
--  R2. depois de 24 h, recusa com a ficha nova;
--  R3. motivo da lista; "outro" pede 10 letras;
--  R4. alta, evasão e transferência sem saída reabrem; óbito, "cancelado",
--      observação e internação não; transferência com a saída marcada não;
--  R5. o mesmo atendimento volta a "atendimento"; o desfecho anterior fica no
--      evento; recusa com outro atendimento aberto; reabre e fecha de novo;
--  R6. volta a prescrição com item na validade; o vencido fica suspenso; a
--      prescrição só com vencido fica encerrada; exame, parecer e isolamento
--      não voltam; a prévia lista o que não volta;
--  R7. conta fechada e competência do BPA fechada recusam; RAC pendente
--      descartado e enviado mantido; webhook "atendimento.reaberto";
--      contrarreferência cancelada; documentos emitidos listados;
--  R8. reaberturas na linha do tempo (prontuario_leitura); auditoria só com
--      códigos;
--  R10. cancelar_alta aceita o gestor pelo vínculo (tenho_papel);
--  privilégios: tabela só leitura pelo RLS, só inserção; anon não executa.
-- Usa a Unidade Teste do seed (gestor …01, médico …02, admin …03, enfermeira
-- …04, recepção …05). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('R60', 'CID do teste R60') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE TEMP TABLE ok_log (n serial, texto text) ON COMMIT DROP;
GRANT ALL ON ok_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE ok_log_n_seq TO authenticated, anon;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.j(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.j(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    INSERT INTO ok_log (texto) VALUES (p_ok);
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  INSERT INTO ok_log (texto) VALUES (p_ok);
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, anon;
-- o episódio lido como superusuário
CREATE FUNCTION pg_temp.ep(p text) RETURNS public.episodios LANGUAGE sql SECURITY DEFINER AS $$
  SELECT e FROM public.episodios e WHERE e.id = pg_temp.u('ep' || p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ep(text) TO authenticated;
-- desfecho de ponta a ponta: ficha (recepção), classificação (enfermeira), SOAP (médico)
CREATE FUNCTION pg_temp.ficha(p text, p_atender boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.como('10000000-0000-4000-8000-000000000005');
  INSERT INTO t SELECT 'ep' || p, public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor abdominal', NULL,
    json_build_object('nome', 'Paciente Reabrir ' || p, 'data_nascimento', (current_date - interval '40 years')::date)::jsonb) ->> 'episodio_id';
  PERFORM pg_temp.como('10000000-0000-4000-8000-000000000004');
  PERFORM public.classificar_risco(pg_temp.u('ep' || p), 'amarelo',
    '{"frequencia-cardiaca":110,"frequencia-respiratoria":22,"temperatura":36.8,"saturacao-o2":95,"escala-dor":6,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}',
    pg_temp.u('flx'), 'Edema de face');
  IF p_atender THEN
    PERFORM pg_temp.como('10000000-0000-4000-8000-000000000002');
    PERFORM public.iniciar_atendimento(pg_temp.u('ep' || p));
    PERFORM public.registrar_soap(pg_temp.u('ep' || p), 'Dor abdominal', 'Abdome flácido', 'Dispepsia', 'Sintomáticos', 'R60');
  END IF;
  INSERT INTO t SELECT p, paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep' || p);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ficha(text, boolean) TO authenticated;
INSERT INTO t VALUES ('textos', '{"resumo_clinico":"Dor abdominal intensa há 6 horas, defesa em fossa ilíaca direita.","condutas":"Analgesia, jejum e hidratação venosa.","motivo":"Avaliação cirúrgica, ausente na unidade."}');
CREATE FUNCTION pg_temp.r(p_ep uuid, p_motivo text, p_detalhe text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.reabrir_atendimento(%L, %L, %L)', p_ep, p_motivo, p_detalhe) $$;
GRANT EXECUTE ON FUNCTION pg_temp.r(uuid, text, text) TO authenticated, anon;

-- ── pessoas e unidades do teste ────────────────────────────────────────────
-- outro médico da porta …r2; médico de fora …x2; super admin …s1; destino,
-- central e uma UBS na rede
INSERT INTO t VALUES
  ('medb', '10000000-0000-4000-8000-0000000008b2'), ('medx', '10000000-0000-4000-8000-0000000008e2'),
  ('super', '10000000-0000-4000-8000-0000000008a1'),
  ('dest', '21000000-0000-4000-8000-0000000008d1'), ('cent', '21000000-0000-4000-8000-0000000008c1'),
  ('ubs', '21000000-0000-4000-8000-0000000008f1'), ('fora', '21000000-0000-4000-8000-0000000008e1'),
  ('setor_fora', '22000000-0000-4000-8000-0000000008e1');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(x), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x || '-reabrir@teste.local', '', now(), '{}', '{}', now(), now()
  FROM unnest(ARRAY['medb', 'medx', 'super']) x
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  (pg_temp.u('medb'), 'Outro Médico Reabrir'), (pg_temp.u('medx'), 'Médico de Fora Reabrir'), (pg_temp.u('super'), 'Super Reabrir')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.super_admins (perfil_id) VALUES (pg_temp.u('super')) ON CONFLICT DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('dest'), '20000000-0000-4000-8000-000000000001', 'Hospital Destino Reabrir', 'hospital', '7654381'),
  (pg_temp.u('cent'), '20000000-0000-4000-8000-000000000001', 'Central Reabrir', 'hospital', NULL),
  (pg_temp.u('ubs'), '20000000-0000-4000-8000-000000000001', 'UBS Reabrir', 'ubs', '7654382'),
  (pg_temp.u('fora'), '20000000-0000-4000-8000-000000000001', 'Hospital de Fora Reabrir', 'hospital', '7654383');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.u('setor_fora'), pg_temp.u('fora'), 'Clínica de fora', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('medb'), '21000000-0000-4000-8000-000000000001', 'plantonista'),
  (pg_temp.u('medx'), pg_temp.u('fora'), 'plantonista'),
  -- R10: o admin passa a ser também gestor (papel_na_unidade devolve 'admin')
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'gestor')
ON CONFLICT DO NOTHING;
-- escala: médicos e enfermeira no PS, na Observação e na Clínica Médica; recepção no PS; o de fora na clínica dele
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', pg_temp.u('medb')::text]::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360
UNION ALL
SELECT pg_temp.u('fora'), pg_temp.u('setor_fora'), pg_temp.u('medx'), private.data_atual(), 'manha', now() - interval '1 hour', 360;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES ('22000000-0000-4000-8000-000000000001', 'RA1', 'clinico');
INSERT INTO t SELECT 'RA1', id::text FROM public.leitos WHERE identificador = 'RA1' AND setor_id = '22000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- webhook: um destino da Unidade Teste que pede o evento novo (o cadastro aceita)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('super')::text);
INSERT INTO t SELECT 'chave', public.api_criar_chave('ERP reabrir', 'test', ARRAY['21000000-0000-4000-8000-000000000001'::uuid], ARRAY['atendimentos']) ->> 'id';
INSERT INTO t SELECT 'destino', public.webhook_criar_destino('ERP reabrir', 'https://erp.exemplo.com.br/hook', pg_temp.u('chave'),
  ARRAY['21000000-0000-4000-8000-000000000001'::uuid], ARRAY['atendimento.encerrado', 'atendimento.reaberto']) ->> 'id';
RESET ROLE;
SELECT pg_temp.ok('atendimento.reaberto' = ANY (private.webhook_tipos()) AND pg_temp.u('destino') IS NOT NULL,
  'R7: "atendimento.reaberto" está no catálogo e o destino o aceita');

-- ── atendimentos ────────────────────────────────────────────────────────────
-- A: alta, reaberta pelo autor (o caminho completo); B: alta, reaberta pelo
-- gestor; C: quem não pode e as regras do motivo; D: mais de 24 h; E: óbito;
-- F: retirado da fila; G: observação; H: internação (e o cancelar_alta);
-- I: transferência sem regulação; J: transferência com a saída marcada;
-- K: outro atendimento aberto; L: conta e competência; M: RAC já enviado;
-- N: prescrição só com item vencido.
SET LOCAL ROLE authenticated;
SELECT pg_temp.ficha(x) FROM unnest(ARRAY['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']) x;
SELECT pg_temp.ficha('F', false);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
-- A: dois cuidados (um vai vencer) e um exame com resultado; N: um cuidado (vai vencer)
INSERT INTO t SELECT 'iA_ok', public.prescrever(pg_temp.u('A'), '{"tipo":"cuidado","descricao":"Cabeceira elevada"}');
INSERT INTO t SELECT 'iA_venc', public.prescrever(pg_temp.u('A'), '{"tipo":"cuidado","descricao":"Jejum oral"}');
INSERT INTO t SELECT 'iN_venc', public.prescrever(pg_temp.u('N'), '{"tipo":"cuidado","descricao":"Repouso no leito"}');
RESET ROLE;
-- o vencido: a validade já passou (só o servidor grava; aqui, como superusuário)
UPDATE public.prescricao_itens SET valida_ate = now() - interval '1 hour' WHERE id IN (pg_temp.u('iA_venc'), pg_temp.u('iN_venc'));
-- A em isolamento (termina no desfecho); I com exame e parecer pendentes (cancelados na transferência)
INSERT INTO public.isolamentos_paciente (unidade_id, paciente_id, episodio_id, tipo, motivo, marcado_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('A'), pg_temp.u('epA'), 'contato', 'Colonização por KPC', '10000000-0000-4000-8000-000000000004');
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por, situacao)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('I'), pg_temp.u('epI'), 'Hemograma', '10000000-0000-4000-8000-000000000002', 'pedido');
INSERT INTO public.pareceres_medicos (organizacao_id, unidade_id, paciente_id, episodio_id, especialidade, prioridade, pergunta, status, solicitante_id)
VALUES ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', pg_temp.u('I'), pg_temp.u('epI'), 'Cirurgia geral', 'urgencia',
        'Abdome agudo inflamatório? Indicação cirúrgica?', 'solicitado', '10000000-0000-4000-8000-000000000002');
-- J: a regulação autorizada (a alta por transferência marca a saída)
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, episodio_id,
  tipo, procedimento, transporte, destino_tipo, destino_unidade_id, carater, modalidade, prioridade, cid, quadro_clinico,
  solicitante_id, solicitante_papel, status, autorizada_em, destino_enviado_em)
VALUES ('30000000-0000-4000-8000-0000000008f1', '20000000-0000-4000-8000-000000000001', pg_temp.u('cent'), '21000000-0000-4000-8000-000000000001',
        '1234567', pg_temp.u('J'), pg_temp.u('epJ'), 'transferencia', '0303060190', 'ambulancia_avancada', 'rede', pg_temp.u('dest'),
        'urgencia', '04', 'urgencia', 'R60', 'Quadro clínico do pedido de teste da reabertura.', '10000000-0000-4000-8000-000000000002',
        'medico', 'autorizada', now(), now());

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('ep' || x), 'alta') FROM unnest(ARRAY['A', 'B', 'C', 'D', 'K', 'L', 'M', 'N']) x;
SELECT public.registrar_desfecho(pg_temp.u('epG'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('epH'), 'internacao', NULL, json_build_object('setor_id', '22000000-0000-4000-8000-000000000001', 'leito_id', pg_temp.u('RA1'))::jsonb);
SELECT public.emitir_documento_transferencia(pg_temp.u(x), pg_temp.j('textos')) FROM unnest(ARRAY['I', 'J']) x;
SELECT public.registrar_desfecho(pg_temp.u('ep' || x), 'transferencia', NULL, '{"destino":"Hospital Destino Reabrir"}') FROM unnest(ARRAY['I', 'J']) x;
RESET ROLE;
-- E: óbito; F: retirado da fila pela recepção (sem médico), gravados direto
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'obito', desfecho_em = now(), desfecho_por = '10000000-0000-4000-8000-000000000002',
       encerrado_em = now(), encerrado_por = '10000000-0000-4000-8000-000000000002' WHERE id = pg_temp.u('epE');
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'cancelado', desfecho_motivo = 'engano: ficha aberta por engano', desfecho_em = now(),
       encerrado_em = now(), encerrado_por = '10000000-0000-4000-8000-000000000005' WHERE id = pg_temp.u('epF');
-- A: a contrarreferência à UBS que o desfecho gerou (gravada direto: o paciente veio da UBS)
INSERT INTO public.contrarreferencias (organizacao_id, unidade_origem_id, episodio_id, paciente_origem_id, unidade_ubs_id, paciente_ubs_id,
  desfecho, saida_em, resumo)
VALUES ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', pg_temp.u('epA'), pg_temp.u('A'), pg_temp.u('ubs'),
        pg_temp.u('A'), 'alta', now(), '{}');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.interop_outbox WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.u('epA') AND status = 'pendente')
  AND (SELECT status = 'encerrada' FROM public.prescricoes WHERE id = (SELECT prescricao_id FROM public.prescricao_itens WHERE id = pg_temp.u('iA_ok')))
  AND (SELECT retirado_em IS NOT NULL FROM public.isolamentos_paciente WHERE paciente_id = pg_temp.u('A'))
  AND (SELECT situacao = 'cancelado' FROM public.exames_pedidos WHERE episodio_id = pg_temp.u('epI'))
  AND (SELECT status = 'cancelado' FROM public.pareceres_medicos WHERE episodio_id = pg_temp.u('epI'))
  AND (SELECT saida_em IS NOT NULL FROM public.regulacao_solicitacoes WHERE id = '30000000-0000-4000-8000-0000000008f1'),
  'antes: o desfecho fechou prescrição, isolamento, exame e parecer, enfileirou o RAC e marcou a saída da regulação de J');

-- ── R9: a prévia ────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'prevA', public.reabrir_atendimento_previa(pg_temp.u('epA'))::text;
INSERT INTO t SELECT 'prevI', public.reabrir_atendimento_previa(pg_temp.u('epI'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'prevA_rec', public.reabrir_atendimento_previa(pg_temp.u('epA'))::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.j('prevA') ->> 'pode')::boolean AND pg_temp.j('prevA') ->> 'desfecho' = 'alta'
  AND pg_temp.j('prevA') -> 'itens_voltam' @> jsonb_build_array(jsonb_build_object('id', pg_temp.u('iA_ok'), 'descricao', 'Cabeceira elevada'))
  AND pg_temp.j('prevA') -> 'itens_nao_voltam' @> jsonb_build_array(jsonb_build_object('id', pg_temp.u('iA_venc'), 'motivo', 'vencido'))
  AND jsonb_array_length(pg_temp.j('prevA') -> 'itens_voltam') = 1
  AND pg_temp.j('prevA') -> 'isolamentos_encerrados' @> '[{"tipo":"contato"}]'
  AND (pg_temp.j('prevA') ->> 'contrarreferencias')::int = 1 AND NOT (pg_temp.j('prevA') ->> 'rac_enviado')::boolean,
  'R6/R9: a prévia diz o que volta, o que não volta (vencido, isolamento) e a contrarreferência');
SELECT pg_temp.ok(pg_temp.j('prevI') -> 'exames_cancelados' @> '[{"exame":"Hemograma"}]'
  AND pg_temp.j('prevI') -> 'pareceres_cancelados' @> '[{"especialidade":"Cirurgia geral"}]'
  AND pg_temp.j('prevI') -> 'documentos' @> '[{"tipo_documento":"documento_transferencia"}]',
  'R6/R7: exame e parecer cancelados e o documento de transferência emitido aparecem na prévia');
SELECT pg_temp.ok(NOT (pg_temp.j('prevA_rec') ->> 'pode')::boolean AND pg_temp.j('prevA_rec') ->> 'recusa' LIKE 'Só quem registrou o desfecho%'
  AND NOT pg_temp.j('prevA_rec') ? 'itens_voltam',
  'R9: quem não pode recebe só a recusa, sem o impacto');

-- ── R1: quem reabre ─────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('medb')::text);
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'erro_registro', NULL), 'Só quem registrou o desfecho', 'R1: outro médico da porta não reabre');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'erro_registro', NULL), 'Só quem registrou o desfecho', 'R1: a enfermagem não reabre');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'erro_registro', NULL), 'Só quem registrou o desfecho', 'R1: a recepção não reabre');
SELECT pg_temp.como(pg_temp.u('medx')::text);
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'erro_registro', NULL), 'Só quem registrou o desfecho', 'R1: médico de outra unidade não reabre');

-- ── R3: o motivo ────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), NULL, NULL), 'Escolha o motivo da reabertura', 'R3: sem motivo, recusa');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'arrependimento', NULL), 'Escolha o motivo da reabertura', 'R3: motivo fora da lista, recusa');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'outro', 'curto'), 'Motivo "outro": descreva', 'R3: "outro" com menos de 10 letras, recusa');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'outro', repeat('x', 501)), 'O detalhe do motivo passa de 500 letras', 'R3: detalhe de mais de 500 letras, recusa');
INSERT INTO t SELECT 'resC', public.reabrir_atendimento(pg_temp.u('epC'), 'outro', 'Família trouxe exame de fora que muda a conduta.')::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT motivo = 'outro' AND detalhe = 'Família trouxe exame de fora que muda a conduta.' FROM public.episodio_eventos WHERE episodio_id = pg_temp.u('epC'))
  AND (pg_temp.ep('C')).etapa = 'atendimento', 'R3: "outro" com o detalhe reabre e guarda o detalhe');

-- ── R2: prazo ───────────────────────────────────────────────────────────────
UPDATE public.episodios SET desfecho_em = now() - interval '25 hours', encerrado_em = now() - interval '25 hours' WHERE id = pg_temp.u('epD');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epD'), 'erro_registro', NULL),
  'O desfecho tem mais de 24 horas: o atendimento não se reabre e o paciente volta por uma ficha nova', 'R2: mais de 24 h, recusa com a ficha nova (autor)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epD'), 'erro_registro', NULL),
  'O desfecho tem mais de 24 horas', 'R2: mais de 24 h, nem o gestor reabre');

-- ── R4: o que não reabre ────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epE'), 'erro_registro', NULL), 'Atendimento encerrado por óbito não se reabre', 'R4: óbito não reabre');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epF'), 'erro_registro', NULL), 'Só quem registrou o desfecho', 'R4: retirado da fila não tem autor médico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epF'), 'erro_registro', NULL), 'O paciente saiu da fila sem desfecho médico', 'R4: "cancelado" não reabre nem pelo gestor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epG'), 'erro_registro', NULL), 'O paciente foi para observação ou internação', 'R4: observação usa o cancelar_alta');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epH'), 'erro_registro', NULL), 'O paciente foi para observação ou internação', 'R4: internação usa o cancelar_alta');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epJ'), 'erro_registro', NULL), 'A saída do paciente já foi marcada na regulação', 'R4: transferência com a saída marcada não reabre');
SELECT pg_temp.falha(pg_temp.r(gen_random_uuid(), 'erro_registro', NULL), 'Atendimento não encontrado', 'atendimento inexistente');
INSERT INTO t SELECT 'resI', public.reabrir_atendimento(pg_temp.u('epI'), 'desfecho_errado', NULL)::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.ep('I')).etapa = 'atendimento' AND (pg_temp.ep('I')).desfecho IS NULL
  AND (SELECT situacao = 'cancelado' FROM public.exames_pedidos WHERE episodio_id = pg_temp.u('epI'))
  AND (SELECT status = 'cancelado' FROM public.pareceres_medicos WHERE episodio_id = pg_temp.u('epI'))
  AND (SELECT estado = 'ativo' AND cancelado_em IS NULL FROM public.documentos_clinicos WHERE episodio_id = pg_temp.u('epI') AND tipo_documento = 'documento_transferencia')
  AND pg_temp.j('resI') -> 'documentos' @> '[{"tipo_documento":"documento_transferencia"}]',
  'R4/R6/R7: transferência sem regulação reabre; exame e parecer seguem cancelados; o documento emitido continua valendo e vem na resposta');

-- ── R5/R7: o que trava ──────────────────────────────────────────────────────
-- K: o paciente já tem outro atendimento aberto
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, etapa, queixa, publico, aberto_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('K'), '22000000-0000-4000-8000-000000000003', 'triagem', 'Voltou com dor', 'adulto',
        '10000000-0000-4000-8000-000000000005');
-- L: a conta fechada; depois a competência do BPA fechada
UPDATE public.contas SET status = 'fechada' WHERE episodio_id = pg_temp.u('epL');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epK'), 'paciente_voltou', NULL), 'O paciente já tem outro atendimento aberto', 'R5: outro atendimento aberto, recusa');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epL'), 'erro_registro', NULL), 'A conta deste atendimento está fechada', 'R7: conta fechada, recusa');
RESET ROLE;
UPDATE public.contas SET status = 'faturada' WHERE episodio_id = pg_temp.u('epL');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epL'), 'erro_registro', NULL), 'A conta deste atendimento está fechada', 'R7: conta faturada, recusa (também ao gestor)');
RESET ROLE;
UPDATE public.contas SET status = 'aberta' WHERE episodio_id = pg_temp.u('epL');
INSERT INTO public.bpa_fechamentos (unidade_id, competencia, processamento, linhas, folhas, controle, arquivo, fechado_por)
VALUES ('21000000-0000-4000-8000-000000000001', private.competencia_de(now()), private.competencia_de(now()), 1, 1, 1111, 'arquivo de teste',
        '10000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epL'), 'erro_registro', NULL), 'A competência do BPA deste atendimento está fechada', 'R7: competência do BPA fechada, recusa');
RESET ROLE;
UPDATE public.bpa_fechamentos SET situacao = 'reaberta', reaberto_em = now(), reaberto_por = '10000000-0000-4000-8000-000000000001',
       motivo_reabertura = 'Reaberta no teste da reabertura' WHERE unidade_id = '21000000-0000-4000-8000-000000000001' AND situacao = 'fechada';
SELECT pg_temp.ok((SELECT etapa = 'encerrado' FROM public.episodios WHERE id = pg_temp.u('epL')), 'R7: recusado, o atendimento segue encerrado');

-- ── R1/R5/R6/R7/R8: A, reaberto pelo autor ──────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'resA', public.reabrir_atendimento(pg_temp.u('epA'), 'erro_registro', NULL)::text;
RESET ROLE;
INSERT INTO t SELECT 'evA', id::text FROM public.episodio_eventos WHERE episodio_id = pg_temp.u('epA');
SELECT pg_temp.ok((pg_temp.ep('A')).etapa = 'atendimento' AND (pg_temp.ep('A')).desfecho IS NULL AND (pg_temp.ep('A')).desfecho_por IS NULL
  AND (pg_temp.ep('A')).desfecho_em IS NULL AND (pg_temp.ep('A')).encerrado_em IS NULL AND (pg_temp.ep('A')).desfecho_detalhes IS NULL
  AND (pg_temp.ep('A')).atendimento_iniciado_em IS NOT NULL,
  'R5: o mesmo atendimento volta a "atendimento", com as colunas do desfecho limpas');
SELECT pg_temp.ok((SELECT tipo = 'reabertura' AND autor_id = '10000000-0000-4000-8000-000000000002' AND motivo = 'erro_registro' AND detalhe IS NULL
                     AND desfecho_anterior = 'alta' AND desfecho_anterior_por = '10000000-0000-4000-8000-000000000002'
                     AND desfecho_anterior_detalhes ->> 'cid_alta' = 'R60' AND desfecho_anterior_em IS NOT NULL AND encerrado_anterior_em IS NOT NULL
                     AND unidade_id = '21000000-0000-4000-8000-000000000001' AND paciente_id = pg_temp.u('A')
                     FROM public.episodio_eventos WHERE id = pg_temp.u('evA')),
  'R5: o evento guarda o desfecho anterior inteiro, quem reabriu (login), quando e o motivo');
SELECT pg_temp.ok((SELECT p.status = 'ativa' AND p.encerrada_em IS NULL FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = pg_temp.u('iA_ok'))
  AND (SELECT suspenso_em IS NULL FROM public.prescricao_itens WHERE id = pg_temp.u('iA_ok'))
  AND (SELECT suspenso_em IS NOT NULL AND suspenso_por = '10000000-0000-4000-8000-000000000002' AND motivo_suspensao LIKE 'Não voltou com a reabertura do atendimento: prescrição vencida%'
         FROM public.prescricao_itens WHERE id = pg_temp.u('iA_venc')),
  'R6: a prescrição volta com o item na validade; o vencido fica suspenso com o motivo');
SELECT pg_temp.ok((SELECT retirado_em IS NOT NULL FROM public.isolamentos_paciente WHERE paciente_id = pg_temp.u('A'))
  AND pg_temp.j('resA') -> 'isolamentos_encerrados' @> '[{"tipo":"contato"}]' AND pg_temp.j('resA') -> 'itens_nao_voltam' @> '[{"motivo":"vencido"}]',
  'R6: o isolamento não volta, e a resposta lista o que não voltou');
SELECT pg_temp.ok((SELECT status = 'descartado' AND ultimo_erro = 'atendimento reaberto' FROM public.interop_outbox WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.u('epA'))
  AND (pg_temp.j('resA') ->> 'rac_descartado')::boolean,
  'R7: o RAC ainda não enviado sai da fila da RNDS');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.webhook_eventos WHERE tipo = 'atendimento.reaberto' AND recurso_id = pg_temp.u('epA')
                      AND dados = jsonb_build_object('unidade_id', '21000000-0000-4000-8000-000000000001'::uuid, 'atendimento_id', pg_temp.u('epA'), 'paciente_id', pg_temp.u('A')))
  AND (SELECT count(*) = 1 FROM public.webhook_entregas en JOIN public.webhook_eventos ev ON ev.id = en.evento_id
        WHERE ev.tipo = 'atendimento.reaberto' AND ev.recurso_id = pg_temp.u('epA') AND en.destino_id = pg_temp.u('destino') AND en.situacao = 'pendente'),
  'R7: webhook "atendimento.reaberto" enxuto (só ids) e a entrega pendente para o destino');
SELECT pg_temp.ok((SELECT situacao = 'cancelada' AND cancelada_em IS NOT NULL FROM public.contrarreferencias WHERE episodio_id = pg_temp.u('epA'))
  AND (pg_temp.j('resA') ->> 'contrarreferencias_canceladas')::int = 1,
  'R7: a contrarreferência à UBS gerada pelo desfecho é cancelada');
SELECT pg_temp.ok((SELECT efeitos -> 'itens_voltam' = pg_temp.j('resA') -> 'itens_voltam' AND (efeitos ->> 'rac_descartado')::boolean
                     AND (efeitos ->> 'prescricoes_reativadas')::int = 1 FROM public.episodio_eventos WHERE id = pg_temp.u('evA')),
  'R5/R7: o evento registra o que voltou, o que não voltou, o RAC e a contrarreferência');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epA'), 'erro_registro', NULL), 'O atendimento não está encerrado', 'R5: reabrir duas vezes seguidas é recusado');
-- R8: a linha do tempo do prontuário
INSERT INTO t SELECT 'pront', public.prontuario_leitura(pg_temp.u('A'))::text;
-- leitura pelo RLS: quem vê o atendimento vê o evento; o médico de fora, não
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.episodio_eventos WHERE episodio_id = pg_temp.u('epA')), 'RLS: o médico da porta lê o evento do atendimento');
SELECT pg_temp.como(pg_temp.u('medx')::text);
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.episodio_eventos WHERE episodio_id = pg_temp.u('epA')), 'RLS: o médico de outra unidade não lê o evento');
SELECT pg_temp.falha(format('INSERT INTO public.episodio_eventos (episodio_id, unidade_id, paciente_id, tipo, autor_id, motivo, desfecho_anterior, desfecho_anterior_em) VALUES (%L, %L, %L, %L, %L, %L, %L, now())',
  pg_temp.u('epB'), '21000000-0000-4000-8000-000000000001', pg_temp.u('B'), 'reabertura', pg_temp.u('medx'), 'erro_registro', 'alta'),
  'permission denied', 'a tabela não aceita inserção direta pela API');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.j('pront') -> 'reaberturas' @> jsonb_build_array(jsonb_build_object('episodio_id', pg_temp.u('epA'), 'motivo', 'erro_registro',
                    'desfecho_anterior', 'alta', 'cid_anterior', 'R60', 'autor_id', '10000000-0000-4000-8000-000000000002',
                    'medico_id', '10000000-0000-4000-8000-000000000002'))
  AND pg_temp.j('pront') -> 'nomes' ->> '10000000-0000-4000-8000-000000000002' = 'Plantonista de Teste'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('pront') -> 'atendimentos') a WHERE a ->> 'id' = pg_temp.u('epA')::text AND a ->> 'etapa' = 'atendimento'),
  'R8: a reabertura entra na linha do tempo com o desfecho anterior e o nome de quem reabriu');

-- R5: fecha de novo depois de reaberto (os gatilhos do desfecho valem outra vez)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('epA'), 'alta_a_pedido', 'Paciente decidiu sair contra a orientação médica, termo assinado.');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.ep('A')).etapa = 'encerrado' AND (pg_temp.ep('A')).desfecho = 'alta_a_pedido'
  AND (SELECT count(*) = 1 FROM public.interop_outbox WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.u('epA') AND status = 'pendente')
  AND (SELECT count(*) = 2 FROM public.webhook_eventos WHERE tipo = 'atendimento.encerrado' AND recurso_id = pg_temp.u('epA'))
  AND (SELECT status = 'encerrada' FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = pg_temp.u('iA_ok'))
  AND (SELECT desfecho_anterior = 'alta' FROM public.episodio_eventos WHERE id = pg_temp.u('evA')),
  'R5: reaberto, o atendimento fecha de novo: RAC novo na fila, webhook de encerrado, prescrição encerrada; o evento segue com o desfecho anterior');

-- ── R1: B, reaberto pelo gestor ─────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'resB', public.reabrir_atendimento(pg_temp.u('epB'), 'paciente_voltou', NULL)::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.ep('B')).etapa = 'atendimento'
  AND (SELECT autor_id = '10000000-0000-4000-8000-000000000001' AND desfecho_anterior_por = '10000000-0000-4000-8000-000000000002' AND motivo = 'paciente_voltou'
         FROM public.episodio_eventos WHERE episodio_id = pg_temp.u('epB')),
  'R1: o gestor da unidade reabre; o evento separa quem reabriu de quem deu o desfecho');

-- ── R6: N, só com item vencido; R7: M, RAC já enviado ───────────────────────
UPDATE public.interop_outbox SET status = 'enviado', enviado_em = now() WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.u('epM');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'resN', public.reabrir_atendimento(pg_temp.u('epN'), 'desfecho_errado', NULL)::text;
INSERT INTO t SELECT 'resM', public.reabrir_atendimento(pg_temp.u('epM'), 'erro_registro', NULL)::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT p.status = 'encerrada' FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = pg_temp.u('iN_venc'))
  AND (SELECT suspenso_em IS NULL FROM public.prescricao_itens WHERE id = pg_temp.u('iN_venc'))
  AND jsonb_array_length(pg_temp.j('resN') -> 'itens_voltam') = 0 AND (pg_temp.j('resN') ->> 'prescricoes_reativadas')::int = 0
  AND pg_temp.j('resN') -> 'itens_nao_voltam' @> jsonb_build_array(jsonb_build_object('id', pg_temp.u('iN_venc'))),
  'R6: a prescrição só com item vencido fica encerrada (nada muda nela)');
SELECT pg_temp.ok((SELECT status = 'enviado' FROM public.interop_outbox WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.u('epM'))
  AND (pg_temp.j('resM') ->> 'rac_enviado')::boolean AND NOT (pg_temp.j('resM') ->> 'rac_descartado')::boolean
  AND (SELECT (efeitos ->> 'rac_enviado')::boolean FROM public.episodio_eventos WHERE episodio_id = pg_temp.u('epM')),
  'R7: o RAC já enviado fica, e o evento registra');

-- ── R10: cancelar_alta pelo gestor que também é admin ───────────────────────
INSERT INTO t SELECT 'iH', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('epH');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.dar_alta(pg_temp.u('iH'), 'alta_melhorada', 'R60');
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epH'), 'erro_registro', NULL), 'O paciente foi para observação ou internação', 'R4: depois da alta da internação, segue pelo cancelar_alta');
SELECT pg_temp.como(pg_temp.u('medb')::text);
SELECT pg_temp.falha(format('SELECT public.cancelar_alta(%L, %L)', pg_temp.u('iH'), 'Paciente voltou a ter febre antes de sair'),
  'Só quem deu a alta, ou o gestor, cancela', 'R10: outro médico não cancela a alta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok(private.papel_na_unidade('21000000-0000-4000-8000-000000000001') = 'admin' AND private.tenho_papel('21000000-0000-4000-8000-000000000001', 'gestor'),
  'R10: o admin que também é gestor: papel_na_unidade devolve "admin"');
SELECT public.cancelar_alta(pg_temp.u('iH'), 'Paciente voltou a ter febre antes de sair');
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'internado' AND data_alta IS NULL FROM public.internacoes WHERE id = pg_temp.u('iH'))
  AND position('tenho_papel(i.unidade_id, ''gestor'')' IN pg_get_functiondef('public.cancelar_alta(uuid, text)'::regprocedure)) > 0
  AND position('papel_na_unidade' IN pg_get_functiondef('public.cancelar_alta(uuid, text)'::regprocedure)) = position('papel_na_unidade devolve' IN pg_get_functiondef('public.cancelar_alta(uuid, text)'::regprocedure)),
  'R10: o gestor pelo vínculo cancela a alta (papel_na_unidade só no comentário)');

-- ── privilégios ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.episodio_eventos'::regclass)
  AND has_table_privilege('authenticated', 'public.episodio_eventos', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.episodio_eventos', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.episodio_eventos', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.episodio_eventos', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.episodio_eventos', 'SELECT'),
  'tabela: RLS ligado; authenticated só lê; anon nada');
SELECT pg_temp.falha(format('UPDATE public.episodio_eventos SET detalhe = %L WHERE id = %L', 'trocado depois', pg_temp.u('evA')),
  'Evento do atendimento não se altera', 'só inserção: nem o dono altera o evento');
SELECT pg_temp.falha(format('DELETE FROM public.episodio_eventos WHERE id = %L', pg_temp.u('evA')),
  'Registro clínico não se apaga', 'só inserção: o evento não se apaga');
SELECT pg_temp.ok(bool_and(NOT has_function_privilege('anon', f, 'EXECUTE') AND has_function_privilege('authenticated', f, 'EXECUTE')
                           AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure)),
  'RPCs: SECURITY DEFINER, search_path vazio; anon não executa, authenticated sim')
  FROM unnest(ARRAY['public.reabrir_atendimento(uuid, text, text)', 'public.reabrir_atendimento_previa(uuid)']) f;
SELECT pg_temp.ok(bool_and(NOT has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')),
  'funções private: ninguém de fora executa')
  FROM unnest(ARRAY['private.reabertura_recusa(public.episodios)', 'private.reabertura_impacto(public.episodios)',
                    'private.reabertura_item_volta(text, timestamptz, timestamptz, timestamptz)', 'private.episodio_eventos_so_insercao()']) f;
SET LOCAL ROLE anon;
SELECT pg_temp.falha(pg_temp.r(pg_temp.u('epC'), 'erro_registro', NULL), 'permission denied', 'anon não executa');
RESET ROLE;

-- ── auditoria sem dado de pessoa ────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 6 FROM public.log_auditoria WHERE acao = 'reabrir_atendimento')
  AND (SELECT bool_and(payload ->> 'status' = 'atendimento' AND payload ? 'motivo_codigo' AND payload ? 'tipo'
                       AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(payload) k WHERE k NOT IN ('status', 'tipo', 'motivo_codigo', 'anterior', 'quantidade')))
         FROM public.log_auditoria WHERE acao = 'reabrir_atendimento')
  AND (SELECT count(*) >= 1 FROM public.log_auditoria WHERE acao = 'reabrir_prescricao')
  AND NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao IN ('reabrir_atendimento', 'reabrir_prescricao')
                   AND (payload::text LIKE '%Paciente Reabrir%' OR payload::text LIKE '%Família trouxe%' OR payload::text LIKE '%Cabeceira%')),
  'R8: auditoria só com ids e códigos (sem nome, detalhe do motivo ou texto clínico)');

ROLLBACK;
