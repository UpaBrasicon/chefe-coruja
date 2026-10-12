-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 1 — regressão do "fechar o que fica aberto no
-- desfecho" (P1-02 e P1-03). Roda depois de 01–04 e 10–16, no mesmo banco.
-- Pacientes novos #18 a #23 (nomes "E2E T1 ...").
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- paciente da porta até o atendimento, com exames e uma prescrição
CREATE OR REPLACE FUNCTION e2e.t1_porta(p_n int, p_nome text, p_cid text, p_exames text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_flux uuid := (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Mal-estar geral' AND publico = 'adulto');
BEGIN
  PERFORM e2e.passo('T1.ficha', p_n, 'recepcao', '/recepcao', 'Ficha',
    format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001',
           'Mal-estar (teste E2E)', jsonb_build_object('nome', p_nome, 'data_nascimento', '1960-0' || (p_n % 9 + 1) || '-1' || (p_n % 9), 'sexo', 'M')),
    'ok', 'ep' || p_n);
  PERFORM e2e.guardar('pac' || p_n, (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('ep' || p_n)));
  PERFORM e2e.passo('T1.classificar', p_n, 'enfermeiro', '/triagem', 'Classifica laranja',
    format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('ep' || p_n), 'laranja',
           '{"frequencia-cardiaca":118,"frequencia-respiratoria":24,"temperatura":38.6,"saturacao-o2":93,"escala-dor":4,"pressao-arterial-sistolica":92,"pressao-arterial-diastolica":58}',
           v_flux, e2e.disc('e1100000-0000-4000-8000-000000000001', v_flux, 'laranja')));
  PERFORM e2e.passo('T1.iniciar', p_n, 'plantonista', '/plantao/porta', 'Inicia atendimento', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ep' || p_n)));
  PERFORM e2e.passo('T1.soap', p_n, 'plantonista', '/plantao/porta', 'SOAP', format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('ep' || p_n),
    'Queixa de teste E2E.', 'Exame de teste E2E.', 'Hipótese de teste E2E.', 'Plano de teste E2E.', p_cid));
  IF p_exames IS NOT NULL THEN
    PERFORM e2e.passo('T1.exames', p_n, 'plantonista', '/plantao/porta', 'Pede exames',
      format('SELECT public.pedir_exames_atendimento(%L::uuid, %L::text[])::text', e2e.u('ep' || p_n), p_exames));
  END IF;
  PERFORM e2e.passo('T1.prescrever', p_n, 'plantonista', '/plantao/porta', 'Prescreve ceftriaxona',
    format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac' || p_n),
           jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Ceftriaxona'), 'dose', '2 g', 'via', 'endovenosa', 'posologia', '24/24h')));
END $$;

-- interna no setor Internação (sem leito) e guarda a internação
CREATE OR REPLACE FUNCTION e2e.t1_internar(p_n int) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM e2e.passo('T1.internar', p_n, 'plantonista', '/plantao/porta', 'Interna no setor Internação',
    format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep' || p_n), 'internacao',
           jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000005')));
  PERFORM e2e.guardar('int' || p_n, (SELECT id::text FROM public.internacoes WHERE paciente_id = e2e.u('pac' || p_n) AND data_alta IS NULL ORDER BY created_at DESC LIMIT 1));
END $$;

-- confere uma condição como postgres e registra ok/falha
CREATE OR REPLACE FUNCTION e2e.conferir(p_passo text, p_n int, p_descricao text, p_ok boolean, p_detalhe text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, 'banco', NULL, p_descricao, 'ok', CASE WHEN p_ok THEN 'ok' ELSE 'falha' END, p_detalhe);
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E T1 Obito Internado') THEN
    RAISE EXCEPTION 'A regressão da tarefa 1 já rodou neste banco (limpe com 99 e rode de novo).';
  END IF;
END $$;

-- ── #18: óbito na internação com tudo aberto ────────────────────────────────
SELECT e2e.t1_porta(18, 'E2E T1 Obito Internado', 'A41.9', ARRAY['Hemocultura', 'Lactato']);
SELECT e2e.t1_internar(18);
SELECT e2e.conferir('T1.porta_prescricao_continua', 18, 'A prescrição da porta continua ativa depois da internação',
  (SELECT count(*) FROM public.prescricoes WHERE paciente_id = e2e.u('pac18') AND status = 'ativa') = 1,
  (SELECT string_agg(status, ',') FROM public.prescricoes WHERE paciente_id = e2e.u('pac18')));
SELECT e2e.passo('T1.aprazar', 18, 'enfermeiro', '/enfermagem/internacao', 'Apraza a ceftriaxona',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.item(18, 'Ceftriaxona'), '{10:00}'));
SELECT e2e.passo('T1.parecer', 18, 'plantonista2', '/internacao', 'Pede parecer da infectologia',
  format('SELECT public.solicitar_parecer(%L::uuid, %L, %L, %L, NULL, NULL, %L::uuid)::text', e2e.u('pac18'), 'Cardiologia',
         'Avaliar função cardíaca no choque séptico (teste E2E).', 'urgencia', e2e.u('int18')));
SELECT e2e.passo('T1.pendencia', 18, 'plantonista2', '/internacao', 'Registra pendência impeditiva',
  format('SELECT public.registrar_pendencia(%L::uuid, %L, %L, %L, true)::text', e2e.u('int18'), 'outro', 'Conferir acesso central (teste E2E).', '4h'));
SELECT e2e.passo('T1.passagem', 18, 'plantonista2', '/internacao', 'Envia passagem de plantão (fica aguardando aceite)',
  format('SELECT public.enviar_passagem(%L::uuid, %L::uuid, %L)::text', e2e.u('int18'), e2e.conta('plantonista'), 'Choque séptico, em vasopressor (teste E2E).'));
SELECT e2e.passo('T1.obito', 18, 'plantonista2', '/internacao', 'Óbito com exame, parecer, pendência e passagem abertos (não trava)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('int18'), 'obito', 'A41.9',
         'Óbito após choque refratário (teste E2E).', jsonb_build_object('numero_do', '223456789', 'hora_obito', to_char(now(), 'HH24:MI'))));
SELECT e2e.conferir('T1.obito_exames_cancelados', 18, 'Exames sem resultado cancelados com o motivo "Óbito"',
  NOT EXISTS (SELECT 1 FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac18') AND (situacao <> 'cancelado' OR motivo_cancelamento NOT LIKE 'Óbito:%')),
  (SELECT string_agg(exame || '=' || situacao || ' (' || coalesce(motivo_cancelamento, '') || ')', '; ') FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac18')));
SELECT e2e.conferir('T1.obito_parecer_cancelado', 18, 'Parecer cancelado com documento de cancelamento',
  EXISTS (SELECT 1 FROM public.pareceres_medicos WHERE paciente_id = e2e.u('pac18') AND status = 'cancelado' AND documento_cancelamento_id IS NOT NULL),
  (SELECT string_agg(status, ',') FROM public.pareceres_medicos WHERE paciente_id = e2e.u('pac18')));
SELECT e2e.conferir('T1.obito_passagem_retirada', 18, 'Passagem de plantão retirada',
  EXISTS (SELECT 1 FROM public.passagens_plantao WHERE internacao_id = e2e.u('int18') AND situacao = 'retirada'),
  (SELECT string_agg(situacao, ',') FROM public.passagens_plantao WHERE internacao_id = e2e.u('int18')));
SELECT e2e.conferir('T1.obito_pendencia_cancelada', 18, 'Pendências canceladas',
  NOT EXISTS (SELECT 1 FROM public.pendencias WHERE internacao_id = e2e.u('int18') AND situacao = 'aberta'),
  (SELECT string_agg(tipo || '=' || situacao, ',') FROM public.pendencias WHERE internacao_id = e2e.u('int18')));
SELECT e2e.conferir('T1.obito_prescricoes_encerradas', 18, 'Prescrições (porta e internação) encerradas',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('pac18') AND status = 'ativa'),
  (SELECT string_agg(status, ',') FROM public.prescricoes WHERE paciente_id = e2e.u('pac18')));
SELECT e2e.conferir('T1.obito_auditoria', 18, 'Encerramentos automáticos na auditoria',
  (SELECT count(*) FROM public.log_auditoria WHERE acao IN ('encerrar_prescricao', 'cancelar_exame', 'cancelar_parecer', 'retirar_passagem', 'cancelar_pendencia') AND entidade_id IN (
     SELECT id FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac18') UNION ALL
     SELECT id FROM public.prescricoes WHERE paciente_id = e2e.u('pac18') UNION ALL
     SELECT id FROM public.pareceres_medicos WHERE paciente_id = e2e.u('pac18') UNION ALL
     SELECT id FROM public.pendencias WHERE internacao_id = e2e.u('int18') UNION ALL
     SELECT id FROM public.passagens_plantao WHERE internacao_id = e2e.u('int18'))) >= 6,
  NULL);

-- depois do óbito: escrita fechada, leitura por 24 h
SELECT e2e.passo('T1.checar_depois', 18, 'tecnico', '/checagem', 'Técnico tenta checar medicação do paciente que morreu (deve ser negado)',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', (SELECT it.id FROM public.prescricao_itens it JOIN public.prescricoes p ON p.id = it.prescricao_id WHERE p.paciente_id = e2e.u('pac18') LIMIT 1), 'feito', '10:00'), 'erro');
SELECT e2e.passo('T1.aprazar_depois', 18, 'enfermeiro', '/enfermagem/internacao', 'Enfermeira tenta aprazar depois do óbito (deve ser negado)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', (SELECT it.id FROM public.prescricao_itens it JOIN public.prescricoes p ON p.id = it.prescricao_id WHERE p.paciente_id = e2e.u('pac18') LIMIT 1), '{14:00}'), 'erro');
SELECT e2e.passo('T1.sinal_depois', 18, 'tecnico', '/enfermagem/internacao', 'Técnico tenta registrar sinal vital depois do óbito (deve ser negado)',
  e2e.sql_sinal(e2e.u('pac18'), 'frequencia-cardiaca', 80, e2e.u('int18')), 'erro');
SELECT e2e.passo('T1.evolucao_depois', 18, 'plantonista2', '/internacao', 'Médico tenta evoluir depois do óbito (deve ser negado)',
  format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('int18'), 'evolucao', 'Evolução depois do óbito (teste E2E).'), 'erro');
SELECT e2e.passo('T1.fila_checagem', NULL, 'tecnico', '/checagem', 'Fila de checagem sem paciente que saiu',
  $q$SELECT CASE WHEN count(*) = 0 THEN 'ok' ELSE e2e.falhar(count(*)::text) END FROM public.fila_checagem() f
       WHERE NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = f.paciente_id AND i.data_alta IS NULL)
         AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = f.paciente_id AND e.etapa <> 'encerrado')$q$);
SELECT e2e.passo('T1.leitura_24h', 18, 'plantonista2', '/internacao', 'Equipe do setor ainda lê os exames nas 24 h depois do óbito',
  format('SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar(''0 exames visíveis'') END FROM public.exames_pedidos WHERE paciente_id = %L', e2e.u('pac18')));
SELECT e2e.passo('T1.sumario_obito', 18, 'plantonista2', '/internacao', 'Sumário de óbito depois do óbito (documento da alta continua por 24 h)',
  format('SELECT (public.emitir_documento(%L::uuid, %L, %L) ->> ''id'')', e2e.u('pac18'), 'sumario_obito', 'Sumário de óbito de teste E2E: choque séptico refratário.'));
SELECT e2e.ajuste('T1.envelhecer_alta', 'Alta do #18 registrada há 25 h',
  format('UPDATE public.internacoes SET alta_registrada_em = now() - interval ''25 hours'', data_alta = now() - interval ''25 hours'' WHERE id = %L', e2e.u('int18')));
SELECT e2e.passo('T1.leitura_depois_24h', 18, 'plantonista2', '/internacao', 'Depois de 24 h a equipe do setor não lê mais (só por pedido de acesso)',
  format('SELECT CASE WHEN count(*) = 0 THEN ''0'' ELSE e2e.falhar(count(*)::text || '' exames visíveis'') END FROM public.exames_pedidos WHERE paciente_id = %L', e2e.u('pac18')));
SELECT e2e.passo('T1.documento_depois_24h', 18, 'plantonista2', '/internacao', 'Depois de 24 h a equipe não emite documento (deve ser negado)',
  format('SELECT (public.emitir_documento(%L::uuid, %L, %L) ->> ''id'')', e2e.u('pac18'), 'atestado', 'Atestado depois de 24 h (teste E2E).'), 'erro');

-- ── #19: óbito com agravo suspeito continua travando ────────────────────────
SELECT e2e.t1_porta(19, 'E2E T1 Obito Agravo', 'A39.0', NULL);
SELECT e2e.t1_internar(19);
SELECT e2e.passo('T1.agravo', 19, 'plantonista2', '/internacao', 'Marca suspeita de doença meningocócica',
  format('SELECT public.marcar_agravo(%L::uuid, %L, %L)::text', e2e.u('pac19'), 'Doença meningocócica', 'A39.0'), 'ok', 'agravo19');
SELECT e2e.passo('T1.obito_com_agravo', 19, 'plantonista2', '/internacao', 'Óbito com agravo suspeito sem notificação (deve travar)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('int19'), 'obito', 'A39.0',
         'Óbito por choque meningocócico (teste E2E).', jsonb_build_object('numero_do', '323456789', 'hora_obito', to_char(now(), 'HH24:MI'))), 'erro:Existe(m) pendência(s) em aberto: Agravo');
SELECT e2e.passo('T1.notificar', 19, 'plantonista2', '/internacao', 'Registra a notificação',
  format('SELECT public.resolver_agravo(%L::uuid, true, %L, NULL)::text', e2e.u('agravo19'), '1234567'));
SELECT e2e.passo('T1.obito_notificado', 19, 'plantonista2', '/internacao', 'Óbito depois da notificação',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('int19'), 'obito', 'A39.0',
         'Óbito por choque meningocócico (teste E2E).', jsonb_build_object('numero_do', '323456789', 'hora_obito', to_char(now(), 'HH24:MI'))));

-- ── #20: transferência externa com exame pendente ───────────────────────────
SELECT e2e.t1_porta(20, 'E2E T1 Transferido', 'I21.9', ARRAY['Troponina']);
SELECT e2e.t1_internar(20);
SELECT e2e.passo('T1.transferencia', 20, 'plantonista2', '/internacao', 'Transferência externa com troponina sem resultado (não trava)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L, NULL, NULL, %L, %L::jsonb)::text', e2e.u('int20'), 'transferencia_externa', 'I21.9',
         'Transferido para hemodinâmica (teste E2E).', '{"destino":"Hospital Terciário E2E"}'));
SELECT e2e.conferir('T1.transferencia_exame', 20, 'Exame cancelado com o motivo "Transferência externa"',
  EXISTS (SELECT 1 FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac20') AND situacao = 'cancelado' AND motivo_cancelamento LIKE 'Transferência externa:%'),
  (SELECT string_agg(situacao || ' (' || coalesce(motivo_cancelamento, '') || ')', '; ') FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac20')));
SELECT e2e.conferir('T1.transferencia_prescricao', 20, 'Prescrição encerrada na transferência',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('pac20') AND status = 'ativa'), NULL);

-- ── #21: alta melhorada continua exigindo o exame; cancelar a alta reabre a prescrição ──
SELECT e2e.t1_porta(21, 'E2E T1 Alta Melhorada', 'J18.9', ARRAY['Hemograma']);
SELECT e2e.t1_internar(21);
SELECT e2e.passo('T1.alta_com_exame', 21, 'plantonista2', '/internacao', 'Alta melhorada com exame sem resultado (continua travando)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int21'), 'alta_melhorada', 'J18.9'), 'erro:Existe(m) pendência(s) em aberto: Exame');
SELECT e2e.passo('T1.resultado', 21, 'plantonista2', '/internacao', 'Lança o resultado do hemograma',
  format('SELECT public.resolver_exame(%L::uuid, %L)::text', (SELECT id FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac21') LIMIT 1), 'Leucócitos 9.800 (teste E2E).'));
SELECT e2e.passo('T1.alta', 21, 'plantonista2', '/internacao', 'Alta melhorada',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int21'), 'alta_melhorada', 'J18.9'));
SELECT e2e.conferir('T1.alta_prescricao', 21, 'Prescrição encerrada na alta melhorada',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('pac21') AND status = 'ativa'), NULL);
SELECT e2e.passo('T1.cancelar_alta', 21, 'plantonista2', '/internacao', 'Cancela a alta',
  format('SELECT public.cancelar_alta(%L::uuid, %L)::text', e2e.u('int21'), 'Alta lançada no paciente errado (teste E2E).'));
SELECT e2e.conferir('T1.cancelar_alta_reabre', 21, 'Prescrições encerradas pela alta voltam a valer',
  (SELECT count(*) FROM public.prescricoes WHERE paciente_id = e2e.u('pac21') AND status = 'ativa') >= 1,
  (SELECT string_agg(status, ',') FROM public.prescricoes WHERE paciente_id = e2e.u('pac21')));

-- ── #22: alta na porta encerra a prescrição ─────────────────────────────────
SELECT e2e.t1_porta(22, 'E2E T1 Alta Porta', 'R50.9', NULL);
SELECT e2e.passo('T1.alta_porta', 22, 'plantonista', '/plantao/porta', 'Alta na porta',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep22'), 'alta', '{"cid_alta":"R50.9"}'));
SELECT e2e.conferir('T1.alta_porta_prescricao', 22, 'Prescrição da porta encerrada na alta',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('pac22') AND status = 'ativa'), NULL);

-- ── #23: óbito na porta com exame pendente ──────────────────────────────────
SELECT e2e.t1_porta(23, 'E2E T1 Obito Porta', 'I46.9', ARRAY['Gasometria arterial']);
SELECT e2e.passo('T1.obito_porta', 23, 'plantonista', '/plantao/porta', 'Óbito na porta com gasometria sem resultado',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('ep23'), 'obito', 'Parada cardiorrespiratória na sala vermelha (teste E2E).',
         jsonb_build_object('hora_obito', now(), 'numero_do', '423456789', 'cid_obito', 'I46.9', 'cid_alta', 'I46.9')));
SELECT e2e.conferir('T1.obito_porta_exame', 23, 'Exame da porta cancelado com o motivo "Óbito"',
  EXISTS (SELECT 1 FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac23') AND situacao = 'cancelado' AND motivo_cancelamento LIKE 'Óbito:%'),
  (SELECT string_agg(situacao, ',') FROM public.exames_pedidos WHERE paciente_id = e2e.u('pac23')));
SELECT e2e.conferir('T1.obito_porta_prescricao', 23, 'Prescrição da porta encerrada no óbito',
  NOT EXISTS (SELECT 1 FROM public.prescricoes WHERE paciente_id = e2e.u('pac23') AND status = 'ativa'), NULL);

-- ── coorte antiga: #7 (transferido) e #13 (óbito) fora da checagem ───────────
SELECT e2e.conferir('T1.coorte_sem_prescricao_ativa', NULL, 'Nenhuma prescrição ativa de internação encerrada ou atendimento encerrado',
  NOT EXISTS (SELECT 1 FROM public.prescricoes pr LEFT JOIN public.internacoes i ON i.id = pr.internacao_id LEFT JOIN public.episodios e ON e.id = pr.episodio_id
               WHERE pr.status = 'ativa' AND (i.data_alta IS NOT NULL OR (pr.internacao_id IS NULL AND e.etapa = 'encerrado'))), NULL);

SELECT passo, paciente, situacao, left(coalesce(detalhe, ''), 90) FROM e2e.resultados WHERE passo LIKE 'T1.%' AND situacao <> 'ok' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T1.%' GROUP BY 1 ORDER BY 1;
