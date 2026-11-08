-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado B P2-2 (B01, passos B01.13.parecer e
-- B01.13.reavaliar_ps) depois da 20270307000005_observacao_quem_abriu_parecer
-- (07/11/2026).
--
-- No B01, o médico do PS que abriu a observação foi recusado ao pedir parecer
-- e ao marcar a reavaliação. Aqui, o mesmo médico (f5_med_upa) põe Rosa em
-- observação pela porta, lê a lista de pareceres, pede parecer, marca a
-- reavaliação (depois do primeiro atendimento da observação, pelo médico
-- escalado lá), cancela o próprio pedido e encerra a observação com alta.
--
-- Paciente: "Rosa Teste Arquivo" (UPA F5, do 92), numa ficha nova no PS. Cada
-- passo roda como a conta do papel (e2e.bpasso, do 60). A cor é da
-- enfermeira de teste; sinais crus; nenhuma dose.
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'par\_%';
SELECT e2e.b_guardar('par_inicio', now()::text);
SELECT e2e.b_guardar('par_pac', '8e06379f-5191-448c-9f03-b0b188bd4bef');

SELECT e2e.bpasso(NULL, 'PAR.01.ficha', 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Rosa no PS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor abdominal (teste do parecer de quem abriu a observação)', %L::uuid, NULL) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', '8e06379f-5191-448c-9f03-b0b188bd4bef'), 'ok', 'par_ep');
SELECT e2e.bpasso('par_ep', 'PAR.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('par_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.bpasso('par_ep', 'PAR.03.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Classifica amarelo (escolha da enfermeira de teste), sinais crus',
  e2e.b_classificar_sql(e2e.u('par_ep'), 'f5100000-0000-4000-8000-000000000002', 'amarelo',
    '{"frequencia-cardiaca":98,"pressao-arterial-sistolica":124,"pressao-arterial-diastolica":80,"frequencia-respiratoria":18,"saturacao-o2":97,"temperatura":37.6,"escala-dor":7}',
    'Mal-estar geral', 'Dor abdominal (texto da enfermeira de teste)'), 'ok', 'par_class');
SELECT e2e.bpasso('par_class', 'PAR.04.iniciar', 'f5_med_upa', '/atendimento', 'Médico do PS assume o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('par_ep')));
SELECT e2e.bpasso('par_class', 'PAR.04.soap', 'f5_med_upa', '/atendimento', 'SOAP do teste',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor abdominal há 6 horas (teste)', 'Abdome doloroso, sem peritonite', 'Dor abdominal a esclarecer', 'Observação e reavaliação', 'R10.4')::text$q$, e2e.u('par_ep')));
SELECT e2e.bpasso('par_class', 'PAR.05.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico do PS põe em observação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('par_ep')));
SELECT e2e.bpasso('par_class', 'PAR.05.internacao', 'banco', NULL, 'Internação de observação do episódio',
  format($q$SELECT id::text FROM public.internacoes WHERE episodio_id = %L AND status = 'em_observacao'$q$, e2e.u('par_ep')), 'ok', 'par_int');

-- ── quem abriu: parecer ─────────────────────────────────────────────────────
SELECT e2e.bpasso('par_int', 'PAR.06.lista', 'f5_med_upa', '/plantao/observacao (Observações que você abriu)', 'O médico do PS lê a lista de pareceres',
  format('SELECT count(*)::text || %L FROM public.pareceres_do_paciente(%L::uuid)', ' pareceres', e2e.u('par_pac')));
SELECT e2e.bpasso('par_int', 'PAR.06.parecer', 'f5_med_upa', '/plantao/observacao (Observações que você abriu)',
  'O médico do PS pede parecer de Cirurgia geral (antes: "só o médico que está com o paciente")',
  format($q$SELECT public.solicitar_parecer(%L::uuid, 'Cirurgia geral', 'Dor abdominal em observação: avaliar abdome agudo cirúrgico (teste)', 'urgencia')::text$q$, e2e.u('par_pac')),
  'ok', 'par_parecer');

-- ── quem abriu: reavaliação ─────────────────────────────────────────────────
SELECT e2e.bpasso('par_int', 'PAR.07.reavaliar_antes', 'f5_med_upa', '/plantao/observacao (Observações que você abriu)',
  'Reavaliação antes do primeiro atendimento da observação (a regra de sempre)',
  format('SELECT public.observacao_reavaliar(%L::uuid, %L::timestamptz)::text', e2e.u('par_int'), now() + interval '1 hour'),
  'erro:Registre o atendimento antes de marcar a reavaliação');
SELECT e2e.bpasso('par_int', 'PAR.08.atender_obs', 'f5_med_obs', '/plantao/observacao', 'Médico escalado na observação registra o atendimento',
  format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('par_int')));
SELECT e2e.bpasso('par_int', 'PAR.09.reavaliar', 'f5_med_upa', '/plantao/observacao (Observações que você abriu)',
  'O médico do PS marca a reavaliação em 1 h (antes: "você não está de plantão no setor")',
  format('SELECT public.observacao_reavaliar(%L::uuid, %L::timestamptz)::text', e2e.u('par_int'), now() + interval '1 hour'), 'ok', 'par_reav');
SELECT e2e.bpasso('par_reav', 'PAR.09.autores', 'banco', NULL, 'Parecer e reavaliação com autor = login do médico do PS',
  format($q$SELECT e2e.b_confere(
      (SELECT solicitante_id FROM public.pareceres_medicos WHERE id = %L) = (SELECT autor_id FROM public.pendencias WHERE id = %L),
      'mesmo autor nos dois registros')$q$, e2e.u('par_parecer'), e2e.u('par_reav')));

-- ── fim: cancela o pedido e encerra com alta ────────────────────────────────
SELECT e2e.bpasso('par_parecer', 'PAR.99.cancelar', 'f5_med_upa', '/plantao/observacao', 'Cancela o próprio pedido de parecer (fim do teste)',
  format($q$SELECT public.cancelar_parecer(%L::uuid, 'Fim do teste do parecer de quem abriu a observação')::text$q$, e2e.u('par_parecer')));
SELECT e2e.bpasso('par_int', 'PAR.99.alta', 'f5_med_upa', '/plantao/observacao (Observações que você abriu)', 'O médico do PS encerra a observação com alta',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'alta_medica', 'R10.4', 'Alta ao fim do teste do parecer de quem abriu a observação', '{}'::jsonb)::text$q$, e2e.u('par_int')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 160) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'PAR.%' AND em >= e2e.v('par_inicio')::timestamptz ORDER BY id;
