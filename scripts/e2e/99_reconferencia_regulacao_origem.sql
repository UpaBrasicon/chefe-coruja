-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado P2-2 do A01 depois da
-- 20270307000006_regulacao_origem_encerrada.sql (07/11/2026; decisão do RT:
-- A em S1 a S6).
--
-- Duas rodadas com "Rosa Teste Arquivo" (UPA F5, do 92), pelas RPCs das telas,
-- cada passo como a conta do papel (e2e.bpasso, do 60):
--   R1 — a ordem da rodada 2 do A01: o NIR tenta marcar a saída e o hospital
--        marca a chegada ANTES da alta na origem. A saída é recusada; a chegada
--        fica em trânsito com a marca e aparece no NIR da origem; a alta por
--        transferência com a regulação conclui (realizada na hora da chegada).
--   R2 — a ordem certa: alta por transferência primeiro (marca a saída), depois
--        a chegada (realizada direto).
-- Nenhuma dose; a cor é da enfermeira de teste; sinais crus.
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'rgo\_%';
SELECT e2e.b_guardar('rgo_inicio', now()::text);
SELECT e2e.b_guardar('rgo_pac', '8e06379f-5191-448c-9f03-b0b188bd4bef');

-- ── rodada 1 ─────────────────────────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'RGO.R1.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor torácica (teste da regulação com a origem aberta, rodada 1)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'rgo_r1_ep');
SELECT e2e.bpasso('rgo_r1_ep', 'RGO.R1.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('rgo_r1_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('rgo_r1_ep', 'RGO.R1.03.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica laranja (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('rgo_r1_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":104,"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":92,"frequencia-respiratoria":20,"saturacao-o2":95,"temperatura":36.6,"escala-dor":8}',
    'Mal-estar geral', 'Dor torácica (texto da enfermeira de teste)'), 'ok', 'rgo_r1_class');
SELECT e2e.bpasso('rgo_r1_class', 'RGO.R1.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('rgo_r1_ep')));
SELECT e2e.bpasso('rgo_r1_class', 'RGO.R1.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste (I21.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor torácica (teste)', 'ECG de teste', 'Síndrome coronariana aguda', 'Transferir pela regulação', 'I21.9')::text$q$, e2e.u('rgo_r1_ep')));
SELECT e2e.bpasso('rgo_r1_class', 'RGO.R1.05.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência para leito clínico, ambulância avançada',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('rgo_pac'),
    jsonb_build_object('tipo', 'transferencia', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'procedimento', '0303060190', 'cid', 'I21.9',
      'carater', 'urgencia', 'prioridade', 'emergencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('rgo_r1_ep'),
      'quadro_clinico', 'Dor torácica típica com sudorese (dado fictício, teste da regulação com a origem aberta).',
      'telefone_contato', '(11) 0000-0009')), 'ok', 'rgo_r1_reg');
SELECT e2e.bpasso('rgo_r1_reg', 'RGO.R1.06.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 80)', e2e.u('rgo_r1_reg')));
SELECT e2e.bpasso('rgo_r1_reg', 'RGO.R1.06.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '2 hours', 'teste da origem aberta')::text, 80)$q$,
    e2e.u('rgo_r1_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.bpasso('rgo_r1_reg', 'RGO.R1.07.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita (transferência sem leito)',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, NULL, 'aceito no teste da origem aberta')::text, 80)$q$, e2e.u('rgo_r1_reg')), 'ok', 'rgo_r1_aceita');

-- R1: saída e chegada antes da alta (a ordem da rodada 2 do A01)
SELECT e2e.bpasso('rgo_r1_aceita', 'RGO.R1.08.saida_antes', 'f5_nir', '/regulacao (Detalhe)', 'NIR tenta marcar a saída com a paciente em atendimento (deve ser recusado)',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.u('rgo_r1_reg')), 'erro:O paciente segue em atendimento na origem');
SELECT e2e.bpasso('rgo_r1_aceita', 'RGO.R1.09.chegada', 'f5_med_hosp', '/regulacao (destino)', 'Hospital marca a chegada antes da alta na origem',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Chegou (teste R1)')::text, 80)$q$, e2e.u('rgo_r1_reg')), 'ok', 'rgo_r1_chegou');
SELECT e2e.bpasso('rgo_r1_chegou', 'RGO.R1.09.em_transito', 'banco', NULL, 'Em trânsito com a marca de chegada, sem realizada',
  format($q$SELECT e2e.b_confere(status = 'em_transito' AND chegada_em IS NOT NULL AND realizada_em IS NULL, status || ', chegada ' || coalesce(chegada_em::text, '-'))
    FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('rgo_r1_reg')));
SELECT e2e.bpasso('rgo_r1_chegou', 'RGO.R1.10.nir_origem', 'f5_nir', '/nir', 'Item no NIR da origem: chegou ao destino, origem sem alta',
  format($q$SELECT e2e.b_confere(public.nir_pendencias(%L)::text LIKE '%%reg_origem_aberta%%' AND public.nir_pendencias(%L)::text LIKE '%%' || %L || '%%', 'item reg_origem_aberta')$q$,
    'f5100000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000002', e2e.v('rgo_r1_reg')));
SELECT e2e.bpasso('rgo_r1_chegou', 'RGO.R1.11.alta', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico dá a alta por transferência escolhendo a regulação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', 'Transferido pela regulação (teste R1)', jsonb_build_object('destino', 'Hospital Fase 5', 'regulacao_id', %L))::text$q$,
    e2e.u('rgo_r1_ep'), e2e.v('rgo_r1_reg')));
SELECT e2e.bpasso('rgo_r1_chegou', 'RGO.R1.12.realizada', 'banco', NULL, 'Realizada na hora da chegada; saída marcada pela alta',
  format($q$SELECT e2e.b_confere(status = 'realizada' AND realizada_em = chegada_em AND saida_em IS NOT NULL AND origem_encerrada_em IS NOT NULL, status)
    FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('rgo_r1_reg')));

-- ── rodada 2 ─────────────────────────────────────────────────────────────
SELECT e2e.bpasso(NULL, 'RGO.R2.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor torácica (teste da regulação com a origem aberta, rodada 2)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'rgo_r2_ep');
SELECT e2e.bpasso('rgo_r2_ep', 'RGO.R2.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('rgo_r2_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('rgo_r2_ep', 'RGO.R2.03.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica laranja (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('rgo_r2_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":104,"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":92,"frequencia-respiratoria":20,"saturacao-o2":95,"temperatura":36.6,"escala-dor":8}',
    'Mal-estar geral', 'Dor torácica (texto da enfermeira de teste)'), 'ok', 'rgo_r2_class');
SELECT e2e.bpasso('rgo_r2_class', 'RGO.R2.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('rgo_r2_ep')));
SELECT e2e.bpasso('rgo_r2_class', 'RGO.R2.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste (I21.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor torácica (teste)', 'ECG de teste', 'Síndrome coronariana aguda', 'Transferir pela regulação', 'I21.9')::text$q$, e2e.u('rgo_r2_ep')));
SELECT e2e.bpasso('rgo_r2_class', 'RGO.R2.05.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência para leito clínico, ambulância avançada',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('rgo_pac'),
    jsonb_build_object('tipo', 'transferencia', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'procedimento', '0303060190', 'cid', 'I21.9',
      'carater', 'urgencia', 'prioridade', 'emergencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('rgo_r2_ep'),
      'quadro_clinico', 'Dor torácica típica com sudorese (dado fictício, teste da regulação com a origem aberta).',
      'telefone_contato', '(11) 0000-0009')), 'ok', 'rgo_r2_reg');
SELECT e2e.bpasso('rgo_r2_reg', 'RGO.R2.06.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 80)', e2e.u('rgo_r2_reg')));
SELECT e2e.bpasso('rgo_r2_reg', 'RGO.R2.06.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '2 hours', 'teste da origem aberta')::text, 80)$q$,
    e2e.u('rgo_r2_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.bpasso('rgo_r2_reg', 'RGO.R2.07.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita (transferência sem leito)',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, NULL, 'aceito no teste da origem aberta')::text, 80)$q$, e2e.u('rgo_r2_reg')), 'ok', 'rgo_r2_aceita');

-- R2: a ordem certa (alta antes da chegada)
SELECT e2e.bpasso('rgo_r2_aceita', 'RGO.R2.08.alta', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico dá a alta por transferência escolhendo a regulação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', 'Transferido pela regulação (teste R2)', jsonb_build_object('destino', 'Hospital Fase 5', 'regulacao_id', %L))::text$q$,
    e2e.u('rgo_r2_ep'), e2e.v('rgo_r2_reg')));
SELECT e2e.bpasso('rgo_r2_aceita', 'RGO.R2.09.saiu', 'banco', NULL, 'A alta marcou a saída (em trânsito)',
  format($q$SELECT e2e.b_confere(status = 'em_transito' AND saida_em IS NOT NULL AND chegada_em IS NULL, status) FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('rgo_r2_reg')));
SELECT e2e.bpasso('rgo_r2_aceita', 'RGO.R2.10.chegada', 'f5_med_hosp', '/regulacao (destino)', 'Hospital marca a chegada',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Chegou (teste R2)')::text, 80)$q$, e2e.u('rgo_r2_reg')));
SELECT e2e.bpasso('rgo_r2_aceita', 'RGO.R2.11.realizada', 'banco', NULL, 'Realizada direto',
  format($q$SELECT e2e.b_confere(status = 'realizada' AND realizada_em = chegada_em, status) FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.u('rgo_r2_reg')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 140) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'RGO.%' AND em >= e2e.v('rgo_inicio')::timestamptz ORDER BY id;
