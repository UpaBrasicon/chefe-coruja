-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado P1-1 do A01 (passo 26) depois da
-- 20270308000001_chegada_regulada_interna.sql (decisão do RT em 07/11/2026:
-- A em R1 a R6).
--
-- "Rosa Teste Arquivo" (UPA F5, do 92) sai da porta da UPA por regulação de
-- leito clínico para o Hospital F5, com leito reservado no aceite. Sem passar
-- pela porta do hospital: o médico do hospital marca a chegada e ela é
-- internada no leito reservado, com cadastro, episódio e só a conta de
-- internação. Passos pelas RPCs das telas, cada um como a conta do papel
-- (e2e.bpasso, do 60). Nenhuma dose; a cor é da enfermeira de teste.
-- Rodar antes: 41_checkin_fase5.sql. Deixa Rosa internada no hospital.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'chr\_%';
SELECT e2e.b_guardar('chr_inicio', now()::text);
SELECT e2e.b_guardar('chr_pac', '8e06379f-5191-448c-9f03-b0b188bd4bef');

SELECT e2e.bpasso(NULL, 'CHR.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS da UPA',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Pneumonia (teste da chegada regulada)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'chr_ep');
SELECT e2e.bpasso('chr_ep', 'CHR.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('chr_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('chr_ep', 'CHR.03.classificar', 'f5_enf_upa', '/triagem (Classificar)', 'Classifica amarelo (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('chr_ep'), 'f5100000-0000-4000-8000-000000000002', 'amarelo',
    '{"frequencia-cardiaca":102,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":72,"frequencia-respiratoria":24,"saturacao-o2":92,"temperatura":38.6,"escala-dor":3}',
    'Mal-estar geral', 'Febre e tosse (texto da enfermeira de teste)'), 'ok', 'chr_class');
SELECT e2e.bpasso('chr_class', 'CHR.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('chr_ep')));
SELECT e2e.bpasso('chr_class', 'CHR.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste (J18.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Febre e tosse (teste)', 'Crepitações em base direita', 'Pneumonia', 'Internar pela regulação', 'J18.9')::text$q$, e2e.u('chr_ep')));
SELECT e2e.bpasso('chr_class', 'CHR.05.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Pedido de leito clínico',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('chr_pac'),
    jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303140151', 'cid', 'J18.9',
      'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('chr_ep'),
      'quadro_clinico', 'Pneumonia com hipoxemia leve, precisa de leito clínico (dado fictício, teste da chegada regulada).',
      'telefone_contato', '(11) 0000-0010')), 'ok', 'chr_reg');
SELECT e2e.bpasso('chr_reg', 'CHR.06.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 60)', e2e.u('chr_reg')));
SELECT e2e.bpasso('chr_reg', 'CHR.06.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_basica', now() + interval '2 hours', 'teste da chegada regulada')::text, 60)$q$,
    e2e.u('chr_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.bpasso('chr_reg', 'CHR.07.leito', 'f5_med_hosp', '/regulacao (destino)', 'Leito livre oferecido ao destino',
  format($q$SELECT (public.regulacao_leitos_destino(%L::uuid) -> 0 ->> 'id')$q$, e2e.u('chr_reg')), 'ok', 'chr_leito');
SELECT e2e.bpasso('chr_leito', 'CHR.07.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Hospital aceita e reserva o leito',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, %L::uuid, 'aceito no teste da chegada regulada')::text, 60)$q$, e2e.u('chr_reg'), e2e.u('chr_leito')), 'ok', 'chr_aceita');
SELECT e2e.bpasso('chr_aceita', 'CHR.08.alta_origem', 'f5_med_upa', '/atendimento (Desfecho)', 'Alta por transferência na UPA, com a regulação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', 'Transferida pela regulação (teste)', jsonb_build_object('destino', 'Hospital Fase 5', 'regulacao_id', %L))::text$q$,
    e2e.u('chr_ep'), e2e.v('chr_reg')));
SELECT e2e.bpasso('chr_aceita', 'CHR.09.chegada', 'f5_med_hosp', '/regulacao (destino)', 'Hospital marca a chegada: interna no leito reservado, sem porta',
  format($q$SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, 'Chegou (teste da chegada regulada)')::text, 60)$q$, e2e.u('chr_reg')), 'ok', 'chr_chegou');
SELECT e2e.bpasso('chr_chegou', 'CHR.10.internacao', 'banco', NULL, 'Realizada; internação no leito reservado, origem outra unidade, episódio em internação',
  format($q$SELECT e2e.b_confere(s.status = 'realizada' AND i.status = 'internado' AND i.origem_admissao = 'outra_unidade'
      AND i.leito_atual_id = %L AND e.etapa = 'internacao' AND p.unidade_id = 'f5100000-0000-4000-8000-000000000003',
      s.status || ' / ' || i.status || ' / ' || i.origem_admissao || ' / ' || e.etapa)
    FROM public.regulacao_solicitacoes s JOIN public.internacoes i ON i.id = s.destino_internacao_id
    JOIN public.episodios e ON e.id = s.destino_episodio_id JOIN public.pacientes p ON p.id = s.destino_paciente_id
   WHERE s.id = %L$q$, e2e.v('chr_leito'), e2e.v('chr_reg')));
SELECT e2e.bpasso('chr_chegou', 'CHR.11.contas', 'banco', NULL, 'Só a conta de internação no hospital (nenhuma de porta)',
  format($q$SELECT e2e.b_confere(
      NOT EXISTS (SELECT 1 FROM public.contas WHERE episodio_id = s.destino_episodio_id AND tipo = 'ambulatorial')
      AND EXISTS (SELECT 1 FROM public.contas WHERE internacao_id = s.destino_internacao_id AND tipo = 'internacao'), 'conta de internação, sem porta')
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.v('chr_reg')));
SELECT e2e.bpasso('chr_chegou', 'CHR.12.internada', 'banco', NULL, 'Rosa segue internada no hospital (aparece em Pacientes internados)',
  format($q$SELECT e2e.b_confere(EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = s.destino_internacao_id AND i.data_alta IS NULL), 'internada')
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.v('chr_reg')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 140) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'CHR.%' AND em >= e2e.v('chr_inicio')::timestamptz ORDER BY id;
