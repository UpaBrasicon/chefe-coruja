-- Conferência das telas de 08/11/2026 (noite): paciente novo "Observacao Tela Teste" em observação na UPA F5,
-- aberta por medico.upa.f5, com o primeiro atendimento da observação (libera o Reavaliar). Para conferir no
-- navegador o botão "Alergias" (item 17) e o "Reavaliar" (item 4) em "Observações que você abriu".
DELETE FROM e2e.vars WHERE nome LIKE 'ob8\_%';
SELECT e2e.b_guardar('ob8_inicio', now()::text);
SELECT e2e.bpasso(NULL, 'OB8.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de um paciente novo no PS',
  $q$SELECT (public.registrar_ficha('f5300000-0000-4000-8000-000000000011'::uuid, 'Dor abdominal (conferência das telas da observação)', NULL,
      '{"nome":"Observacao Tela Teste","data_nascimento":"1975-07-07","sexo":"M","cns":"700900000007753"}'::jsonb) ->> 'episodio_id')$q$, 'ok', 'ob8_ep');
SELECT e2e.bpasso('ob8_ep', 'OB8.01.paciente', 'banco', NULL, 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('ob8_ep')), 'ok', 'ob8_pac');
SELECT e2e.bpasso('ob8_ep', 'OB8.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('ob8_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('ob8_ep', 'OB8.03.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica amarelo (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('ob8_ep'), 'f5100000-0000-4000-8000-000000000002', 'amarelo',
    '{"frequencia-cardiaca":96,"pressao-arterial-sistolica":128,"pressao-arterial-diastolica":80,"frequencia-respiratoria":18,"saturacao-o2":97,"temperatura":37.2,"escala-dor":6}',
    'Mal-estar geral', 'Dor abdominal (texto da enfermeira de teste)'), 'ok', 'ob8_class');
SELECT e2e.bpasso('ob8_class', 'OB8.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico da porta assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ob8_ep')));
SELECT e2e.bpasso('ob8_class', 'OB8.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste (R10.4)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor abdominal (teste)', 'Abdome doloroso (teste)', 'Dor abdominal a esclarecer', 'Observação e reavaliação', 'R10.4')::text$q$, e2e.u('ob8_ep')));
SELECT e2e.bpasso('ob8_class', 'OB8.05.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico da porta põe em observação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('ob8_ep')));
SELECT e2e.b_guardar('ob8_int', (SELECT id::text FROM public.internacoes WHERE episodio_id = e2e.v('ob8_ep')::uuid));
SELECT e2e.bpasso('ob8_int', 'OB8.06.atender', 'f5_med_obs', '/observacao', 'Médico da observação registra o primeiro atendimento (libera o Reavaliar)',
  format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('ob8_int')));
SELECT passo, situacao, left(coalesce(detalhe, ''), 100) FROM e2e.resultados WHERE passo LIKE 'OB8.%' AND em >= e2e.v('ob8_inicio')::timestamptz ORDER BY id;
