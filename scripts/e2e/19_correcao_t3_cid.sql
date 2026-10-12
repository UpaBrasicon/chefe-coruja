-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 3 — regressão do CID conferido contra a CID-10.
-- Roda depois de 01–04 e 10–18, no mesmo banco, com a CID-10 carregada.
-- Pacientes novos #27 a #29 ("E2E T3 ..."); usa e2e.t1_porta e e2e.t1_internar
-- do script 17.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM terminologia.cid10) THEN
    RAISE EXCEPTION 'A CID-10 não está carregada neste banco: a regressão da tarefa 3 precisa dela.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E T3 SOAP') THEN
    RAISE EXCEPTION 'A regressão da tarefa 3 já rodou neste banco (limpe com 99 e rode de novo).';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION e2e.t3_soap(p_n int, p_cid text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('ep' || p_n),
    'Queixa de teste E2E.', 'Exame de teste E2E.', 'Hipótese de teste E2E.', 'Plano de teste E2E.', p_cid)
$$;

-- ── SOAP ────────────────────────────────────────────────────────────────────
SELECT e2e.t1_porta(27, 'E2E T3 SOAP', 'K35.9', NULL);
SELECT e2e.passo('T3.soap_oms', 27, 'plantonista', '/plantao/porta', 'SOAP com K35.8 (OMS, fora da tabela do DATASUS) é recusado',
  e2e.t3_soap(27, 'K35.8'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.soap_covid', 27, 'plantonista', '/plantao/porta', 'SOAP com U07.1 (fora da tabela carregada) é recusado',
  e2e.t3_soap(27, 'U07.1'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.soap_texto', 27, 'plantonista', '/plantao/porta', 'SOAP com texto no lugar do código é recusado',
  e2e.t3_soap(27, 'apendicite'), 'erro:CID fora do formato');
SELECT e2e.passo('T3.soap_sem_ponto', 27, 'plantonista', '/plantao/porta', 'SOAP com K359 (sem ponto) é aceito', e2e.t3_soap(27, 'k359'));
SELECT e2e.conferir('T3.soap_normalizado', 27, 'O CID do SOAP fica gravado como K35.9',
  (SELECT cid FROM public.atendimento_registros WHERE episodio_id = e2e.u('ep27') ORDER BY criado_em DESC LIMIT 1) = 'K35.9',
  (SELECT string_agg(coalesce(cid, '-'), ',') FROM public.atendimento_registros WHERE episodio_id = e2e.u('ep27')));
SELECT e2e.passo('T3.soap_categoria', 27, 'plantonista', '/plantao/porta', 'SOAP com a categoria K35 é aceito', e2e.t3_soap(27, 'K35'));
SELECT e2e.passo('T3.soap_sem_cid', 27, 'plantonista', '/plantao/porta', 'SOAP sem CID continua aceito', e2e.t3_soap(27, NULL));

-- ── alta e óbito na porta ───────────────────────────────────────────────────
SELECT e2e.passo('T3.alta_porta_oms', 27, 'plantonista', '/plantao/porta', 'Alta na porta com CID N18.5 (fora da tabela) é recusada',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep27'), 'alta', '{"cid_alta":"N18.5"}'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.obito_porta_oms', 27, 'plantonista', '/plantao/porta', 'Óbito na porta com CID do óbito fora da tabela é recusado',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('ep27'), 'obito', 'Parada cardiorrespiratória na sala vermelha (teste E2E).',
         jsonb_build_object('hora_obito', now(), 'numero_do', '623456789', 'cid_obito', 'N18.5', 'cid_alta', 'K35.9')), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.alta_porta', 27, 'plantonista', '/plantao/porta', 'Alta na porta com K35.9',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep27'), 'alta', '{"cid_alta":"K35.9"}'));

-- ── alta da internação e agravo ─────────────────────────────────────────────
SELECT e2e.t1_porta(28, 'E2E T3 Internação', 'J18.9', NULL);
SELECT e2e.t1_internar(28);
SELECT e2e.passo('T3.agravo_oms', 28, 'plantonista2', '/internacao', 'Agravo suspeito com U07.1 (fora da tabela) é recusado',
  format('SELECT public.marcar_agravo(%L::uuid, %L, %L)::text', e2e.u('pac28'), 'Covid-19', 'U07.1'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.notificacao_oms', 28, 'plantonista2', '/internacao', 'Notificação compulsória com U07.1 é recusada',
  format('SELECT public.abrir_notificacao(%L::uuid, NULL, %L)::text', e2e.u('pac28'), 'U07.1'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.alta_internacao_oms', 28, 'plantonista2', '/internacao', 'Alta da internação com N18.5 é recusada',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int28'), 'alta_melhorada', 'N18.5'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.alta_internacao', 28, 'plantonista2', '/internacao', 'Alta da internação com J189 (sem ponto)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int28'), 'alta_melhorada', 'J189'));
SELECT e2e.conferir('T3.alta_normalizada', 28, 'O CID de alta fica gravado como J18.9',
  (SELECT cid_alta FROM public.internacoes WHERE id = e2e.u('int28')) = 'J18.9',
  (SELECT cid_alta FROM public.internacoes WHERE id = e2e.u('int28')));

-- ── observação ──────────────────────────────────────────────────────────────
SELECT e2e.t1_porta(29, 'E2E T3 Observação', 'R50.9', NULL);
SELECT e2e.passo('T3.observacao', 29, 'plantonista', '/plantao/porta', 'Vai para a observação',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep29'), 'observacao',
         jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000003')));
SELECT e2e.guardar('int29', (SELECT id::text FROM public.internacoes WHERE paciente_id = e2e.u('pac29') AND data_alta IS NULL LIMIT 1));
SELECT e2e.passo('T3.alta_observacao_oms', 29, 'plantonista2', '/observacao', 'Alta da observação com K35.8 é recusada',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('int29'), 'alta_medica', 'K35.8'), 'erro:Informe um CID-10 válido');
SELECT e2e.passo('T3.alta_observacao', 29, 'plantonista2', '/observacao', 'Alta da observação com R50.9',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('int29'), 'alta_medica', 'R50.9'));

SELECT passo, paciente, situacao, left(coalesce(detalhe, ''), 90) FROM e2e.resultados WHERE passo LIKE 'T3.%' AND situacao <> 'ok' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T3.%' GROUP BY 1 ORDER BY 1;
