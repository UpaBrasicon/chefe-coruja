-- Testes da migration 20270326000001_obito.sql (lacuna 5 do Portão de
-- 11/10/2026; decisão do RT em 10/11/2026: A em O1 a O8).
--  O1. porta, observação e internação gravam o mesmo registro em
--      public.obitos; tipo de morte obrigatório; D.O. de 9 dígitos; termo
--      vago vira aviso; o jsonb do desfecho e da alta segue com hora e número;
--  O2. o Sumário de óbito sai sozinho, com a frase de registro do prontuário;
--  O3. violenta ou suspeita: sem D.O. da unidade, comunicação à polícia; sem
--      assistência: SVO ou "causa da morte desconhecida";
--  O4. família: médico e enfermeiro registram, a recepção não; a auditoria
--      não leva nome nem parentesco;
--  O5. o leito fica "aguardando liberação do corpo" até a liberação e então
--      vai para a higienização; identificação antes da liberação; destino
--      conforme o caminho; vias e D.O. anulada;
--  O6. papéis de cada ação;
--  O7. linha do tempo (prontuario_leitura) e lista de pendências;
--  O8. cancelar_alta anula óbito, comunicação e sumário e devolve o leito;
--  privilégios: tabelas sem leitura direta; anon não executa.
-- O técnico de enfermagem é o perfil …00c5, criado aqui. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-0000000000c5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'tecnico-obito@teste.local', '', now(), '{}', '{"nome_completo":"Técnico Óbito"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000c5', 'Técnico Óbito') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000c5', '21000000-0000-4000-8000-000000000001', 'tecnico_enfermagem') ON CONFLICT DO NOTHING;
-- médico, enfermeira e técnico no PS, na Observação e na Clínica Médica; recepção no PS
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-0000000000c5', '10000000-0000-4000-8000-000000000006');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-0000000000c5']::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
-- leitos deste teste: dois na Clínica Médica e um box na Observação
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES
  ('22000000-0000-4000-8000-000000000001', 'OB1', 'clinico'),
  ('22000000-0000-4000-8000-000000000001', 'OB2', 'clinico'),
  ('22000000-0000-4000-8000-000000000002', 'Box OB', 'observacao');

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
-- o óbito vigente do paciente, lido como superusuário
CREATE FUNCTION pg_temp.ob(p text) RETURNS public.obitos LANGUAGE sql SECURITY DEFINER AS $$
  SELECT o FROM public.obitos o WHERE o.paciente_id = pg_temp.u(p) ORDER BY o.registrado_em DESC LIMIT 1 $$;
CREATE FUNCTION pg_temp.leito(p text) RETURNS public.leitos LANGUAGE sql SECURITY DEFINER AS $$
  SELECT l FROM public.leitos l WHERE l.identificador = p AND l.setor_id IN ('22000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002') $$;
GRANT EXECUTE ON FUNCTION pg_temp.ob(text), pg_temp.leito(text) TO authenticated;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
INSERT INTO t SELECT 'OB1', id::text FROM public.leitos WHERE identificador = 'OB1' AND setor_id = '22000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'OB2', id::text FROM public.leitos WHERE identificador = 'OB2' AND setor_id = '22000000-0000-4000-8000-000000000001';
-- os mesmos dados do óbito nas três portas de entrada (termo vago na linha a)
INSERT INTO t VALUES ('obito', '{"tipo_morte":"natural_assistida","atestado_condicao":"substituto","causa_a":"Parada cardiorrespiratória","causa_b":"Infarto agudo do miocárdio","causa_c":"Doença aterosclerótica coronariana","parte2":"Diabetes mellitus tipo 2"}');

-- ── cadastros: porta (P), observação (O), internação (I1 e I2) ─────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep' || x, public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor no peito', NULL,
  json_build_object('nome', 'Paciente Óbito ' || x, 'data_nascimento', (current_date - interval '70 years')::date)::jsonb) ->> 'episodio_id'
  FROM unnest(ARRAY['P', 'O', 'I1', 'I2']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep' || x), 'amarelo',
  '{"frequencia-cardiaca":110,"frequencia-respiratoria":22,"temperatura":36.8,"saturacao-o2":95,"escala-dor":6,"pressao-arterial-sistolica":100,"pressao-arterial-diastolica":60}',
  pg_temp.u('flx'), 'Edema de face')
  FROM unnest(ARRAY['P', 'O', 'I1', 'I2']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep' || x)),
       public.registrar_soap(pg_temp.u('ep' || x), 'Dor no peito', 'Sudorese', 'Síndrome coronariana aguda', 'Monitorar', 'R60')
  FROM unnest(ARRAY['P', 'O', 'I1', 'I2']) x;
SELECT public.registrar_desfecho(pg_temp.u('epO'), 'observacao');
SELECT public.registrar_desfecho(pg_temp.u('epI1'), 'internacao', NULL, json_build_object('setor_id', '22000000-0000-4000-8000-000000000001', 'leito_id', pg_temp.u('OB1'))::jsonb);
SELECT public.registrar_desfecho(pg_temp.u('epI2'), 'internacao', NULL, json_build_object('setor_id', '22000000-0000-4000-8000-000000000001', 'leito_id', pg_temp.u('OB2'))::jsonb);
RESET ROLE;
INSERT INTO t SELECT x, paciente_id::text FROM public.episodios e, unnest(ARRAY['P', 'O', 'I1', 'I2']) x WHERE e.id = pg_temp.u('ep' || x);
INSERT INTO t SELECT 'i' || x, i.id::text FROM public.internacoes i, unnest(ARRAY['O', 'I1', 'I2']) x WHERE i.episodio_id = pg_temp.u('ep' || x);
INSERT INTO t SELECT 'box', leito_atual_id::text FROM public.internacoes WHERE id = pg_temp.u('iO');
SELECT pg_temp.ok(pg_temp.u('box') IS NOT NULL AND (SELECT status = 'ocupado' FROM public.leitos WHERE id = pg_temp.u('box'))
  AND (pg_temp.leito('OB1')).status = 'ocupado' AND (pg_temp.leito('OB2')).status = 'ocupado', 'observação no box; internações em OB1 e OB2');

-- ── O1/O3: o validador (porta) ─────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '123456789', 'cid_obito', 'I46.9')),
  'Óbito: escolha o tipo de morte', 'o formato antigo (só o número) é recusado: falta o tipo de morte');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '12345678', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito'))),
  'Óbito: o número da Declaração de Óbito tem 9 dígitos', 'D.O. com 8 dígitos é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '1234567890', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito'))),
  'Óbito: o número da Declaração de Óbito tem 9 dígitos', 'D.O. com 10 dígitos é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now() - interval '1 hour', 'numero_do', '123456789', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito'))),
  'Hora do óbito antes da entrada', 'hora do óbito antes da chegada');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now() + interval '1 hour', 'numero_do', '123456789', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito'))),
  'Hora do óbito no futuro', 'hora do óbito no futuro');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '123456789', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito') - 'atestado_condicao')),
  'Óbito: diga se você atesta como médico assistente ou como substituto', 'natural com assistência: condição do atestante');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '123456789', 'cid_obito', 'I46.9', 'obito', pg_temp.j('obito') - 'causa_a')),
  'Óbito: escreva na linha a da Parte I', 'natural com assistência: linha a da Parte I');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'cid_obito', 'I46.9', 'obito', '{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer"}'::jsonb)),
  'Óbito sem assistência ou a esclarecer: diga se o corpo vai ao SVO', 'sem assistência: SVO ou causa desconhecida');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '123456789', 'cid_obito', 'I46.9', 'obito', '{"tipo_morte":"violenta_ou_suspeita"}'::jsonb)),
  'Morte violenta ou suspeita: a D.O. é emitida pelo IML', 'violenta: a unidade não emite D.O.');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '123456789', 'obito', pg_temp.j('obito'))),
  'Óbito: informe o CID do óbito', 'a porta continua pedindo o CID do óbito (CID interno)');
-- a tela confere sem gravar
INSERT INTO t SELECT 'conf1', public.conferir_obito(json_build_object('hora_obito', now(), 'numero_do', '123456789', 'obito', pg_temp.j('obito'))::jsonb)::text;
INSERT INTO t SELECT 'conf2', public.conferir_obito('{"hora_obito":"2026-01-01T10:00:00Z","obito":{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer","encaminhamento":"svo"}}', now())::text;
INSERT INTO t SELECT 'conf3', public.conferir_obito('{"hora_obito":"2026-01-01T10:00:00Z","obito":{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer","encaminhamento":"causa_desconhecida","atestado_condicao":"substituto","parte2":"Falência múltipla dos órgãos (sic)"}}')::text;
INSERT INTO t SELECT 'conf4', public.conferir_obito('{"hora_obito":"2026-01-01T10:00:00Z","obito":{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer","encaminhamento":"svo"}}')::text;
INSERT INTO t SELECT 'conf5', public.conferir_obito('{"hora_obito":"2026-01-01T10:00:00Z","numero_do":"123456789","obito":{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer","encaminhamento":"svo"}}')::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.j('conf1') ->> 'ok')::boolean AND jsonb_array_length(pg_temp.j('conf1') -> 'avisos') = 1
  AND pg_temp.j('conf1') -> 'avisos' ->> 0 LIKE 'linha a: "parada cardiorrespiratória"%',
  'termo vago (MS/CFM 2009) vira aviso, não bloqueio');
SELECT pg_temp.ok(NOT (pg_temp.j('conf2') ->> 'ok')::boolean AND pg_temp.j('conf2') ->> 'erro' = 'Hora do óbito antes da entrada.',
  'conferir_obito devolve o erro sem gravar');
SELECT pg_temp.ok((pg_temp.j('conf3') ->> 'ok')::boolean IS FALSE AND pg_temp.j('conf3') ->> 'erro' LIKE 'Óbito: o número da Declaração de Óbito tem 9 dígitos%',
  'sem SVO ("causa da morte desconhecida"): a unidade emite a D.O. e o número é pedido');
SELECT pg_temp.ok((pg_temp.j('conf4') ->> 'ok')::boolean AND pg_temp.j('conf4') ->> 'encaminhamento' = 'svo',
  'SVO: sem número da D.O. da unidade');
SELECT pg_temp.ok(NOT (pg_temp.j('conf5') ->> 'ok')::boolean AND pg_temp.j('conf5') ->> 'erro' LIKE 'Óbito encaminhado ao SVO: a D.O. é emitida pelo SVO%',
  'SVO com número da D.O. é recusado');
SELECT pg_temp.ok(private.obito_validado('{"hora_obito":"2026-01-01T10:00:00Z","numero_do":"123456789","obito":{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer","encaminhamento":"causa_desconhecida","atestado_condicao":"substituto","causa_a":"outra coisa","parte2":"Falência múltipla dos órgãos (sic)"}}', NULL)
    @> '{"causa_a":"Causa da morte desconhecida","encaminhamento":"causa_desconhecida"}'
  AND jsonb_array_length(private.obito_validado('{"hora_obito":"2026-01-01T10:00:00Z","numero_do":"123456789","obito":{"tipo_morte":"natural_sem_assistencia_ou_a_esclarecer","encaminhamento":"causa_desconhecida","atestado_condicao":"substituto","parte2":"Falência múltipla dos órgãos (sic)"}}', NULL) -> 'avisos') = 1,
  'sem SVO: a Parte I leva "causa da morte desconhecida"; Parte II com termo vago avisa');
SELECT pg_temp.ok(private.obito_termos_vagos('PCR. Parada cardíaca e parada respiratória; falência de múltiplos órgãos')
                  = ARRAY['parada cardíaca', 'parada respiratória', 'falência de múltiplos órgãos']
  AND private.obito_termos_vagos('Choque séptico') = '{}', 'só os termos citados na fonte');

-- ── O1/O2: porta ───────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('epP'), 'obito', 'PCR refratária após 40 minutos de RCP',
  json_build_object('hora_obito', now(), 'numero_do', '100.000.001', 'cid_obito', 'i469', 'obito', pg_temp.j('obito'))::jsonb);
RESET ROLE;
SELECT pg_temp.ok((SELECT e.desfecho = 'obito' AND e.desfecho_detalhes ->> 'numero_do' = '100000001' AND e.desfecho_detalhes ->> 'cid_obito' = 'I46.9'
                          AND e.desfecho_detalhes ->> 'hora_obito' IS NOT NULL AND (e.desfecho_detalhes ->> 'obito_id')::uuid = (pg_temp.ob('P')).id
                          AND e.desfecho_detalhes ->> 'tipo_morte' = 'natural_assistida' AND NOT e.desfecho_detalhes ? 'obito'
                     FROM public.episodios e WHERE e.id = pg_temp.u('epP')),
  'porta: desfecho_detalhes como antes (hora, número, CID do óbito) e com o obito_id');
SELECT pg_temp.ok((pg_temp.ob('P')).origem = 'porta' AND (pg_temp.ob('P')).leito_id IS NULL AND (pg_temp.ob('P')).cid_interno = 'I46.9'
  AND (pg_temp.ob('P')).atestado_por = '10000000-0000-4000-8000-000000000002' AND cardinality((pg_temp.ob('P')).avisos) = 1
  AND (pg_temp.ob('P')).relato = 'PCR refratária após 40 minutos de RCP', 'porta: registro com atestante (o login), CID interno e o aviso gravado');
SELECT pg_temp.ok((SELECT d.tipo_documento = 'sumario_obito' AND d.estado = 'ativo' AND d.episodio_id = pg_temp.u('epP')
                          AND d.conteudo::jsonb ->> 'aviso' = 'Registro para o prontuário. A Declaração de Óbito é o formulário oficial do Ministério da Saúde.'
                          AND d.conteudo::jsonb ->> 'formato' = 'obito' AND d.conteudo::jsonb -> 'causas' ->> 'b' = 'Infarto agudo do miocárdio'
                     FROM public.documentos_clinicos d WHERE d.id = (pg_temp.ob('P')).documento_id),
  'O2: o Sumário de óbito sai sozinho, com a frase de registro do prontuário');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, %L, %L::jsonb)', pg_temp.u('epI2'), 'obito', 'x', '{}'),
  'O episódio não está em atendimento', 'o episódio internado não registra óbito pela porta');

-- ── O1: observação (finalizar_observacao → dar_alta) ──────────────────────
SELECT public.finalizar_observacao(pg_temp.u('iO'), 'obito', 'I46.9', 'Parada cardiorrespiratória sem resposta à RCP',
  json_build_object('numero_do', '100000002', 'hora_obito', now(), 'obito', pg_temp.j('obito'))::jsonb);
-- ── O1: internação (dar_alta) ──────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L, NULL, NULL, %L, %L::jsonb)', pg_temp.u('iI1'), 'obito', 'I46.9', 'Óbito na enfermaria',
  json_build_object('numero_do', '100000001', 'hora_obito', now(), 'obito', pg_temp.j('obito'))),
  'Óbito: este número de Declaração de Óbito já está em outro registro', 'o número da D.O. não se repete');
SELECT public.dar_alta(pg_temp.u('iI1'), 'obito', 'I46.9', NULL, NULL, 'Óbito na enfermaria após PCR',
  json_build_object('numero_do', '100000003', 'obito', pg_temp.j('obito'))::jsonb);
RESET ROLE;
SELECT pg_temp.ok((SELECT count(DISTINCT (o.tipo_morte, o.encaminhamento, o.causa_a, o.causa_b, o.causa_c, o.causa_d, o.parte2,
                                          o.atestado_condicao, o.atestado_por, o.avisos, o.cid_interno)) = 1
                          AND count(*) = 3 AND array_agg(o.origem ORDER BY o.origem) = ARRAY['internacao', 'observacao', 'porta']
                     FROM public.obitos o WHERE o.paciente_id IN (pg_temp.u('P'), pg_temp.u('O'), pg_temp.u('I1'))),
  'O1: as três portas de entrada gravam o mesmo registro');
SELECT pg_temp.ok((SELECT i.status = 'obito' AND i.alta_detalhes ->> 'numero_do' = '100000002' AND i.alta_detalhes ->> 'hora_obito' IS NOT NULL
                          AND i.alta_detalhes ->> 'desfecho_observacao' = 'obito' AND (i.alta_detalhes ->> 'obito_id')::uuid = (pg_temp.ob('O')).id
                     FROM public.internacoes i WHERE i.id = pg_temp.u('iO'))
  AND (SELECT (i.alta_detalhes ->> 'obito_id')::uuid = (pg_temp.ob('I1')).id AND i.alta_detalhes ->> 'hora_obito' IS NOT NULL
         FROM public.internacoes i WHERE i.id = pg_temp.u('iI1')),
  'observação e internação: alta_detalhes como antes, com o obito_id; sem hora, vale a da alta');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.documentos_clinicos d WHERE d.tipo_documento = 'sumario_obito' AND d.estado = 'ativo'
                     AND d.id IN ((pg_temp.ob('O')).documento_id, (pg_temp.ob('I1')).documento_id)
                     AND d.internacao_id IN (pg_temp.u('iO'), pg_temp.u('iI1'))),
  'O2: o sumário da observação e da internação fica ligado à internação');

-- ── O5: o leito espera a liberação do corpo ────────────────────────────────
SELECT pg_temp.ok((SELECT status = 'ocupado' AND obito_aguardando_id = (pg_temp.ob('O')).id FROM public.leitos WHERE id = pg_temp.u('box'))
  AND (pg_temp.leito('OB1')).status = 'ocupado' AND (pg_temp.leito('OB1')).obito_aguardando_id = (pg_temp.ob('I1')).id
  AND (SELECT leito_atual_id IS NULL FROM public.internacoes WHERE id = pg_temp.u('iI1'))
  AND EXISTS (SELECT 1 FROM public.eventos_leito WHERE leito_id = pg_temp.u('OB1') AND tipo_evento = 'aguardando_corpo'),
  'O5: o leito do óbito fica ocupado, "aguardando liberação do corpo" (não vai para a higienização)');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok((SELECT status = 'ocupado' AND motivo = 'aguardando_corpo' FROM public.situacao_leitos('21000000-0000-4000-8000-000000000001') WHERE leito_id = pg_temp.u('OB1')),
  'situacao_leitos mostra o leito aguardando o corpo');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.leitos_para_ocupar('22000000-0000-4000-8000-000000000001', NULL) WHERE id = pg_temp.u('OB1')),
  'o leito aguardando o corpo não aparece para ocupar');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.liberar_leito_sem_paciente(%L, %L)', pg_temp.u('OB1'), 'Leito sem paciente no mapa'),
  'Leito OB1 aguarda a liberação do corpo', 'o gestor não libera "sem paciente" o leito que espera o corpo');
INSERT INTO t SELECT 'mapa', public.mapa_leitos_gestor('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('mapa') -> 'setores') s, jsonb_array_elements(s -> 'leitos') l
                           WHERE (l ->> 'id')::uuid = pg_temp.u('OB1') AND (l ->> 'aguardando_corpo')::boolean AND (l ->> 'ocupado')::boolean),
  'o mapa do gestor conta o leito como ocupado e marca o corpo');
RESET ROLE;

-- ── O4/O6: comunicação à família ───────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.comunicar_obito_familia(%L, %L::jsonb)', (pg_temp.ob('O')).id,
  '{"destinatario_nome":"Maria Familiar","parentesco":"filha","meio":"presencial"}'),
  'A comunicação do óbito à família é registrada pelo médico ou pelo enfermeiro', 'recepção não registra a comunicação à família');
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c5');
SELECT pg_temp.falha(format('SELECT public.comunicar_obito_familia(%L, %L::jsonb)', (pg_temp.ob('O')).id,
  '{"destinatario_nome":"Maria Familiar","parentesco":"filha","meio":"presencial"}'),
  'A comunicação do óbito à família é registrada pelo médico ou pelo enfermeiro', 'técnico de enfermagem não registra a comunicação à família');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.comunicar_obito_familia(%L, %L::jsonb)', (pg_temp.ob('O')).id,
  '{"destinatario_nome":"Maria Familiar","parentesco":"filha","meio":"carta"}'),
  'Diga como foi a comunicação', 'meio fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.comunicar_obito_familia(%L, %L::jsonb)', (pg_temp.ob('O')).id,
  json_build_object('destinatario_nome', 'Maria Familiar', 'parentesco', 'filha', 'meio', 'telefone', 'comunicado_em', now() - interval '1 hour')),
  'Comunicação à família: hora antes do óbito', 'comunicação antes do óbito é recusada');
INSERT INTO t SELECT 'comO', public.comunicar_obito_familia((pg_temp.ob('O')).id,
  '{"destinatario_nome":"Maria Familiar","parentesco":"filha","meio":"presencial","testemunha":"Técnica Ana"}');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'comI1', public.comunicar_obito_familia((pg_temp.ob('I1')).id,
  '{"destinatario_nome":"João Familiar","parentesco":"irmão","meio":"telefone"}');
INSERT INTO t SELECT 'telaO', public.obito_do_paciente(pg_temp.u('O'))::text;
RESET ROLE;
SELECT pg_temp.ok((SELECT papel = 'enfermeiro' AND meio = 'presencial' AND testemunha = 'Técnica Ana' FROM public.obito_comunicacoes WHERE id = pg_temp.u('comO'))
  AND (SELECT papel = 'plantonista' AND meio = 'telefone' FROM public.obito_comunicacoes WHERE id = pg_temp.u('comI1')),
  'O4: enfermeiro e médico registram a comunicação à família');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('telaO') -> 'obito' -> 'comunicacoes') = 1
  AND pg_temp.j('telaO') -> 'obito' -> 'comunicacoes' -> 0 ->> 'destinatario_nome' = 'Maria Familiar'
  AND (pg_temp.j('telaO') -> 'obito' ->> 'comunicada_familia')::boolean
  AND NOT (pg_temp.j('telaO') -> 'obito' -> 'pendencias') ? 'comunicacao_familia'
  AND (pg_temp.j('telaO') -> 'obito' -> 'pendencias') ? 'liberacao'
  AND (pg_temp.j('telaO') -> 'obito' -> 'pode' ->> 'anular_do')::boolean,
  'a tela lê o óbito com a comunicação, as pendências e o que o médico pode fazer');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.log_auditoria
                               WHERE entidade_id IN ((pg_temp.ob('O')).id, (pg_temp.ob('I1')).id, (pg_temp.ob('P')).id)
                                 AND (payload::text LIKE '%Familiar%' OR payload::text LIKE '%filha%' OR payload::text LIKE '%Paciente Óbito%'
                                      OR payload::text LIKE '%cardiorrespirat%' OR payload ? 'destinatario_nome'))
  AND (SELECT count(*) >= 2 FROM public.log_auditoria WHERE acao = 'obito_comunicado_familia'
         AND entidade_id IN ((pg_temp.ob('O')).id, (pg_temp.ob('I1')).id)),
  'auditoria do óbito e da comunicação sem nome, parentesco nem causa');

-- ── O8: cancelar a alta desfaz o óbito (I1) ────────────────────────────────
INSERT INTO t SELECT 'obI1', (pg_temp.ob('I1')).id::text;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.cancelar_alta(pg_temp.u('iI1'), 'Óbito registrado no paciente errado');
RESET ROLE;
SELECT pg_temp.ok((SELECT anulado_em IS NOT NULL AND anulado_por = '10000000-0000-4000-8000-000000000002'
                          AND motivo_anulacao = 'Óbito registrado no paciente errado' FROM public.obitos WHERE id = pg_temp.u('obI1'))
  AND (SELECT anulado_em IS NOT NULL FROM public.obito_comunicacoes WHERE id = pg_temp.u('comI1'))
  AND (SELECT d.estado = 'cancelado' AND d.motivo_cancelamento LIKE 'Óbito desfeito%' FROM public.documentos_clinicos d
        WHERE d.id = (SELECT documento_id FROM public.obitos WHERE id = pg_temp.u('obI1'))),
  'O8: óbito, comunicação e sumário ficam anulados (nada é apagado)');
SELECT pg_temp.ok((SELECT status = 'internado' AND leito_atual_id = pg_temp.u('OB1') AND data_alta IS NULL FROM public.internacoes WHERE id = pg_temp.u('iI1'))
  AND (pg_temp.leito('OB1')).status = 'ocupado' AND (pg_temp.leito('OB1')).obito_aguardando_id IS NULL,
  'O8: o paciente volta ao leito que esperava o corpo, sem a marca');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.obitos WHERE paciente_id = pg_temp.u('I1') AND anulado_em IS NULL),
  'o paciente fica sem óbito vigente');

-- ── O3/O5/O6: morte violenta (I2) ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.dar_alta(%L, %L, %L, NULL, NULL, %L, %L::jsonb)', pg_temp.u('iI2'), 'obito', 'I46.9', 'Óbito após trauma',
  '{"numero_do":"100000004","obito":{"tipo_morte":"violenta_ou_suspeita"}}'),
  'Morte violenta ou suspeita: a D.O. é emitida pelo IML', 'violenta pela internação: sem D.O. da unidade');
SELECT public.dar_alta(pg_temp.u('iI2'), 'obito', 'I46.9', NULL, NULL, 'Óbito após trauma',
  '{"obito":{"tipo_morte":"violenta_ou_suspeita","causa_a":"Ferimento por projétil de arma de fogo no tórax"}}');
RESET ROLE;
INSERT INTO t SELECT 'obI2', (pg_temp.ob('I2')).id::text;
SELECT pg_temp.ok((pg_temp.ob('I2')).encaminhamento = 'iml' AND (pg_temp.ob('I2')).numero_do IS NULL AND (pg_temp.ob('I2')).atestado_por IS NULL
  AND (pg_temp.leito('OB2')).obito_aguardando_id = pg_temp.u('obI2')
  AND private.obito_pendencias(pg_temp.ob('I2')) = ARRAY['comunicacao_familia', 'policia', 'identificacao', 'liberacao'],
  'O3: violenta vai ao IML, sem D.O. nem atestante da unidade; pendências sem vias');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.comunicar_obito_policia(%L, %L::jsonb)', pg_temp.u('obI2'), '{}'),
  'A comunicação à polícia é registrada pelo médico ou pelo enfermeiro', 'recepção não registra a comunicação à polícia');
SELECT pg_temp.falha(format('SELECT public.liberar_corpo(%L, %L::jsonb)', pg_temp.u('obI2'), '{"destino":"iml"}'),
  'Confira a identificação do corpo antes da liberação', 'liberação pede a identificação conferida');
SELECT public.conferir_identificacao_corpo(pg_temp.u('obI2'), '{"meio":"pulseira_e_documento"}');
SELECT pg_temp.falha(format('SELECT public.conferir_identificacao_corpo(%L, %L::jsonb)', pg_temp.u('obI2'), '{"meio":"pulseira"}'),
  'A identificação do corpo já foi conferida', 'identificação uma vez');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.comunicar_obito_policia(pg_temp.u('obI2'), '{"ocorrencia":"BO 1234/2026"}');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.comunicar_obito_familia(pg_temp.u('obI2'), '{"destinatario_nome":"Carla Familiar","parentesco":"esposa","meio":"presencial"}');
SELECT pg_temp.falha(format('SELECT public.liberar_corpo(%L, %L::jsonb)', pg_temp.u('obI2'), '{"destino":"iml"}'),
  'A liberação do corpo é registrada pela enfermagem ou pela recepção', 'médico não registra a liberação do corpo');
SELECT pg_temp.falha(format('SELECT public.registrar_via_do(%L, %L)', pg_temp.u('obI2'), 'branca'),
  'A unidade não emitiu D.O. neste óbito', 'sem D.O. da unidade, sem vias');
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c5');
SELECT pg_temp.falha(format('SELECT public.liberar_corpo(%L, %L::jsonb)', pg_temp.u('obI2'), '{"destino":"funeraria"}'),
  'Morte violenta ou suspeita: o corpo vai ao IML', 'o destino segue o caminho do óbito');
SELECT public.liberar_corpo(pg_temp.u('obI2'), '{"destino":"iml"}');
SELECT pg_temp.falha(format('SELECT public.liberar_corpo(%L, %L::jsonb)', pg_temp.u('obI2'), '{"destino":"iml"}'),
  'O corpo já foi liberado', 'liberação uma vez');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.ob('I2')).liberado_por = '10000000-0000-4000-8000-0000000000c5' AND (pg_temp.ob('I2')).liberacao_destino = 'iml'
  AND (pg_temp.ob('I2')).identificacao_por = '10000000-0000-4000-8000-000000000005'
  AND (pg_temp.ob('I2')).policia_comunicada_por = '10000000-0000-4000-8000-000000000004' AND (pg_temp.ob('I2')).policia_ocorrencia = 'BO 1234/2026'
  AND private.obito_pendencias(pg_temp.ob('I2')) = '{}',
  'O5/O6: recepção confere, técnico libera, enfermeira comunica a polícia; nada pendente');
SELECT pg_temp.ok((pg_temp.leito('OB2')).status = 'higienizacao' AND (pg_temp.leito('OB2')).obito_aguardando_id IS NULL
  AND EXISTS (SELECT 1 FROM public.eventos_leito WHERE leito_id = pg_temp.u('OB2') AND tipo_evento = 'liberacao' AND motivo = 'Corpo liberado (IML)'),
  'O5: liberado o corpo, o leito vai para a higienização');

-- ── vias e D.O. anulada (O) ────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.registrar_via_do((pg_temp.ob('O')).id, 'branca');
SELECT pg_temp.falha(format('SELECT public.registrar_via_do(%L, %L)', (pg_temp.ob('O')).id, 'branca'), 'Esta via já foi registrada', 'via uma vez');
SELECT pg_temp.falha(format('SELECT public.anular_do(%L, %L, %L)', (pg_temp.ob('O')).id, '100000009', 'Rasura no campo das causas'),
  'A D.O. anulada é registrada pelo médico', 'recepção não anula a D.O.');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.anular_do(%L, %L, %L)', (pg_temp.ob('O')).id, '10000009', 'Rasura no campo das causas'),
  'O número da nova Declaração de Óbito tem 9 dígitos', 'D.O. nova com 9 dígitos');
SELECT public.anular_do((pg_temp.ob('O')).id, '100000009', 'Rasura no campo das causas');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.ob('O')).numero_do = '100000009' AND (pg_temp.ob('O')).via_branca_em IS NULL
  AND (SELECT numero_anulado = '100000002' AND motivo = 'Rasura no campo das causas' FROM public.obito_do_anuladas WHERE obito_id = (pg_temp.ob('O')).id),
  'D.O. anulada: o número velho e o motivo ficam; as vias recomeçam');

-- ── O7: pendências e linha do tempo ────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'pend', public.obitos_pendentes('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'linhaP', public.prontuario_leitura(pg_temp.u('P'))::text;
INSERT INTO t SELECT 'linhaI1', public.prontuario_leitura(pg_temp.u('I1'))::text;
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('pend')) x WHERE (x ->> 'id')::uuid = (pg_temp.ob('O')).id
                             AND x ->> 'paciente' = 'Paciente Óbito O' AND (x -> 'pendencias') ? 'liberacao' AND (x -> 'pendencias') ? 'via_branca'
                             AND (x ->> 'leito_aguardando')::boolean AND (x -> 'pode' ->> 'corpo')::boolean)
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.j('pend')) x WHERE (x ->> 'id')::uuid IN (pg_temp.u('obI2'), pg_temp.u('obI1'))),
  'O7: a lista da enfermagem traz o que falta; o óbito resolvido e o anulado saem');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('linhaP') -> 'obitos') = 1
  AND (pg_temp.j('linhaP') -> 'obitos' -> 0 ->> 'episodio_id')::uuid = pg_temp.u('epP')
  AND pg_temp.j('linhaP') -> 'obitos' -> 0 ->> 'tipo_morte' = 'natural_assistida'
  AND NOT (pg_temp.j('linhaP') -> 'obitos' -> 0) ? 'comunicacoes'
  AND pg_temp.j('linhaP') ? 'atendimentos' AND pg_temp.j('linhaP') ? 'contencoes' AND pg_temp.j('linhaP') ? 'nomes',
  'O7: a linha do tempo traz o óbito (sem nome de familiar); as chaves antigas continuam');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('linhaI1') -> 'obitos') = 1 AND pg_temp.j('linhaI1') -> 'obitos' -> 0 ->> 'anulado_em' IS NOT NULL,
  'o óbito anulado fica na linha do tempo, marcado');

-- ── privilégios ────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha('SELECT count(*) FROM public.obitos', 'permission denied', 'authenticated não lê a tabela de óbitos');
SELECT pg_temp.falha('SELECT count(*) FROM public.obito_comunicacoes', 'permission denied', 'authenticated não lê as comunicações');
SELECT pg_temp.falha('SELECT count(*) FROM public.obito_do_anuladas', 'permission denied', 'authenticated não lê as D.O. anuladas');
SELECT pg_temp.falha(format('UPDATE public.obitos SET liberado_em = now() WHERE id = %L', pg_temp.u('obI2')), 'permission denied', 'authenticated não grava direto');
SELECT pg_temp.falha(format('UPDATE public.leitos SET obito_aguardando_id = NULL WHERE id = %L', pg_temp.u('box')), 'permission denied',
  'authenticated não tira a marca do leito direto');
SELECT pg_temp.falha(format('SELECT private.anular_obito(%L, %L)', (pg_temp.ob('O')).id, 'tentativa direta'), 'permission denied', 'authenticated não anula direto');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');   -- telemedicina, fora da escala presencial
SELECT pg_temp.falha(format('SELECT public.obito_do_paciente(%L)', pg_temp.u('O')), 'Acesso negado', 'quem não está de plantão na unidade não lê');
SELECT pg_temp.falha(format('SELECT public.comunicar_obito_familia(%L, %L::jsonb)', (pg_temp.ob('O')).id, '{}'), 'Acesso negado', 'nem age');
RESET ROLE;
SELECT pg_temp.ok(NOT has_function_privilege('anon', f, 'EXECUTE') AND has_function_privilege('authenticated', f, 'EXECUTE'), 'anon não executa ' || f)
  FROM unnest(ARRAY['public.conferir_obito(jsonb, timestamptz)', 'public.obito_do_paciente(uuid)', 'public.obitos_pendentes(uuid)',
                    'public.comunicar_obito_familia(uuid, jsonb)', 'public.comunicar_obito_policia(uuid, jsonb)',
                    'public.conferir_identificacao_corpo(uuid, jsonb)', 'public.liberar_corpo(uuid, jsonb)',
                    'public.registrar_via_do(uuid, text)', 'public.anular_do(uuid, text, text)']) f;
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated não executa ' || f)
  FROM unnest(ARRAY['private.registrar_obito(uuid, uuid, uuid, uuid, text, uuid, uuid, jsonb, text)', 'private.anular_obito(uuid, text)',
                    'private.obito_validado(jsonb, timestamptz)', 'private.obito_json(public.obitos, boolean)', 'private.obito_para_agir(uuid)']) f;
SELECT pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), 'SECURITY DEFINER com search_path vazio: ' || f)
  FROM unnest(ARRAY['public.conferir_obito(jsonb, timestamptz)', 'public.obito_do_paciente(uuid)', 'public.obitos_pendentes(uuid)',
                    'public.comunicar_obito_familia(uuid, jsonb)', 'public.liberar_corpo(uuid, jsonb)', 'public.anular_do(uuid, text, text)']) f;

ROLLBACK;
