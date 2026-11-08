-- ════════════════════════════════════════════════════════════════════════════
-- Conferência da tela do item 16 (a enfermagem vê a chegada regulada no leito
-- reservado) na homologação, 08/11/2026.
--
-- Deixa um paciente NOVO ("Chegada Enfermagem Teste", UPA F5) em observação,
-- com regulação de transferência autorizada para o Hospital F5 e aceita com o
-- leito UTI-02 reservado. O plantão de agora da enfermeira do Hospital F5
-- (enfermeiro.hospital.f5) passa da Porta do Hospital para a UTI Adulto, para
-- ela ver o leito reservado; o 106b desfaz a troca.
-- A saída da origem fica para depois (106b), com a tela aberta, para ver o
-- aviso de saída. Cada passo roda como a conta do papel (e2e.bpasso, do 60).
-- A cor é da enfermeira de teste; sinais crus; nenhuma dose.
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM e2e.vars WHERE nome LIKE 'ce8\_%';
SELECT e2e.b_guardar('ce8_inicio', now()::text);

-- o plantão de agora da enfermeira do hospital vai para a UTI Adulto (o 106b devolve)
SELECT e2e.b_guardar('ce8_escala', (
  SELECT e.id::text FROM public.escala_plantao e JOIN auth.users u ON u.id = e.perfil_id
   WHERE u.email = 'enfermeiro.hospital.f5@teste.local'
     AND e.inicio <= now() AND e.inicio + e.duracao_min * interval '1 minute' > now()
   ORDER BY e.inicio DESC LIMIT 1));
SELECT e2e.b_guardar('ce8_setor_antes', (SELECT setor_id::text FROM public.escala_plantao WHERE id = e2e.v('ce8_escala')::uuid));
UPDATE public.escala_plantao SET setor_id = 'f5300000-0000-4000-8000-000000000022' WHERE id = e2e.v('ce8_escala')::uuid;

SELECT e2e.bpasso(NULL, 'CE8.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de um paciente novo no PS',
  $q$SELECT (public.registrar_ficha('f5300000-0000-4000-8000-000000000011'::uuid, 'Dispneia (conferência da chegada pela enfermagem)', NULL,
      '{"nome":"Chegada Enfermagem Teste","data_nascimento":"1961-05-05","sexo":"F","cns":"700900000007680"}'::jsonb) ->> 'episodio_id')$q$, 'ok', 'ce8_ep');
SELECT e2e.bpasso('ce8_ep', 'CE8.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('ce8_ep')), 'ok', 'ce8_pac');
SELECT e2e.bpasso('ce8_ep', 'CE8.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('ce8_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('ce8_ep', 'CE8.03.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica laranja (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('ce8_ep'), 'f5100000-0000-4000-8000-000000000002', 'laranja',
    '{"frequencia-cardiaca":110,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":84,"frequencia-respiratoria":28,"saturacao-o2":89,"temperatura":37.8,"escala-dor":3}',
    'Mal-estar geral', 'Dispneia (texto da enfermeira de teste)'), 'ok', 'ce8_class');
SELECT e2e.bpasso('ce8_class', 'CE8.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico da porta assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ce8_ep')));
SELECT e2e.bpasso('ce8_class', 'CE8.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste (J96.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dispneia (teste)', 'Gasometria de teste', 'Insuficiência respiratória aguda', 'Observação e regulação para UTI', 'J96.0')::text$q$, e2e.u('ce8_ep')));
SELECT e2e.bpasso('ce8_class', 'CE8.05.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico da porta põe em observação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('ce8_ep')));
-- sem alergia registrada: na execução de 08/11, registrar_alergia voltou "Acesso negado"
-- para a enfermeira e para o médico da porta neste paciente; a lista de alergias
-- da chegada fica coberta pelo teste supabase/tests/fix_enfermagem_chegadas.sql.
SELECT e2e.bpasso('ce8_class', 'CE8.06.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência para UTI, ambulância avançada',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('ce8_pac'),
    jsonb_build_object('tipo', 'transferencia', 'tipo_leito', 'uti_adulto', 'transporte', 'ambulancia_avancada', 'procedimento', '0303060190', 'cid', 'J96.0',
      'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('ce8_ep'),
      'quadro_clinico', 'Insuficiência respiratória aguda (dado fictício, conferência da chegada pela enfermagem).', 'telefone_contato', '(11) 0000-0011')), 'ok', 'ce8_reg');
SELECT e2e.bpasso('ce8_reg', 'CE8.07.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 40)', e2e.u('ce8_reg')));
SELECT e2e.bpasso('ce8_reg', 'CE8.07.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '2 hours', 'conferência da chegada pela enfermagem')::text, 40)$q$,
    e2e.u('ce8_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.bpasso('ce8_reg', 'CE8.08.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita com o leito UTI-02 reservado',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, (SELECT l.id FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000022' AND l.identificador = 'UTI-02'), 'aceito com UTI-02 (conferência)')::text, 40)$q$, e2e.u('ce8_reg')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 120) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'CE8.%' AND em >= e2e.v('ce8_inicio')::timestamptz ORDER BY id;
