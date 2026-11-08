-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado A P2-2 (A03, rodada 1) depois da
-- 20270307000003_prescrever_atendimento_aberto.sql (07/11/2026).
--
-- No A03, com o paciente ainda na triagem, o médico prescreveu, o
-- farmacêutico dispensou e a enfermagem checou. Aqui: com a ficha recém-aberta
-- (triagem, sem classificação), a prescrição é recusada; depois da
-- classificação e com o atendimento aberto pelo médico, é aceita.
--
-- Paciente: "Rosa Teste Arquivo" (UPA F5, do 92), numa ficha nova no PS. Cada
-- passo roda como a conta do papel (e2e.bpasso, do 60). Dose: só texto de
-- teste. A cor é da enfermeira de teste; sinais crus. No fim, alta da porta.
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'ptr\_%';
SELECT e2e.b_guardar('ptr_inicio', now()::text);
SELECT e2e.b_guardar('ptr_pac', '8e06379f-5191-448c-9f03-b0b188bd4bef');

SELECT e2e.bpasso(NULL, 'PTR.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor lombar (teste da prescrição na triagem)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'ptr_ep');
SELECT e2e.bpasso('ptr_ep', 'PTR.02.peso', 'f5_enf_upa', '/triagem', 'Peso referido deste atendimento (para a trava do peso não esconder a regra nova)',
  e2e.b_sinais(e2e.u('ptr_pac'), '{"peso":68}', NULL, 'referido'));

-- ── na triagem: recusado ────────────────────────────────────────────────────
SELECT e2e.bpasso('ptr_ep', 'PTR.03.prescrever_triagem', 'f5_med_upa', '/atendimento (Prescrição)',
  'Médico tenta prescrever com a paciente na triagem (deve ser recusado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('ptr_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '0b13f981-90da-4237-93d7-d118d2055cfa', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'erro:Abra o atendimento antes de prescrever');
SELECT e2e.bpasso('ptr_ep', 'PTR.03.nada_gravado', 'banco', NULL, 'Nenhum item de prescrição no episódio',
  format($q$SELECT e2e.b_confere(count(*) = 0, count(*) || ' itens')
    FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id WHERE p.episodio_id = %L$q$, e2e.u('ptr_ep')));

-- ── depois da classificação e do atendimento aberto: aceito ─────────────────
SELECT e2e.bpasso('ptr_ep', 'PTR.04.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('ptr_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('ptr_ep', 'PTR.05.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica verde (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('ptr_ep'), 'f5100000-0000-4000-8000-000000000002', 'verde',
    '{"frequencia-cardiaca":84,"pressao-arterial-sistolica":126,"pressao-arterial-diastolica":80,"frequencia-respiratoria":16,"saturacao-o2":98,"temperatura":36.5,"escala-dor":5}',
    'Mal-estar geral', 'Dor lombar (texto da enfermeira de teste)'), 'ok', 'ptr_class');
SELECT e2e.bpasso('ptr_class', 'PTR.06.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ptr_ep')));
SELECT e2e.bpasso('ptr_class', 'PTR.07.prescrever', 'f5_med_upa', '/atendimento (Prescrição)', 'Prescreve com o atendimento aberto',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('ptr_pac'),
    jsonb_build_object('tipo', 'cuidado', 'descricao', 'Repouso no box (teste de fluxo)')), 'ok', 'ptr_item');

-- ── fim: alta da porta ──────────────────────────────────────────────────────
SELECT e2e.bpasso('ptr_ep', 'PTR.99.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor lombar (teste da prescrição na triagem)', 'Sem sinais de alarme', 'Lombalgia', 'Conduta de teste de fluxo', 'M54.5')::text$q$, e2e.u('ptr_ep')));
SELECT e2e.bpasso('ptr_ep', 'PTR.99.alta', 'f5_med_upa', '/atendimento (Desfecho)', 'Alta da porta (encerra o cenário)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', 'Alta ao fim do teste da prescrição na triagem', '{}'::jsonb)::text$q$, e2e.u('ptr_ep')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 160) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'PTR.%' AND em >= e2e.v('ptr_inicio')::timestamptz ORDER BY id;
