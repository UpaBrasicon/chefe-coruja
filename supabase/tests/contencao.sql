-- Testes da migration 20270325000001_contencao.sql (lacuna 4 do Portão de
-- 11/10/2026; decisão do RT em 10/11/2026: A em K1 a K10).
--  K2. enfermeiro ou médico inicia; técnico revisa e retira, não inicia;
--      recepção não inicia; uma contenção ativa por paciente;
--  K3. iniciada sem prescrição: o médico de plantão é avisado e o alerta
--      "sem prescrição" fica até o item de contenção ser prescrito;
--  K4. item "contencao" na prescrição (campos conferidos; descrição e
--      observação montadas); a ordem nova renova a anterior; aviso de
--      renovação a 2 h do fim e no vencimento (24 h);
--  K5/K7. revisões só de inserção (retificação), intercorrência ligada,
--      família informada, retirada fecha, a alta fecha sozinha;
--  K6. revisão atrasada depois de 1 h; o job avisa o enfermeiro uma vez por
--      janela atrasada;
--  K8. linha do tempo (prontuario_leitura) com contenções e intercorrências;
--      relatório do gestor;
--  K9. pediátrico: registro marcado; RASS (escala de adulto) recusado;
--  K10. folha pelo folha_relatorio, com protocolo;
--  privilégios: tabelas sem leitura direta; anon não executa.
-- O técnico de enfermagem é o perfil …00c4, criado aqui. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- técnico de enfermagem (o seed não tem)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'tecnico-contencao@teste.local', '', now(), '{}', '{"nome_completo":"Técnico Contenção"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000c4', 'Técnico Contenção') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000c4', '21000000-0000-4000-8000-000000000001', 'tecnico_enfermagem') ON CONFLICT DO NOTHING;
-- médico, enfermeira e técnico no PS e na Clínica Médica; recepção no PS
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-0000000000c4');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001'::uuid, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-0000000000c4']::uuid[]) p,
       unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000001']::uuid[]) s
UNION ALL
SELECT '21000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000005'::uuid,
       private.data_atual(), 'manha', now() - interval '1 hour', 360;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

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
-- estado calculado no servidor, lido como superusuário
CREATE FUNCTION pg_temp.estado(p text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT private.contencao_estado(c) FROM public.contencoes c WHERE c.id = pg_temp.u(p) $$;
CREATE FUNCTION pg_temp.avisos(p_tipo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo LIKE p_tipo $$;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- ── cadastros: adulto (A) e criança de 5 anos (B), na porta ──────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'epA', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Agitação intensa', NULL,
  json_build_object('nome', 'Paciente Contenção Adulto', 'data_nascimento', (current_date - interval '35 years')::date)::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'epB', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Agitação', NULL,
  json_build_object('nome', 'Paciente Contenção Criança', 'data_nascimento', (current_date - interval '5 years')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('epA'), 'amarelo',
  '{"frequencia-cardiaca":110,"frequencia-respiratoria":22,"temperatura":36.8,"saturacao-o2":97,"escala-dor":0,"pressao-arterial-sistolica":140,"pressao-arterial-diastolica":90}',
  pg_temp.u('flx'), 'Edema de face');
RESET ROLE;
INSERT INTO t SELECT 'A', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('epA');
INSERT INTO t SELECT 'B', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('epB');
INSERT INTO t VALUES ('dados', '{"motivo":"Agitação com risco de queda e de agressão à equipe","alternativas":"Abordagem verbal e redução de estímulos","locais":["msd","mse","mid","mie"]}');
SET LOCAL ROLE authenticated;

-- ── K2: quem inicia ─────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados')),
  'A contenção é iniciada pelo enfermeiro ou pelo médico', 'recepção não inicia');
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c4');
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados')),
  'A contenção é iniciada pelo enfermeiro ou pelo médico', 'técnico de enfermagem não inicia (K2)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados') || '{"motivo":"agitado"}'),
  'Diga o motivo da contenção', 'início exige o motivo');
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados') || '{"alternativas":""}'),
  'Diga as alternativas tentadas', 'início exige as alternativas tentadas');
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados') || '{"locais":["pescoco"]}'),
  'Marque os membros ou locais contidos', 'local fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados') || '{"familia_informada":true}'),
  'Diga quem da família foi informado', 'família informada pede quem');
INSERT INTO t SELECT 'c1', public.iniciar_contencao(pg_temp.u('A'), pg_temp.j('dados'));
SELECT pg_temp.falha(format('SELECT public.iniciar_contencao(%L, %L::jsonb)', pg_temp.u('A'), pg_temp.j('dados')),
  'O paciente já está em contenção mecânica', 'uma contenção ativa por paciente');
INSERT INTO t SELECT 'telaA', public.contencao_do_paciente(pg_temp.u('A'))::text;
SELECT pg_temp.ok((pg_temp.j('telaA') -> 'ativa' ->> 'pontos')::int = 4 AND (pg_temp.j('telaA') -> 'ativa' ->> 'papel_inicio') = 'enfermeiro'
  AND NOT (pg_temp.j('telaA') ->> 'pode_iniciar')::boolean AND (pg_temp.j('telaA') ->> 'pode_revisar')::boolean
  AND NOT (pg_temp.j('telaA') -> 'ativa' ->> 'pediatrico')::boolean,
  'a tela lê a contenção ativa (4 pontos, iniciada pelo enfermeiro, adulto)');
RESET ROLE;

-- ── K3: sem prescrição, o médico é avisado e o alerta fica ─────────────────
SELECT pg_temp.ok((pg_temp.estado('c1') ->> 'sem_prescricao')::boolean, 'contenção sem prescrição fica com o alerta');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista
   WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND tipo = 'contencao_sem_presc_' || pg_temp.u('c1')
     AND mensagem LIKE 'Contenção mecânica sem prescrição médica: Paciente Contenção Adulto (Pronto Socorro)%'),
  'o médico de plantão do setor é avisado na hora');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista
   WHERE perfil_id = '10000000-0000-4000-8000-000000000004' AND tipo = 'contencao_sem_presc_' || pg_temp.u('c1')),
  'o aviso de prescrição não vai para a enfermagem');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'contencao_iniciada' AND entidade_id = pg_temp.u('c1')
                                AND (payload ? 'paciente_id' OR payload::text LIKE '%Paciente Contenção%'))
  AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'contencao_iniciada' AND entidade_id = pg_temp.u('c1')),
  'auditoria do início sem dado de pessoa');

-- ── K4: a prescrição da contenção ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('epA')),
       public.registrar_soap(pg_temp.u('epA'), 'Agitação intensa', 'Agitado, agressivo', 'Agitação psicomotora', 'Contenção e reavaliação', 'R45.1');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L::jsonb)', pg_temp.u('A'),
  '{"tipo":"contencao","pontos":4,"periodo_h":30,"motivo":"Agitação com risco de agressão","criterios_retirada":"Paciente calmo e colaborativo"}'),
  'Contenção: o período previsto vai de 1 a 24 horas', 'o período previsto cabe nas 24 h da prescrição');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L::jsonb)', pg_temp.u('A'),
  '{"tipo":"contencao","pontos":6,"periodo_h":4,"motivo":"Agitação com risco de agressão","criterios_retirada":"Paciente calmo e colaborativo"}'),
  'Contenção: os pontos vão de 1 a 5', 'pontos de 1 a 5');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L::jsonb)', pg_temp.u('A'),
  '{"tipo":"contencao","pontos":4,"periodo_h":4,"motivo":"Agitação com risco de agressão","criterios_retirada":"calmo"}'),
  'Contenção: diga os critérios de retirada', 'critérios de retirada obrigatórios');
INSERT INTO t SELECT 'it1', public.prescrever(pg_temp.u('A'),
  '{"tipo":"contencao","pontos":4,"periodo_h":4,"motivo":"Agitação com risco de agressão à equipe","criterios_retirada":"Paciente calmo e colaborativo por 30 min"}');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L::jsonb)', pg_temp.u('A'), '{"tipo":"grade"}'),
  'Tipo de item desconhecido', 'tipo fora da lista continua recusado');
SELECT public.prescrever(pg_temp.u('A'), '{"tipo":"cuidado","descricao":"Cabeceira elevada"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT descricao = 'Contenção mecânica em 4 pontos' AND observacao LIKE 'Motivo: Agitação com risco de agressão à equipe. Período previsto: até 4 h. Retirar quando: Paciente calmo e colaborativo por 30 min.%'
                          AND (contencao ->> 'periodo_h')::int = 4 AND medicamento_id IS NULL
                     FROM public.prescricao_itens WHERE id = pg_temp.u('it1')),
  'item de contenção: descrição, observação e campos gravados');
SELECT pg_temp.ok((SELECT prescricao_item_id = pg_temp.u('it1') AND prescrita_em IS NOT NULL FROM public.contencoes WHERE id = pg_temp.u('c1'))
  AND NOT (pg_temp.estado('c1') ->> 'sem_prescricao')::boolean AND pg_temp.estado('c1') ->> 'renovacao' = 'em_dia',
  'a prescrição liga na contenção e o alerta sai');
SELECT pg_temp.ok((SELECT tipo = 'cuidado' AND contencao IS NULL FROM public.prescricao_itens
                    WHERE descricao = 'Cabeceira elevada' AND prescricao_id = (SELECT prescricao_id FROM public.prescricao_itens WHERE id = pg_temp.u('it1'))),
  'cuidado continua como antes');
SELECT pg_temp.falha($q$UPDATE public.prescricao_itens SET contencao = '{"pontos":1}' WHERE tipo = 'cuidado' AND descricao = 'Cabeceira elevada'$q$,
  'new row for relation "prescricao_itens" violates check constraint "prescricao_itens_contencao_check"', 'campos de contenção só no item de contenção');

-- renovação: a ordem nova suspende a anterior e liga na contenção
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'it2', public.prescrever(pg_temp.u('A'),
  '{"tipo":"contencao","pontos":2,"periodo_h":6,"motivo":"Agitação ainda com risco de agressão","criterios_retirada":"Paciente calmo e colaborativo por 30 min"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT suspenso_em IS NOT NULL AND motivo_suspensao LIKE 'Renovada%' FROM public.prescricao_itens WHERE id = pg_temp.u('it1'))
  AND (SELECT prescricao_item_id = pg_temp.u('it2') FROM public.contencoes WHERE id = pg_temp.u('c1')),
  'renovação: a ordem anterior é suspensa e a nova liga na contenção');
-- 24 h: aviso perto do fim e no vencimento, ao médico
UPDATE public.prescricao_itens SET created_at = now() - interval '23 hours' WHERE id = pg_temp.u('it2');
SELECT pg_temp.ok(pg_temp.estado('c1') ->> 'renovacao' = 'perto', 'a 1 h do fim: renovação perto');
SELECT private.contencao_avisar();
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002'
                            AND tipo = 'contencao_perto_' || pg_temp.u('it2') AND mensagem LIKE 'Renovar a prescrição da contenção:%'),
  'o médico recebe o aviso de renovação');
UPDATE public.prescricao_itens SET created_at = now() - interval '25 hours' WHERE id = pg_temp.u('it2');
SELECT pg_temp.ok(pg_temp.estado('c1') ->> 'renovacao' = 'vencida' AND NOT (pg_temp.estado('c1') ->> 'sem_prescricao')::boolean,
  'depois de 24 h: prescrição vencida');
SELECT private.contencao_avisar();
SELECT pg_temp.ok(pg_temp.avisos('contencao_vencida_' || pg_temp.u('it2')) = 1, 'o médico recebe o aviso de vencimento');
UPDATE public.prescricao_itens SET created_at = now() WHERE id = pg_temp.u('it2');

-- ── K6: revisão de no máximo 1 h; um aviso por janela atrasada ─────────────
UPDATE public.contencoes SET iniciada_em = now() - interval '150 minutes', registrada_em = now() - interval '150 minutes' WHERE id = pg_temp.u('c1');
SELECT pg_temp.ok((pg_temp.estado('c1') ->> 'revisao_atrasada')::boolean, 'sem revisão depois de 1 h: atrasada');
INSERT INTO t SELECT 'n1', private.contencao_avisar();
SELECT pg_temp.ok((SELECT valor::int FROM t WHERE nome = 'n1') >= 1 AND pg_temp.avisos('contencao_revisao_' || pg_temp.u('c1') || '_%') = 1
  AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000004'
                AND tipo LIKE 'contencao_revisao_' || pg_temp.u('c1') || '_%' AND mensagem LIKE 'Revisão da contenção atrasada: Paciente Contenção Adulto%'),
  'o job avisa o enfermeiro do setor');
INSERT INTO t SELECT 'n2', private.contencao_avisar();
SELECT pg_temp.ok((SELECT valor::int FROM t WHERE nome = 'n2') = 0 AND pg_temp.avisos('contencao_revisao_' || pg_temp.u('c1') || '_%') = 1,
  'o job de novo não repete o aviso da mesma janela');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-0000000000c4'
                                AND tipo LIKE 'contencao_%'), 'o técnico não recebe o aviso (vai ao enfermeiro)');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c4');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(public.contencoes_ativas('21000000-0000-4000-8000-000000000001')) x
                           WHERE (x ->> 'contencao_id')::uuid = pg_temp.u('c1') AND (x ->> 'revisao_atrasada')::boolean
                             AND NOT (x ->> 'sem_prescricao')::boolean),
  'a lista da enfermagem mostra o selo de revisão atrasada');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c4');
INSERT INTO t VALUES ('rev', '{"consciencia":"Agitado, responde ao chamado","sinais_vitais":"PA 150/90 FC 112 FR 22 SpO2 96% Tax 36,9","pele":"Íntegra nos punhos e tornozelos","perfusao":"Perfusão preservada nos quatro membros","necessidades":"Ofertada água; diurese presente"}');
SELECT pg_temp.falha(format('SELECT public.revisar_contencao(%L, %L::jsonb)', pg_temp.u('c1'), pg_temp.j('rev') || '{"sinais_vitais":""}'),
  'Registre os sinais vitais como aferidos', 'revisão exige os sinais vitais');
SELECT pg_temp.falha(format('SELECT public.revisar_contencao(%L, %L::jsonb)', pg_temp.u('c1'),
  pg_temp.j('rev') || jsonb_build_object('revisada_em', now() - interval '3 hours')),
  'Hora da revisão entre o início da contenção', 'revisão antes do início é recusada');
-- a primeira revisão chega às -100 min: a janela seguinte vence às -40 min
INSERT INTO t SELECT 'r1', public.revisar_contencao(pg_temp.u('c1'), pg_temp.j('rev') || jsonb_build_object('revisada_em', now() - interval '100 minutes'));
RESET ROLE;
SELECT pg_temp.ok((pg_temp.estado('c1') ->> 'revisao_atrasada')::boolean
  AND (pg_temp.estado('c1') ->> 'proxima_revisao_em')::timestamptz = now() - interval '40 minutes', 'revisão de -100 min: atrasada de novo às -40 min');
SELECT private.contencao_avisar();
SELECT pg_temp.ok(pg_temp.avisos('contencao_revisao_' || pg_temp.u('c1') || '_%') = 2, 'janela atrasada nova: um aviso novo');

-- evento adverso registrado como intercorrência e ligado à revisão
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c4');
INSERT INTO t SELECT 'ic', public.registrar_intercorrencia(pg_temp.u('A'), pg_temp.u('epA'), NULL, 'lesao_pele', NULL, 'leve', now(),
  'Hiperemia no punho direito sob a faixa', 'Faixa reposicionada e acolchoada; enfermeira comunicada');
INSERT INTO t SELECT 'r2', public.revisar_contencao(pg_temp.u('c1'), pg_temp.j('rev')
  || jsonb_build_object('rass', 1, 'pele', 'Hiperemia no punho direito', 'intercorrencia_id', pg_temp.u('ic')));
SELECT pg_temp.ok(NOT (pg_temp.j('rev') IS NULL) AND jsonb_array_length(public.contencao_do_paciente(pg_temp.u('A')) -> 'ativa' -> 'lista_revisoes') = 2,
  'técnico registra a revisão (K2)');
-- retificação: a anterior fica, marcada; não se retifica duas vezes
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'r1b', public.revisar_contencao(pg_temp.u('c1'), pg_temp.j('rev') || jsonb_build_object('revisada_em', now() - interval '100 minutes',
  'pele', 'Íntegra nos punhos; hiperemia leve no tornozelo esquerdo'), pg_temp.u('r1'));
SELECT pg_temp.falha(format('SELECT public.revisar_contencao(%L, %L::jsonb, %L)', pg_temp.u('c1'), pg_temp.j('rev'), pg_temp.u('r1')),
  'Esta revisão já foi retificada', 'não se retifica a mesma revisão duas vezes');
-- família
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c4');
SELECT public.informar_familia_contencao(pg_temp.u('c1'), true, 'Filha, por telefone');
RESET ROLE;
SELECT pg_temp.ok(NOT (pg_temp.estado('c1') ->> 'revisao_atrasada')::boolean AND (pg_temp.estado('c1') ->> 'revisoes')::int = 2,
  'com a revisão de agora, em dia (a retificada não conta duas vezes)');
SELECT pg_temp.falha(format($q$UPDATE public.contencao_revisoes SET pele = 'outra' WHERE id = %L$q$, pg_temp.u('r2')),
  'A revisão da contenção é só de inserção', 'revisão não se altera');
SELECT pg_temp.falha(format($q$DELETE FROM public.contencao_revisoes WHERE id = %L$q$, pg_temp.u('r2')),
  'A revisão da contenção é só de inserção', 'revisão não se apaga');
SELECT pg_temp.ok((SELECT familia_informada AND familia_detalhe = 'Filha, por telefone' AND familia_registrado_por = '10000000-0000-4000-8000-0000000000c4'
                     FROM public.contencoes WHERE id = pg_temp.u('c1')), 'família informada registrada com quem registrou');

-- ── K9: criança; o médico inicia; RASS recusado; técnico retira ────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'c2', public.iniciar_contencao(pg_temp.u('B'), pg_temp.j('dados')
  || '{"locais":["msd","mse"],"familia_informada":false,"familia_detalhe":"Sem acompanhante no momento"}');
SELECT pg_temp.ok((public.contencao_do_paciente(pg_temp.u('B')) -> 'ativa' ->> 'pediatrico')::boolean
  AND (public.contencao_do_paciente(pg_temp.u('B')) -> 'ativa' ->> 'papel_inicio') = 'plantonista'
  AND (public.contencao_do_paciente(pg_temp.u('B')) -> 'ativa' ->> 'pontos')::int = 2,
  'criança: o médico inicia e o registro mostra que é pediátrico');
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000c4');
SELECT pg_temp.falha(format('SELECT public.revisar_contencao(%L, %L::jsonb)', pg_temp.u('c2'), pg_temp.j('rev') || '{"rass":2}'),
  'O RASS é escala de adulto', 'RASS recusado na criança');
SELECT public.revisar_contencao(pg_temp.u('c2'), pg_temp.j('rev'));
SELECT pg_temp.falha(format('SELECT public.retirar_contencao(%L, %L)', pg_temp.u('c2'), 'ok'),
  'Diga por que a contenção sai', 'retirada exige o motivo');
SELECT public.retirar_contencao(pg_temp.u('c2'), 'Criança calma, com a mãe ao lado');
SELECT pg_temp.ok((public.contencao_do_paciente(pg_temp.u('B')) -> 'ativa') = 'null'::jsonb
  AND jsonb_array_length(public.contencao_do_paciente(pg_temp.u('B')) -> 'anteriores') = 1, 'técnico retira (K2): a contenção sai da ativa');
SELECT pg_temp.falha(format('SELECT public.revisar_contencao(%L, %L::jsonb)', pg_temp.u('c2'), pg_temp.j('rev')),
  'Esta contenção já foi retirada', 'contenção retirada não recebe revisão');
SELECT pg_temp.falha(format('SELECT public.retirar_contencao(%L, %L)', pg_temp.u('c2'), 'De novo, por engano'),
  'Esta contenção já foi retirada', 'não se retira duas vezes');
RESET ROLE;
SELECT pg_temp.ok((SELECT retirada_por = '10000000-0000-4000-8000-0000000000c4' AND NOT retirada_automatica FROM public.contencoes WHERE id = pg_temp.u('c2'))
  AND NOT (pg_temp.estado('c2') ->> 'revisao_atrasada')::boolean AND NOT (pg_temp.estado('c2') ->> 'sem_prescricao')::boolean,
  'retirada fecha: sem alerta de revisão nem de prescrição');

-- ── K8: linha do tempo do prontuário ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'linha', public.prontuario_leitura(pg_temp.u('A'))::text;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.j('linha') -> 'contencoes') = 1
  AND (pg_temp.j('linha') -> 'contencoes' -> 0 ->> 'episodio_id')::uuid = pg_temp.u('epA')
  AND jsonb_array_length(pg_temp.j('linha') -> 'intercorrencias') = 1
  AND (pg_temp.j('linha') -> 'intercorrencias' -> 0 ->> 'id')::uuid = pg_temp.u('ic')
  AND pg_temp.j('linha') ? 'atendimentos' AND pg_temp.j('linha') ? 'nomes',
  'a linha do tempo traz a contenção e a intercorrência do atendimento (as chaves antigas continuam)');

-- ── K10: a folha, com protocolo ─────────────────────────────────────────────
INSERT INTO t SELECT 'folha', public.folha_relatorio('contencao', pg_temp.u('A'), NULL, NULL, ARRAY[pg_temp.u('c1')])::text;
SELECT pg_temp.ok(pg_temp.j('folha') ->> 'protocolo' LIKE 'IMP-%'
  AND jsonb_array_length(pg_temp.j('folha') -> 'dados' -> 'contencoes') = 1
  AND jsonb_array_length(pg_temp.j('folha') -> 'dados' -> 'contencoes' -> 0 -> 'lista_revisoes') = 3
  AND jsonb_array_length(pg_temp.j('folha') -> 'dados' -> 'contencoes' -> 0 -> 'prescricoes') = 2
  AND pg_temp.j('folha') -> 'cabecalho' IS NOT NULL,
  'folha: início, as duas prescrições e as três revisões (com a retificada), com protocolo');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = pg_temp.u('A') AND tipo_acesso = 'impressao'
                            AND documento_tipo = 'Registro de contenção mecânica'), 'a impressão fica registrada');

-- ── desfecho: internação mantém; a alta encerra ─────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_desfecho(pg_temp.u('epA'), 'internacao', NULL, '{"setor_id":"22000000-0000-4000-8000-000000000001"}');
RESET ROLE;
INSERT INTO t SELECT 'iA', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('epA');
SELECT pg_temp.ok((SELECT retirada_em IS NULL FROM public.contencoes WHERE id = pg_temp.u('c1')), 'a porta vira internação: a contenção continua');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.dar_alta(pg_temp.u('iA'), 'alta_melhorada', 'R45.1');
RESET ROLE;
SELECT pg_temp.ok((SELECT retirada_em IS NOT NULL AND retirada_automatica AND motivo_retirada = 'Encerrada com a alta da internação'
                     FROM public.contencoes WHERE id = pg_temp.u('c1')), 'a alta encerra a contenção');

-- ── K8: relatório do gestor ────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($q$SELECT public.relatorio_contencoes('21000000-0000-4000-8000-000000000001', current_date - 1, current_date)$q$,
  'Acesso negado: relatório do gestor', 'enfermeiro não lê o relatório do gestor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'rel', public.relatorio_contencoes('21000000-0000-4000-8000-000000000001', private.data_atual() - 1, private.data_atual() + 1)::text;
RESET ROLE;
SELECT pg_temp.ok((pg_temp.j('rel') ->> 'contencoes')::int >= 2 AND (pg_temp.j('rel') ->> 'pediatricas')::int >= 1
  AND (pg_temp.j('rel') ->> 'pacientes_atendidos')::int >= (pg_temp.j('rel') ->> 'pacientes')::int
  AND (pg_temp.j('rel') ->> 'eventos_adversos')::int >= 1 AND (pg_temp.j('rel') ->> 'nunca_prescritas')::int >= 1,
  'relatório: contenções, pediátricas, pacientes atendidos, eventos adversos e sem prescrição');
-- só as duas deste teste (o período pode ter outras na homologação)
SELECT pg_temp.ok(
  (WITH c AS (SELECT x.* FROM public.contencoes x WHERE x.id IN (pg_temp.u('c1'), pg_temp.u('c2'))),
        rv AS (SELECT r.contencao_id, r.revisada_em - lag(r.revisada_em, 1, c.iniciada_em) OVER (PARTITION BY r.contencao_id ORDER BY r.revisada_em) AS i
                 FROM public.contencao_revisoes r JOIN c ON c.id = r.contencao_id
                WHERE NOT EXISTS (SELECT 1 FROM public.contencao_revisoes y WHERE y.retifica_id = r.id))
   SELECT count(*) FILTER (WHERE i <= interval '1 hour') = 2 AND count(*) = 3 FROM rv),
  'no prazo: a de -100 min (50 min do início) e a da criança; a de agora veio 100 min depois');

-- ── privilégios ────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha('SELECT count(*) FROM public.contencoes', 'permission denied', 'authenticated não lê a tabela de contenções');
SELECT pg_temp.falha('SELECT count(*) FROM public.contencao_revisoes', 'permission denied', 'authenticated não lê as revisões');
SELECT pg_temp.falha(format($q$UPDATE public.contencoes SET retirada_em = now(), motivo_retirada = 'direto' WHERE id = %L$q$, pg_temp.u('c2')),
  'permission denied', 'authenticated não grava direto');
SELECT pg_temp.falha('SELECT private.contencao_avisar()', 'permission denied', 'authenticated não roda o job');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');   -- telemedicina, fora da escala presencial
SELECT pg_temp.falha(format('SELECT public.contencao_do_paciente(%L)', pg_temp.u('A')), 'Acesso negado', 'quem não atua no paciente não lê');
RESET ROLE;
SELECT pg_temp.ok(NOT has_function_privilege('anon', f, 'EXECUTE') AND has_function_privilege('authenticated', f, 'EXECUTE'), 'anon não executa ' || f)
  FROM unnest(ARRAY['public.contencao_do_paciente(uuid)', 'public.contencoes_ativas(uuid)', 'public.iniciar_contencao(uuid, jsonb)',
                    'public.revisar_contencao(uuid, jsonb, uuid)', 'public.informar_familia_contencao(uuid, boolean, text, timestamptz)',
                    'public.retirar_contencao(uuid, text, timestamptz)', 'public.relatorio_contencoes(uuid, date, date)']) f;
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated não executa ' || f)
  FROM unnest(ARRAY['private.contencao_avisar()', 'private.contencao_prescrita(uuid)', 'private.encerrar_contencao(uuid, uuid, text)',
                    'private.contencao_folha(uuid, uuid[])', 'private.avisar_contencao_sem_prescricao(uuid)']) f;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM cron.job WHERE jobname = 'contencao-avisos' AND schedule = '*/15 * * * *'), 'job de avisos a cada 15 min');

-- ── as listas da enfermagem ────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.ok(jsonb_array_length(public.contencoes_ativas('21000000-0000-4000-8000-000000000001')) = 0
  OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contencoes_ativas('21000000-0000-4000-8000-000000000001')) x
                  WHERE (x ->> 'contencao_id')::uuid IN (pg_temp.u('c1'), pg_temp.u('c2'))),
  'as encerradas não aparecem nas listas');
RESET ROLE;

ROLLBACK;
