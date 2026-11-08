-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado A P2-3 (A05, passo A05.B.enf_dispensa_com_farmacia_
-- aberta) depois da 20270307000004_dispensa_enfermagem_farmaceutico.sql
-- (07/11/2026).
--
-- No A05, com o farmaceutico.f5 escalado e de plantão, o enfermeiro.upa.f5
-- retirou o medicamento com justificativa. Aqui, com o farmacêutico em
-- check-in, a retirada pela enfermagem é recusada; o farmacêutico dispensa;
-- a enfermagem checa.
--
-- Paciente: "Rosa Teste Arquivo" (UPA F5, do 92), numa ficha nova no PS. Cada
-- passo roda como a conta do papel (e2e.bpasso, do 60). Dose: só texto de
-- teste. A cor é da enfermeira de teste; sinais crus. No fim, alta da porta.
-- Rodar antes: 41_checkin_fase5.sql (faz o check-in do farmacêutico).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'ret\_%';
SELECT e2e.b_guardar('ret_inicio', now()::text);
SELECT e2e.b_guardar('ret_pac', '8e06379f-5191-448c-9f03-b0b188bd4bef');

SELECT e2e.bpasso(NULL, 'RET.00.farmacia_aberta', 'banco', NULL, 'Farmacêutico da UPA F5 em check-in agora',
  $q$SELECT e2e.b_confere(private.farmaceutico_de_plantao('f5100000-0000-4000-8000-000000000002'), 'farmacêutico de plantão')$q$);
SELECT e2e.bpasso(NULL, 'RET.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Náusea (teste da retirada sem farmacêutico)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'ret_ep');
SELECT e2e.bpasso('ret_ep', 'RET.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('ret_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('ret_ep', 'RET.03.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica verde (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('ret_ep'), 'f5100000-0000-4000-8000-000000000002', 'verde',
    '{"frequencia-cardiaca":82,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76,"frequencia-respiratoria":16,"saturacao-o2":98,"temperatura":36.7,"escala-dor":2}',
    'Mal-estar geral', 'Náusea (texto da enfermeira de teste)'), 'ok', 'ret_class');
SELECT e2e.bpasso('ret_class', 'RET.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ret_ep')));
SELECT e2e.bpasso('ret_class', 'RET.04.peso', 'f5_med_upa', '/atendimento (Prescrição)', 'Peso referido deste atendimento',
  e2e.b_sinais(e2e.u('ret_pac'), '{"peso":68}', NULL, 'referido'));
SELECT e2e.bpasso('ret_class', 'RET.05.prescrever', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescreve sulfato de magnésio "Agora"; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('ret_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'ok', 'ret_item');

-- ── farmácia aberta: a enfermagem não retira ────────────────────────────────
SELECT e2e.bpasso('ret_item', 'RET.06.enf_retira', 'f5_enf_upa', '/dispensacao (Retirada sem farmacêutico)',
  'Enfermeira tenta retirar com justificativa e o farmacêutico em check-in (deve ser recusado)',
  format($q$SELECT public.dispensar_item(%L::uuid, 1, 'Farmácia fechada no teste (justificativa)')::text$q$, e2e.u('ret_item')),
  'erro:Há farmacêutico de plantão na unidade');
SELECT e2e.bpasso('ret_item', 'RET.07.farm_dispensa', 'f5_farm', '/dispensacao', 'O farmacêutico dispensa (e valida o item)',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('ret_item')));
SELECT e2e.bpasso('ret_item', 'RET.08.registro', 'banco', NULL, 'Uma dispensação, pelo farmacêutico',
  format($q$SELECT e2e.b_confere(count(*) = 1 AND bool_and(NOT sem_farmaceutico), count(*) || ' dispensação; sem farmacêutico: ' || coalesce(bool_or(sem_farmaceutico)::text, '-'))
    FROM public.dispensacoes WHERE item_id = %L$q$, e2e.u('ret_item')));
SELECT e2e.bpasso('ret_item', 'RET.09.checar', 'f5_enf_upa', '/checagem', 'Checa "feito"',
  format('SELECT public.checar(%L::uuid, %L, NULL, NULL)::text', e2e.u('ret_item'), 'feito'));

-- ── fim: alta da porta ──────────────────────────────────────────────────────
SELECT e2e.bpasso('ret_ep', 'RET.99.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Náusea (teste da retirada sem farmacêutico)', 'Sem sinais de alarme', 'Náusea', 'Conduta de teste de fluxo', 'R11')::text$q$, e2e.u('ret_ep')));
SELECT e2e.bpasso('ret_ep', 'RET.99.alta', 'f5_med_upa', '/atendimento (Desfecho)', 'Alta da porta (encerra o cenário)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', 'Alta ao fim do teste da retirada sem farmacêutico', '{}'::jsonb)::text$q$, e2e.u('ret_ep')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 160) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'RET.%' AND em >= e2e.v('ret_inicio')::timestamptz ORDER BY id;
