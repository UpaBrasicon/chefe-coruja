-- ════════════════════════════════════════════════════════════════════════════
-- Conferência das telas novas na homologação (08/11/2026): itens 4, 5, 6 e 12
-- da fila do teste da rede.
--
-- Deixa um paciente NOVO ("Tela Chegada Teste", UPA F5) em observação, aberta
-- pelo médico da porta (medico.upa.f5), com regulação de transferência
-- autorizada para o Hospital F5 e aceita SEM leito reservado. Na tela:
--   • medico.upa.f5: Central (conta "observação que você abriu"), "Observações
--     que você abriu" (Reavaliar, Pedir parecer, Encerrar) e, no encerramento
--     por transferência, a escolha da regulação;
--   • medico.hospital.f5: "Paciente chegou" com a lista de leitos livres.
-- Cada passo roda como a conta do papel (e2e.bpasso, do 60). A cor é da
-- enfermeira de teste; sinais crus; nenhuma dose.
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'tl8\_%';
SELECT e2e.b_guardar('tl8_inicio', now()::text);

SELECT e2e.bpasso(NULL, 'TL8.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de um paciente novo no PS',
  $q$SELECT (public.registrar_ficha('f5300000-0000-4000-8000-000000000011'::uuid, 'Dor torácica (conferência das telas 08/11)', NULL,
      '{"nome":"Tela Chegada Teste","data_nascimento":"1958-03-03","sexo":"M","cns":"700900000007567"}'::jsonb) ->> 'episodio_id')$q$, 'ok', 'tl8_ep');
SELECT e2e.bpasso('tl8_ep', 'TL8.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('tl8_ep')), 'ok', 'tl8_pac');
SELECT e2e.bpasso('tl8_ep', 'TL8.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('tl8_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('tl8_ep', 'TL8.03.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica laranja (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('tl8_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":102,"pressao-arterial-sistolica":146,"pressao-arterial-diastolica":90,"frequencia-respiratoria":20,"saturacao-o2":95,"temperatura":36.7,"escala-dor":7}',
    'Mal-estar geral', 'Dor torácica (texto da enfermeira de teste)'), 'ok', 'tl8_class');
SELECT e2e.bpasso('tl8_class', 'TL8.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico da porta assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('tl8_ep')));
SELECT e2e.bpasso('tl8_class', 'TL8.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste (I20.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor torácica (teste)', 'ECG de teste', 'Angina instável', 'Observação e regulação', 'I20.0')::text$q$, e2e.u('tl8_ep')));
SELECT e2e.bpasso('tl8_class', 'TL8.05.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico da porta põe em observação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('tl8_ep')));
SELECT e2e.bpasso('tl8_class', 'TL8.06.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência, ambulância avançada',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('tl8_pac'),
    jsonb_build_object('tipo', 'transferencia', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada', 'procedimento', '0303060190', 'cid', 'I20.0',
      'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('tl8_ep'),
      'quadro_clinico', 'Dor torácica com alteração de ECG (dado fictício, conferência das telas 08/11).', 'telefone_contato', '(11) 0000-0011')), 'ok', 'tl8_reg');
SELECT e2e.bpasso('tl8_reg', 'TL8.07.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 40)', e2e.u('tl8_reg')));
SELECT e2e.bpasso('tl8_reg', 'TL8.07.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '2 hours', 'conferência das telas')::text, 40)$q$,
    e2e.u('tl8_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.bpasso('tl8_reg', 'TL8.08.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita a transferência sem leito reservado',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, NULL, 'aceito sem leito (conferência das telas)')::text, 40)$q$, e2e.u('tl8_reg')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 120) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'TL8.%' AND em >= e2e.v('tl8_inicio')::timestamptz ORDER BY id;
