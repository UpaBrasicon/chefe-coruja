-- Testes da migration 20270329000001_documento_transferencia.sql (lacuna 7 do
-- Portão de 11/10/2026; decisão do RT em 10/11/2026: A em T1 a T9).
--  T1. tipo novo; só nasce pela RPC própria (emitir_documento recusa o tipo;
--      a tabela não aceita inserção direta);
--  T2/T3. a fotografia do servidor: alergias, últimos sinais vitais crus,
--      prescrição com a validade, controlados, exames com resultado,
--      dispositivos, isolamento e regulação (número, destino, aceite,
--      transporte); o documento guarda a fotografia e os três textos e não
--      muda depois;
--  T4. checklist: cada item feito ou "não se aplica" com o motivo; incubadora
--      só no recém-nascido;
--  T5. a transferência externa (porta, observação, internação) é recusada sem
--      documento em vigor; o cancelado não conta; nova versão conta;
--  T6. emite o médico; a recepção e a enfermagem não emitem; o enfermeiro marca
--      os itens de enfermagem e o médico os dele; o NIR lê;
--  T8. a folha leva o checklist do momento e registra a impressão;
--  T9. Regulação: origem, NIR e destino na rede leem; recepção e quem é de
--      fora, não;
--  privilégios: tabela sem leitura direta; anon não executa; auditoria sem
--  dado de pessoa.
-- Unidade de destino, NIR e um médico de fora são criados aqui. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('R60', 'CID do teste R60') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
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
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.pesar() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
  SELECT p.unidade_id, p.id, c.id, now(), 70, 'manual'
    FROM public.pacientes p JOIN public.conceito c ON c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE private.peso_do_atendimento(p.id) IS NULL $$;
GRANT EXECUTE ON FUNCTION pg_temp.pesar() TO authenticated;
-- o documento lido como superusuário
CREATE FUNCTION pg_temp.doc(p text) RETURNS public.documentos_clinicos LANGUAGE sql SECURITY DEFINER AS $$
  SELECT d FROM public.documentos_clinicos d WHERE d.id = pg_temp.u(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.doc(text) TO authenticated;
INSERT INTO t VALUES ('textos', '{"resumo_clinico":"Dor torácica há 2 horas, troponina positiva, ECG com supra de ST em parede inferior.","condutas":"AAS 300 mg, clopidogrel 300 mg, heparina e monitorização.","motivo":"Necessidade de hemodinâmica, ausente na unidade."}');

-- ── pessoas e unidades do teste ────────────────────────────────────────────
-- origem: a Unidade Teste do seed (gestor …01, médico …02, enfermeira …04,
-- recepção …05); NIR da origem …c7; destino na rede (médico …d2, enfermeira
-- …d4); médico de outra unidade …x2; central …c1
INSERT INTO t VALUES
  ('dest', '21000000-0000-4000-8000-0000000000d1'), ('fora', '21000000-0000-4000-8000-0000000000e1'),
  ('cent', '21000000-0000-4000-8000-0000000000c1'), ('setor_dest', '22000000-0000-4000-8000-0000000000d1'),
  ('setor_fora', '22000000-0000-4000-8000-0000000000e1'),
  ('nir', '10000000-0000-4000-8000-0000000000c7'), ('medd', '10000000-0000-4000-8000-0000000000d2'),
  ('enfd', '10000000-0000-4000-8000-0000000000d4'), ('medx', '10000000-0000-4000-8000-0000000000e2');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(x), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x || '-transf@teste.local', '', now(), '{}', '{}', now(), now()
  FROM unnest(ARRAY['nir', 'medd', 'enfd', 'medx']) x
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  (pg_temp.u('nir'), 'NIR Transferência'), (pg_temp.u('medd'), 'Médica Receptora Teste'),
  (pg_temp.u('enfd'), 'Enfermeira Destino Teste'), (pg_temp.u('medx'), 'Médico de Fora Teste')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET crm = '12345', uf_crm = 'GO' WHERE id = '10000000-0000-4000-8000-000000000002';
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('dest'), '20000000-0000-4000-8000-000000000001', 'Hospital Destino Transferência', 'hospital', '7654321'),
  (pg_temp.u('fora'), '20000000-0000-4000-8000-000000000001', 'Hospital de Fora Transferência', 'hospital', '7654322'),
  (pg_temp.u('cent'), '20000000-0000-4000-8000-000000000001', 'Central Transferência', 'hospital', NULL);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.u('setor_dest'), pg_temp.u('dest'), 'Clínica do destino', 'internacao'),
  (pg_temp.u('setor_fora'), pg_temp.u('fora'), 'Clínica de fora', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('nir'), '21000000-0000-4000-8000-000000000001', 'nir'),
  (pg_temp.u('medd'), pg_temp.u('dest'), 'plantonista'), (pg_temp.u('enfd'), pg_temp.u('dest'), 'enfermeiro'),
  (pg_temp.u('medx'), pg_temp.u('fora'), 'plantonista')
ON CONFLICT DO NOTHING;
-- escala: médico e enfermeira no PS, na Observação e na Clínica Médica; recepção no PS; destino e fora nas suas clínicas
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004']::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360
UNION ALL
SELECT x.un, x.se, x.pe, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.u('dest'), pg_temp.u('setor_dest'), pg_temp.u('medd')), (pg_temp.u('dest'), pg_temp.u('setor_dest'), pg_temp.u('enfd')),
               (pg_temp.u('fora'), pg_temp.u('setor_fora'), pg_temp.u('medx'))) x(un, se, pe);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES
  ('22000000-0000-4000-8000-000000000001', 'TR1', 'clinico'), ('22000000-0000-4000-8000-000000000002', 'Box TR', 'observacao');
INSERT INTO t SELECT 'TR1', id::text FROM public.leitos WHERE identificador = 'TR1' AND setor_id = '22000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
-- medicamentos: haloperidol (controlado C1 pelo gatilho) e dipirona
WITH novos AS (
  INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
    ('Haloperidol', 'haloperidol', 'solução injetável, ampola 1 mL (teste transferência)', '5 mg/mL', 'teste-transferencia'),
    ('Dipirona', 'dipirona', 'ampola 2 mL (teste transferência)', '500 mg/mL', 'teste-transferencia')
  RETURNING id, principio_ativo_norm)
INSERT INTO t SELECT principio_ativo_norm, id::text FROM novos;

-- ── atendimentos: porta (P), observação (O) e internação (I) ───────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep' || x, public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor no peito', NULL,
  json_build_object('nome', 'Paciente Transferência ' || x, 'data_nascimento', (current_date - interval '60 years')::date)::jsonb) ->> 'episodio_id'
  FROM unnest(ARRAY['P', 'O', 'I']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep' || x), 'amarelo',
  '{"frequencia-cardiaca":110,"frequencia-respiratoria":22,"temperatura":36.8,"saturacao-o2":95,"escala-dor":6,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}',
  pg_temp.u('flx'), 'Edema de face')
  FROM unnest(ARRAY['P', 'O', 'I']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep' || x)),
       public.registrar_soap(pg_temp.u('ep' || x), 'Dor no peito', 'Sudorese', 'Síndrome coronariana aguda', 'Monitorar', 'R60')
  FROM unnest(ARRAY['P', 'O', 'I']) x;
SELECT public.registrar_desfecho(pg_temp.u('epO'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('epI'), 'internacao', NULL, json_build_object('setor_id', '22000000-0000-4000-8000-000000000001', 'leito_id', pg_temp.u('TR1'))::jsonb);
RESET ROLE;
INSERT INTO t SELECT x, paciente_id::text FROM public.episodios e, unnest(ARRAY['P', 'O', 'I']) x WHERE e.id = pg_temp.u('ep' || x);
INSERT INTO t SELECT 'i' || x, i.id::text FROM public.internacoes i, unnest(ARRAY['O', 'I']) x WHERE i.episodio_id = pg_temp.u('ep' || x);

-- o quadro de P: alergia, prescrição (com controlado), exame com resultado,
-- dispositivo, isolamento, um sinal vital mais novo que a triagem e a regulação
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_alergia(pg_temp.u('P'), 'Dipirona', 'urticária', 'medicamento', 'grave', pg_temp.u('dipirona'));
SELECT pg_temp.pesar();
INSERT INTO t SELECT 'i_halo', public.prescrever(pg_temp.u('P'), json_build_object('medicamento_id', pg_temp.u('haloperidol'),
  'dose', '5 mg', 'via', 'IM', 'posologia', '8/8h')::jsonb);
INSERT INTO t SELECT 'i_cui', public.prescrever(pg_temp.u('P'), '{"tipo":"cuidado","descricao":"Cabeceira elevada"}');
RESET ROLE;
UPDATE public.observacao SET aferido_em = now() - interval '30 minutes' WHERE episodio_id = pg_temp.u('epP');
INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, valor_num, origem)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('P'), pg_temp.u('epP'), c.id, now(), 132.0, 'manual'
  FROM public.conceito c WHERE c.nome = 'frequencia-cardiaca' AND c.unidade_id IS NULL;
INSERT INTO public.exames_pedidos (id, unidade_id, paciente_id, episodio_id, exame, pedido_por, situacao)
VALUES ('30000000-0000-4000-8000-0000000000e1', '21000000-0000-4000-8000-000000000001', pg_temp.u('P'), pg_temp.u('epP'), 'Troponina',
        '10000000-0000-4000-8000-000000000002', 'resultado');
INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, registrado_por, vigente, liberado_em, conteudo_hash)
VALUES ('30000000-0000-4000-8000-0000000000e1', 1, 'manual', 'Troponina I 2,3 ng/mL', '10000000-0000-4000-8000-000000000002', true, now(), 'h');
INSERT INTO public.dispositivos_enfermagem (unidade_id, paciente_id, episodio_id, tipo, local, calibre, inserido_em, registrado_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('P'), pg_temp.u('epP'), 'Acesso venoso periférico', 'antebraço esquerdo', '20G',
        current_date, '10000000-0000-4000-8000-000000000004');
INSERT INTO public.isolamentos_paciente (unidade_id, paciente_id, episodio_id, tipo, motivo, marcado_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('P'), pg_temp.u('epP'), 'contato', 'Colonização por KPC', '10000000-0000-4000-8000-000000000004');
-- a regulação de P à unidade de destino na rede, autorizada e aceita pela médica de lá
INSERT INTO t VALUES ('rP', '30000000-0000-4000-8000-0000000000f1');
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, episodio_id,
  tipo, procedimento, transporte, destino_tipo, destino_unidade_id, carater, modalidade, prioridade, cid, quadro_clinico,
  solicitante_id, solicitante_papel, status, autorizada_em, destino_enviado_em, externo_sistema, externo_protocolo)
VALUES (pg_temp.u('rP'), '20000000-0000-4000-8000-000000000001', pg_temp.u('cent'), '21000000-0000-4000-8000-000000000001', '1234567',
        pg_temp.u('P'), pg_temp.u('epP'), 'transferencia', '0303060190', 'ambulancia_avancada', 'rede', pg_temp.u('dest'), 'urgencia', '04',
        'urgencia', 'R60', 'Quadro clínico do pedido de teste da transferência.', '10000000-0000-4000-8000-000000000002', 'medico',
        'autorizada', now(), now(), 'SISREG', 'PROTO-7788');
INSERT INTO public.regulacao_destino_respostas (solicitacao_id, destino_tipo, destino_unidade_id, resposta, por, por_registro, em)
VALUES (pg_temp.u('rP'), 'rede', pg_temp.u('dest'), 'aceita', pg_temp.u('medd'), 'CRM 4321/GO', now());

-- ── T2/T3: a fotografia ─────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'dP', public.dados_transferencia(pg_temp.u('P'))::text;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.j('dP') -> 'contexto' ->> 'origem' = 'porta' AND (pg_temp.j('dP') -> 'contexto' ->> 'episodio_id')::uuid = pg_temp.u('epP')
  AND pg_temp.j('dP') -> 'documento' = 'null'::jsonb AND (pg_temp.j('dP') -> 'pode' ->> 'emitir')::boolean
  AND NOT (pg_temp.j('dP') -> 'pode' ->> 'enfermagem')::boolean AND pg_temp.j('dP') -> 'eu' ->> 'registro' = 'CRM 12345/GO',
  'porta: o atendimento é o episódio; o médico pode emitir; o registro sai do cadastro');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'alergias' ->> 'estado' = 'tem'
  AND pg_temp.j('dP') -> 'dados' -> 'alergias' -> 'itens' @> '[{"substancia":"Dipirona","gravidade":"grave","reacao":"urticária"}]',
  'alergias ativas na fotografia');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'sinais_vitais' @> '[{"conceito":"frequencia-cardiaca","valor":"132.0","unidade":"bpm"}]'
  AND NOT pg_temp.j('dP') -> 'dados' -> 'sinais_vitais' @> '[{"conceito":"frequencia-cardiaca","valor":"110"}]'
  AND pg_temp.j('dP') -> 'dados' -> 'sinais_vitais' @> '[{"conceito":"temperatura","valor":"36.8"}]'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('dP') -> 'dados' -> 'sinais_vitais') v WHERE v ? 'flag'),
  'últimos sinais vitais, crus (o valor gravado, sem marca de alterado)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('dP') -> 'dados' -> 'prescricao') x, public.prescricao_itens it
                           WHERE it.id = pg_temp.u('i_halo') AND x ->> 'descricao' = it.descricao
                             AND (x ->> 'valida_ate')::timestamptz = it.valida_ate AND x ->> 'controlado' = 'C1' AND x ->> 'vencido' = 'false')
  AND jsonb_array_length(pg_temp.j('dP') -> 'dados' -> 'prescricao') = 2,
  'prescrição ativa com a validade do item (lacuna 6)');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'controlados' @> '[{"lista":"C1"}]' AND jsonb_array_length(pg_temp.j('dP') -> 'dados' -> 'controlados') = 1,
  'controlados em uso (lista da Portaria 344)');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'exames' @> '[{"exame":"Troponina","situacao":"resultado","resultado":"Troponina I 2,3 ng/mL"}]',
  'exame com o resultado');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'dispositivos' @> '[{"tipo":"Acesso venoso periférico","calibre":"20G"}]'
  AND pg_temp.j('dP') -> 'dados' -> 'isolamento' @> '[{"tipo":"contato"}]' AND pg_temp.j('dP') -> 'dados' -> 'contencao' = '[]'::jsonb,
  'dispositivos, isolamento e contenção (nenhuma)');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'regulacao' @> '{"destino":"Hospital Destino Transferência","transporte":"ambulancia_avancada","protocolo_externo":"PROTO-7788","destino_na_rede":true}'
  AND pg_temp.j('dP') -> 'dados' -> 'regulacao' -> 'aceite' @> '{"por":"Médica Receptora Teste","registro":"CRM 4321/GO"}'
  AND (pg_temp.j('dP') -> 'dados' -> 'regulacao' ->> 'numero') IS NOT NULL,
  'regulação: número, protocolo, destino, aceite e transporte');
SELECT pg_temp.ok(pg_temp.j('dP') -> 'dados' -> 'diagnostico_entrada' @> '{"hipotese":"Síndrome coronariana aguda","cid":"R60"}'
  AND pg_temp.j('dP') -> 'dados' -> 'origem' @> '{"atendimento":"porta","setor":"Pronto Socorro","unidade":"Unidade Teste"}',
  'diagnóstico de entrada e a origem');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('dP') -> 'checklist') = 8
  AND pg_temp.j('dP') -> 'checklist' @> '[{"item":"incubadora","situacao":"nao_se_aplica","automatico":true}]'
  AND pg_temp.j('dP') -> 'checklist' @> '[{"item":"contato_destino","situacao":null}]',
  'checklist: oito itens; incubadora "não se aplica" fora do recém-nascido');

-- ── T6: quem lê o painel ────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok((public.dados_transferencia(pg_temp.u('P')) -> 'pode') = '{"emitir":false,"enfermagem":true}', 'a enfermeira lê e marca os itens dela');
SELECT pg_temp.como(pg_temp.u('nir')::text);
SELECT pg_temp.ok((public.dados_transferencia(pg_temp.u('P')) -> 'pode') = '{"emitir":false,"enfermagem":false}', 'o NIR da unidade lê, sem emitir');
SELECT pg_temp.como(pg_temp.u('medx')::text);
SELECT pg_temp.falha(format('SELECT public.dados_transferencia(%L)', pg_temp.u('P')), 'Acesso negado', 'médico de outra unidade não lê o painel');

-- ── T4/T6: checklist ────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L)', pg_temp.u('P'), 'contato_destino', 'feito'),
  'Contato com o destino: diga o nome de quem aceitou', 'contato com o destino pede o nome de quem aceitou');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'contato_destino', 'feito', 'Dra. Receptora da Silva');
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L, NULL, %L)', pg_temp.u('P'), 'regulacao', 'nao_se_aplica', 'vaga'),
  'Diga por que não se aplica', '"não se aplica" pede o motivo (10 letras)');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'regulacao', 'feito', 'PROTO-7788');
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L, %L)', pg_temp.u('P'), 'autorizacao', 'feito', 'vizinho'),
  'Autorização: diga quem assinou', 'autorização: paciente ou responsável');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'autorizacao', 'nao_se_aplica', NULL, 'Paciente sedado e sem responsável presente.');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'estabilizado', 'feito');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'transporte', 'feito', 'ambulancia_avancada');
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L)', pg_temp.u('P'), 'isolamento_informado', 'feito'),
  'Este item é do enfermeiro', 'o médico não marca item da enfermagem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L, %L)', pg_temp.u('P'), 'contato_destino', 'feito', 'Fulano'),
  'Este item é do médico que transfere', 'a enfermeira não marca item do médico');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'isolamento_informado', 'feito');
SELECT public.marcar_item_transferencia(pg_temp.u('P'), 'acompanhante_equipe', 'feito', 'enfermagem');
INSERT INTO t SELECT 'ckP', public.marcar_item_transferencia(pg_temp.u('P'), 'acompanhante_equipe', 'feito', 'medico_e_enfermagem')::text;
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L)', pg_temp.u('P'), 'incubadora', 'feito'),
  'Incubadora: só no recém-nascido', 'incubadora só no recém-nascido (até 27 dias)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.marcar_item_transferencia(%L, %L, %L)', pg_temp.u('P'), 'isolamento_informado', 'feito'),
  'Este item é do enfermeiro', 'a recepção não marca o checklist');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.j('ckP') @> '[{"item":"contato_destino","situacao":"feito","detalhe":"Dra. Receptora da Silva","por":"Plantonista de Teste"}]'
  AND pg_temp.j('ckP') @> '[{"item":"autorizacao","situacao":"nao_se_aplica","motivo":"Paciente sedado e sem responsável presente."}]'
  AND pg_temp.j('ckP') @> '[{"item":"acompanhante_equipe","situacao":"feito","detalhe":"medico_e_enfermagem","por":"Enfermeira de Teste"}]'
  AND (SELECT count(*) = 7 FROM public.transferencia_checklist WHERE episodio_id = pg_temp.u('epP')),
  'checklist: cada item uma vez (marcar de novo atualiza), com quem marcou');

-- ── T1/T6: emitir ───────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb)', pg_temp.u('P'), pg_temp.j('textos')),
  'O documento de transferência é emitido pelo médico', 'a recepção não emite');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb)', pg_temp.u('P'), pg_temp.j('textos')),
  'O documento de transferência é emitido pelo médico', 'a enfermagem não emite');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb)', pg_temp.u('P'), pg_temp.j('textos') || '{"resumo_clinico":"curto"}'),
  'Escreva o resumo clínico', 'resumo clínico obrigatório');
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb)', pg_temp.u('P'), pg_temp.j('textos') - 'motivo'),
  'Escreva o motivo da transferência', 'motivo da transferência obrigatório');
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L)', pg_temp.u('P'), 'documento_transferencia', '{"formato":"transferencia"}'),
  'Tipo de documento desconhecido', 'emitir_documento não grava documento de transferência (sem a fotografia do servidor)');
SELECT pg_temp.falha(format($q$INSERT INTO public.documentos_clinicos (organizacao_id, unidade_id, paciente_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado, documento_raiz_id, versao)
  VALUES ('20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', %L, 'documento_transferencia', '{}', 'h', '10000000-0000-4000-8000-000000000002', 'ativo', gen_random_uuid(), 1)$q$, pg_temp.u('P')),
  '', 'a tabela não aceita inserção direta pela API');

-- ── T5: porta sem documento é recusada ──────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, NULL, %L::jsonb)', pg_temp.u('epP'), 'transferencia', '{"destino":"Hospital Destino Transferência"}'),
  'Emita o documento de transferência antes de transferir', 'porta: transferência sem documento é recusada');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'atendimento' FROM public.episodios WHERE id = pg_temp.u('epP')), 'porta: o episódio segue em atendimento');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'docP', public.emitir_documento_transferencia(pg_temp.u('P'), pg_temp.j('textos')) ->> 'id';
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb)', pg_temp.u('P'), pg_temp.j('textos')),
  'Já há documento de transferência emitido neste atendimento', 'um documento em vigor por atendimento');
-- depois da emissão, a fotografia do documento não muda
SELECT public.registrar_alergia(pg_temp.u('P'), 'Penicilina', 'edema de glote', 'medicamento', 'grave', NULL);
INSERT INTO t SELECT 'dP2', public.dados_transferencia(pg_temp.u('P'))::text;
INSERT INTO t SELECT 'folhaP', public.folha_documento(pg_temp.u('docP'), 'documento de transferencia')::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.doc('docP')).tipo_documento = 'documento_transferencia' AND (pg_temp.doc('docP')).estado = 'ativo'
  AND (pg_temp.doc('docP')).numero IS NOT NULL AND (pg_temp.doc('docP')).autor_id = '10000000-0000-4000-8000-000000000002'
  AND (pg_temp.doc('docP')).episodio_id = pg_temp.u('epP') AND (pg_temp.doc('docP')).internacao_id IS NULL,
  'documento emitido, numerado, com o login como autor, ligado ao episódio');
SELECT pg_temp.ok((pg_temp.doc('docP')).conteudo::jsonb ->> 'formato' = 'transferencia'
  AND (pg_temp.doc('docP')).conteudo::jsonb -> 'textos' = pg_temp.j('textos')
  AND (pg_temp.doc('docP')).conteudo::jsonb -> 'medico' = '{"nome":"Plantonista de Teste","registro":"CRM 12345/GO"}'
  AND (pg_temp.doc('docP')).conteudo::jsonb -> 'dados' -> 'regulacao' ->> 'protocolo_externo' = 'PROTO-7788'
  AND (pg_temp.doc('docP')).conteudo::jsonb -> 'checklist_na_emissao' @> '[{"item":"estabilizado","situacao":"feito"}]'
  AND (pg_temp.doc('docP')).conteudo_hash = encode(extensions.digest(convert_to((pg_temp.doc('docP')).conteudo, 'UTF8'), 'sha256'), 'hex'),
  'o conteúdo guarda a fotografia, os três textos, o médico com o CRM e o checklist da emissão');
SELECT pg_temp.ok(NOT ((pg_temp.doc('docP')).conteudo::jsonb -> 'dados' -> 'alergias' -> 'itens' @> '[{"substancia":"Penicilina"}]')
  AND pg_temp.j('dP2') -> 'dados' -> 'alergias' -> 'itens' @> '[{"substancia":"Penicilina"}]'
  AND (pg_temp.j('dP2') -> 'documento' ->> 'id')::uuid = pg_temp.u('docP') AND (pg_temp.j('dP2') -> 'documento' ->> 'meu')::boolean,
  'fotografia: o documento não muda; o painel mostra o quadro de agora e o documento emitido');
SELECT pg_temp.ok(pg_temp.j('folhaP') ->> 'tipo' = 'documento_transferencia' AND jsonb_array_length(pg_temp.j('folhaP') -> 'estruturado' -> 'checklist_atual') = 8
  AND pg_temp.j('folhaP') ->> 'autor_registro' = 'CRM 12345/GO'
  AND EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE documento_id = pg_temp.u('docP') AND tipo_acesso = 'impressao'),
  'T8: a folha leva o checklist do momento e a impressão fica registrada');

-- ── T9: Regulação, NIR e destino ────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((public.transferencia_da_regulacao(pg_temp.u('rP')) -> 'documento' ->> 'id')::uuid = pg_temp.u('docP'), 'a origem lê pela regulação');
SELECT pg_temp.como(pg_temp.u('nir')::text);
SELECT pg_temp.ok((public.transferencia_da_regulacao(pg_temp.u('rP')) -> 'documento' -> 'conteudo' ->> 'formato') = 'transferencia', 'o NIR da origem lê');
SELECT pg_temp.como(pg_temp.u('medd')::text);
INSERT INTO t SELECT 'lidoD', public.transferencia_da_regulacao(pg_temp.u('rP'))::text;
SELECT pg_temp.ok((pg_temp.j('lidoD') -> 'documento' ->> 'id')::uuid = pg_temp.u('docP') AND NOT (pg_temp.j('lidoD') -> 'documento') ? 'meu'
  AND jsonb_array_length(pg_temp.j('lidoD') -> 'checklist') = 8, 'a médica do destino na rede lê o documento e o checklist');
SELECT pg_temp.como(pg_temp.u('enfd')::text);
SELECT pg_temp.ok((public.transferencia_da_regulacao(pg_temp.u('rP')) -> 'documento' ->> 'numero') IS NOT NULL, 'a enfermagem de plantão no destino lê, enquanto o paciente chega');
SELECT pg_temp.como(pg_temp.u('medx')::text);
SELECT pg_temp.falha(format('SELECT public.transferencia_da_regulacao(%L)', pg_temp.u('rP')), 'Acesso negado', 'médico de outra unidade não lê');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.transferencia_da_regulacao(%L)', pg_temp.u('rP')), 'Acesso negado', 'a recepção não lê pela regulação');
RESET ROLE;

-- ── T5: a porta transfere com o documento ───────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('epP'), 'transferencia', NULL, '{"destino":"Hospital Destino Transferência"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND desfecho = 'transferencia' FROM public.episodios WHERE id = pg_temp.u('epP')),
  'porta: com o documento emitido, a transferência passa');
-- depois da saída, o destino segue lendo; cancelada a regulação, o destino deixa de ler
UPDATE public.regulacao_solicitacoes SET status = 'cancelada', cancelada_em = now(), cancelada_por = '10000000-0000-4000-8000-000000000002',
  cancelamento_origem = 'solicitante', motivo_cancelamento = 'Cancelada no teste da transferência' WHERE id = pg_temp.u('rP');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('medd')::text);
SELECT pg_temp.falha(format('SELECT public.transferencia_da_regulacao(%L)', pg_temp.u('rP')), 'Acesso negado', 'regulação cancelada: o destino não lê mais');
RESET ROLE;

-- ── T5: observação (finalizar_observacao → dar_alta) ────────────────────────
-- O vira recém-nascido para o item da incubadora
UPDATE public.pacientes SET data_nascimento = (now() AT TIME ZONE 'America/Sao_Paulo')::date - 10 WHERE id = pg_temp.u('O');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.finalizar_observacao(%L, %L, %L, NULL, %L::jsonb)', pg_temp.u('iO'), 'transferencia', 'R60', '{"destino":"Hospital de Referência"}'),
  'Emita o documento de transferência antes de transferir', 'observação: transferência sem documento é recusada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.marcar_item_transferencia(pg_temp.u('O'), 'incubadora', 'feito');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'dO', public.dados_transferencia(pg_temp.u('O'))::text;
INSERT INTO t SELECT 'docO', public.emitir_documento_transferencia(pg_temp.u('O'), pg_temp.j('textos')) ->> 'id';
SELECT public.finalizar_observacao(pg_temp.u('iO'), 'transferencia', 'R60', NULL, '{"destino":"Hospital de Referência"}');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.j('dO') -> 'contexto' ->> 'origem' = 'observacao' AND (pg_temp.j('dO') -> 'contexto' ->> 'internacao_id')::uuid = pg_temp.u('iO')
  AND (pg_temp.j('dO') ->> 'neonato')::boolean AND pg_temp.j('dO') -> 'checklist' @> '[{"item":"incubadora","situacao":"feito"}]'
  AND (SELECT count(*) = 1 FROM public.transferencia_checklist WHERE internacao_id = pg_temp.u('iO') AND item = 'incubadora'),
  'observação: o atendimento é a internação; recém-nascido marca a incubadora');
SELECT pg_temp.ok((pg_temp.doc('docO')).internacao_id = pg_temp.u('iO')
  AND (SELECT status = 'transferencia_externa' AND alta_detalhes ->> 'destino' = 'Hospital de Referência' FROM public.internacoes WHERE id = pg_temp.u('iO')),
  'observação: com o documento, a transferência passa');

-- ── T5: internação (dar_alta); nova versão e cancelamento ──────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L, NULL, NULL, NULL, %L::jsonb)', pg_temp.u('iI'), 'transferencia_externa', 'R60', '{"destino":"Hospital de Referência"}'),
  'Emita o documento de transferência antes de transferir', 'internação: transferência sem documento é recusada');
INSERT INTO t SELECT 'docI1', public.emitir_documento_transferencia(pg_temp.u('I'), pg_temp.j('textos')) ->> 'id';
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb, %L, %L)', pg_temp.u('I'), pg_temp.j('textos'), pg_temp.u('docI1'), 'curto'),
  'Informe o motivo da nova versão', 'nova versão pede o motivo');
INSERT INTO t SELECT 'docI2', public.emitir_documento_transferencia(pg_temp.u('I'), pg_temp.j('textos') || '{"condutas":"AAS, clopidogrel, heparina e nitrato."}',
  pg_temp.u('docI1'), 'Conduta completada antes da saída') ->> 'id';
RESET ROLE;
SELECT pg_temp.ok((pg_temp.doc('docI1')).estado = 'retificado' AND (pg_temp.doc('docI2')).versao = 2
  AND (pg_temp.doc('docI2')).documento_raiz_id = (pg_temp.doc('docI1')).documento_raiz_id AND (pg_temp.doc('docI2')).internacao_id = pg_temp.u('iI'),
  'nova versão: a anterior fica substituída, a nova vale');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.cancelar_documento(pg_temp.u('docI2'), 'Emitido para o paciente errado, refazer.');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L, NULL, NULL, NULL, %L::jsonb)', pg_temp.u('iI'), 'transferencia_externa', 'R60', '{"destino":"Hospital de Referência"}'),
  'Emita o documento de transferência antes de transferir', 'documento cancelado não conta para a trava');
INSERT INTO t SELECT 'docI3', public.emitir_documento_transferencia(pg_temp.u('I'), pg_temp.j('textos')) ->> 'id';
SELECT public.dar_alta(pg_temp.u('iI'), 'transferencia_externa', 'R60', NULL, NULL, NULL, '{"destino":"Hospital de Referência"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'transferencia_externa' FROM public.internacoes WHERE id = pg_temp.u('iI'))
  AND (pg_temp.doc('docI3')).versao = 1 AND (pg_temp.doc('docI2')).estado = 'cancelado',
  'internação: com o documento novo em vigor, a transferência passa');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.emitir_documento_transferencia(%L, %L::jsonb)', pg_temp.u('I'), pg_temp.j('textos')),
  'O paciente não está em atendimento', 'depois da saída não se emite (sem atendimento aberto)');
RESET ROLE;

-- ── privilégios ─────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.transferencia_checklist'::regclass)
  AND NOT has_table_privilege('authenticated', 'public.transferencia_checklist', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.transferencia_checklist', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.transferencia_checklist', 'INSERT'),
  'checklist: RLS ligado e sem acesso direto (só pelas RPCs)');
SELECT pg_temp.ok(bool_and(NOT has_function_privilege('anon', f, 'EXECUTE') AND has_function_privilege('authenticated', f, 'EXECUTE')
                           AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure)),
  'RPCs: SECURITY DEFINER, search_path vazio; anon não executa, authenticated sim')
  FROM unnest(ARRAY['public.dados_transferencia(uuid)', 'public.emitir_documento_transferencia(uuid, jsonb, uuid, text)',
                    'public.marcar_item_transferencia(uuid, text, text, text, text)', 'public.transferencia_da_regulacao(uuid)']) f;
SELECT pg_temp.ok(bool_and(NOT has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')),
  'funções private: ninguém de fora executa')
  FROM unnest(ARRAY['private.transferencia_dados(uuid, uuid, uuid, text, uuid, uuid, timestamptz)', 'private.transferencia_contexto(uuid)',
                    'private.transferencia_documento_emitido(uuid, uuid)', 'private.transferencia_checklist_json(uuid, uuid, uuid)']) f;
SET LOCAL ROLE anon;
SELECT pg_temp.falha(format('SELECT public.dados_transferencia(%L)', pg_temp.u('P')), 'permission denied', 'anon não executa');
RESET ROLE;

-- ── auditoria sem dado de pessoa ────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) >= 8 FROM public.log_auditoria WHERE acao = 'transferencia_checklist')
  AND (SELECT count(*) >= 5 FROM public.log_auditoria WHERE acao IN ('emitir_documento', 'retificar_documento') AND payload ->> 'tipo' = 'documento_transferencia')
  AND (SELECT count(*) >= 3 FROM public.log_auditoria WHERE acao = 'ler_documento_transferencia')
  AND NOT EXISTS (SELECT 1 FROM public.log_auditoria
                   WHERE acao IN ('transferencia_checklist', 'emitir_documento', 'retificar_documento', 'ler_documento_transferencia')
                     AND (payload::text LIKE '%Receptora%' OR payload::text LIKE '%sedado%' OR payload::text LIKE '%Paciente Transferência%'
                          OR payload::text LIKE '%Troponina%' OR payload::text LIKE '%hemodinâmica%')),
  'auditoria: só códigos (sem nome de quem aceitou, motivo, paciente ou texto clínico)');

ROLLBACK;
