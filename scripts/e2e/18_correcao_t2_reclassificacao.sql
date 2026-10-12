-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 2 — regressão da reclassificação pela
-- enfermagem na espera. Roda depois de 01–04 e 10–17, no mesmo banco.
-- Paciente novo #25 ("E2E T2 Espera"); a ficha passa por 03_checkin_agora.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E T2 Espera') THEN
    RAISE EXCEPTION 'A regressão da tarefa 2 já rodou neste banco (limpe com 99 e rode de novo).';
  END IF;
END $$;

-- reclassificação: cor, fluxograma, discriminador, motivo e justificativa
CREATE OR REPLACE FUNCTION e2e.t2_reclass(p_cor text, p_fluxograma text, p_motivo text, p_justificativa text DEFAULT NULL) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %s, %L, ''{}''::jsonb, NULL, %L, %L)::text',
    e2e.u('ep25'), p_cor,
    '{"frequencia-cardiaca":122,"frequencia-respiratoria":26,"temperatura":38.9,"saturacao-o2":91,"escala-dor":7,"pressao-arterial-sistolica":94,"pressao-arterial-diastolica":58}',
    CASE WHEN p_fluxograma IS NULL THEN 'NULL' ELSE quote_literal((SELECT id FROM public.protocolo_fluxogramas WHERE nome = p_fluxograma AND publico = 'adulto')) || '::uuid' END,
    CASE WHEN p_fluxograma IS NULL THEN NULL
         ELSE e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = p_fluxograma AND publico = 'adulto'), p_cor) END,
    p_motivo, p_justificativa)
$$;

SELECT e2e.passo('T2.ficha', 25, 'recepcao', '/recepcao', 'Ficha',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001',
         'Tosse e febre (teste E2E)', '{"nome":"E2E T2 Espera","data_nascimento":"1971-05-05","sexo":"M"}'), 'ok', 'ep25');
SELECT e2e.guardar('pac25', (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('ep25')));
SELECT e2e.passo('T2.classificar_verde', 25, 'enfermeiro', '/triagem', 'Classificação inicial verde',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('ep25'), 'verde',
         '{"frequencia-cardiaca":88,"frequencia-respiratoria":18,"temperatura":37.8,"saturacao-o2":96,"escala-dor":3,"pressao-arterial-sistolica":124,"pressao-arterial-diastolica":78}',
         (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Mal-estar geral' AND publico = 'adulto'),
         e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Mal-estar geral' AND publico = 'adulto'), 'verde')));

-- negativas antes de valer
SELECT e2e.passo('T2.sem_protocolo', 25, 'enfermeiro', '/triagem', 'Enfermeiro reclassifica sem fluxograma e discriminador (deve recusar)',
  e2e.t2_reclass('laranja', NULL, 'Piora da falta de ar na sala de espera.'), 'erro:Informe o fluxograma e o discriminador');
SELECT e2e.passo('T2.sem_motivo', 25, 'enfermeiro', '/triagem', 'Enfermeiro reclassifica sem motivo (deve recusar)',
  e2e.t2_reclass('laranja', 'Mal-estar geral', 'curto'), 'erro:Informe o motivo da reclassificação');
SELECT e2e.passo('T2.tecnico', 25, 'tecnico', '/triagem', 'Técnico tenta reclassificar (deve recusar: fora da escala da porta ou sem papel de enfermeiro)',
  e2e.t2_reclass('laranja', 'Mal-estar geral', 'Piora da falta de ar na sala de espera.'), 'erro');

-- piora: enfermeiro sobe para laranja e os médicos da porta são avisados
SELECT e2e.passo('T2.piora', 25, 'enfermeiro', '/triagem', 'Enfermeiro reclassifica verde para laranja na espera',
  e2e.t2_reclass('laranja', 'Mal-estar geral', 'Piora da falta de ar na sala de espera.'));
SELECT e2e.conferir('T2.piora_registro', 25, 'Reclassificação gravada com o papel enfermeiro e o motivo',
  EXISTS (SELECT 1 FROM public.classificacoes_risco WHERE episodio_id = e2e.u('ep25') AND reclassificacao AND autor_papel = 'enfermeiro'
            AND cor = 'laranja' AND motivo LIKE 'Piora%'),
  (SELECT cor_atual FROM public.episodios WHERE id = e2e.u('ep25')));
SELECT e2e.conferir('T2.aviso_medico', 25, 'Médico escalado na porta recebe o aviso de piora',
  EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = e2e.conta('plantonista') AND tipo = 'triagem_piora_' || e2e.u('ep25')),
  (SELECT mensagem FROM public.notificacoes_plantonista WHERE tipo = 'triagem_piora_' || e2e.u('ep25') LIMIT 1));
SELECT e2e.conferir('T2.aviso_so_porta', 25, 'Médico que não está na escala da porta não recebe o aviso',
  NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = e2e.conta('plantonista2') AND tipo = 'triagem_piora_' || e2e.u('ep25')), NULL);

-- baixar a prioridade pede justificativa; baixar não avisa
SELECT e2e.passo('T2.baixar_sem_justificativa', 25, 'enfermeiro', '/triagem', 'Enfermeiro baixa para amarelo sem justificativa (deve recusar)',
  e2e.t2_reclass('amarelo', 'Mal-estar geral', 'Melhorou depois do repouso.'), 'erro:Baixar a prioridade exige justificativa');
SELECT e2e.passo('T2.baixar', 25, 'enfermeiro', '/triagem', 'Enfermeiro baixa para amarelo com justificativa',
  e2e.t2_reclass('amarelo', 'Mal-estar geral', 'Melhorou depois do repouso.', 'Saturação voltou a 96% em ar ambiente e sem esforço.'));

-- depois que o médico inicia, só o médico
SELECT e2e.passo('T2.iniciar', 25, 'plantonista', '/plantao/porta', 'Médico inicia o atendimento', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ep25')));
SELECT e2e.passo('T2.enfermeiro_depois', 25, 'enfermeiro', '/triagem', 'Enfermeiro tenta reclassificar depois do início do atendimento (deve recusar)',
  e2e.t2_reclass('laranja', 'Mal-estar geral', 'Nova piora durante o atendimento.'), 'erro:O atendimento médico já começou');
SELECT e2e.passo('T2.medico', 25, 'plantonista', '/plantao/porta', 'Médico reclassifica no atendimento (sem protocolo, como antes)',
  e2e.t2_reclass('laranja', NULL, 'Nova piora durante o atendimento.'));

SELECT passo, paciente, situacao, left(coalesce(detalhe, ''), 90) FROM e2e.resultados WHERE passo LIKE 'T2.%' AND situacao <> 'ok' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T2.%' GROUP BY 1 ORDER BY 1;
