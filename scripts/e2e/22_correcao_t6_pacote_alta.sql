-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 6 — regressão da trilha da visão da equipe do
-- pacote de alta. Roda depois de 01–04 e 10–21, no mesmo banco. Paciente
-- novo #34 ("E2E T6 Pacote"); usa e2e.t1_porta, e2e.t1_internar e
-- e2e.conferir do script 17.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E T6 Pacote') THEN
    RAISE EXCEPTION 'A regressão da tarefa 6 já rodou neste banco (limpe com 99 e rode de novo).';
  END IF;
END $$;

-- registros do pacote no prontuário, por tipo
CREATE OR REPLACE FUNCTION e2e.t6_acessos(p_tipo text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM public.log_acesso_prontuario
   WHERE paciente_id = e2e.u('pac34') AND tipo_acesso = p_tipo AND documento_tipo LIKE 'Pacote de alta%'
$$;

SELECT e2e.t1_porta(34, 'E2E T6 Pacote', 'J18.9', NULL);
SELECT e2e.t1_internar(34);
SELECT e2e.passo('T6.alta', 34, 'plantonista2', '/internacao', 'Alta melhorada',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int34'), 'alta_melhorada', 'J18.9'));
SELECT e2e.passo('T6.gerar', 34, 'plantonista2', '/internacao', 'Gera o pacote de alta',
  format('SELECT (public.gerar_pacote_alta(%L::uuid, %L::jsonb, %L) ->> ''id'')', e2e.u('int34'), '["Repouso relativo (teste E2E)"]', 'UBS em 7 dias'));
SELECT e2e.guardar('pacote34', (SELECT id::text FROM public.pacotes_alta WHERE internacao_id = e2e.u('int34') AND situacao = 'ativo' LIMIT 1));

-- abrir
SELECT e2e.passo('T6.abrir_criador', 34, 'plantonista2', '/alta/equipe', 'Quem gerou abre a visão da equipe',
  format('SELECT (public.ver_pacote_alta_equipe(%L::uuid) ->> ''situacao'')', e2e.u('pacote34')));
SELECT e2e.conferir('T6.leitura_registrada', 34, 'A abertura fica no registro de acesso ao prontuário',
  e2e.t6_acessos('leitura_documento') = 1, e2e.t6_acessos('leitura_documento')::text);
SELECT e2e.passo('T6.abrir_recepcao', 34, 'recepcao', '/alta/equipe', 'Recepção não abre a visão da equipe (deve recusar)',
  format('SELECT (public.ver_pacote_alta_equipe(%L::uuid) ->> ''situacao'')', e2e.u('pacote34')), 'erro:Acesso negado');

-- imprimir
SELECT e2e.passo('T6.imprimir_inteiro', 34, 'plantonista2', '/alta/equipe', 'Imprime o pacote inteiro (protocolo IMP-)',
  format('SELECT CASE WHEN protocolo LIKE ''IMP-%%'' THEN protocolo ELSE e2e.falhar(protocolo) END FROM public.registrar_impressao_pacote_alta(%L::uuid)', e2e.u('pacote34')));
SELECT e2e.passo('T6.imprimir_documento', 34, 'plantonista2', '/alta/equipe', 'Imprime só a orientação de alta',
  format('SELECT protocolo FROM public.registrar_impressao_pacote_alta(%L::uuid, %L)', e2e.u('pacote34'), 'Orientações de alta'));
SELECT e2e.conferir('T6.impressoes_registradas', 34, 'As duas impressões ficam registradas, com o que foi impresso',
  e2e.t6_acessos('impressao') = 2
  AND EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = e2e.u('pac34') AND documento_tipo = 'Pacote de alta (inteiro)')
  AND EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE paciente_id = e2e.u('pac34') AND documento_tipo = 'Pacote de alta: Orientações de alta'),
  (SELECT string_agg(documento_tipo, ' | ') FROM public.log_acesso_prontuario WHERE paciente_id = e2e.u('pac34') AND tipo_acesso = 'impressao'));
SELECT e2e.passo('T6.imprimir_recepcao', 34, 'recepcao', '/alta/equipe', 'Recepção não imprime (deve recusar)',
  format('SELECT protocolo FROM public.registrar_impressao_pacote_alta(%L::uuid)', e2e.u('pacote34')), 'erro:Acesso negado');

-- depois de 24 h: só o gestor
SELECT e2e.ajuste('T6.envelhecer_alta', 'Alta do #34 registrada há 25 h',
  format('UPDATE public.internacoes SET alta_registrada_em = now() - interval ''25 hours'', data_alta = now() - interval ''25 hours'' WHERE id = %L', e2e.u('int34')));
SELECT e2e.passo('T6.criador_depois', 34, 'plantonista2', '/alta/equipe', 'Depois de 24 h quem gerou não abre (deve recusar)',
  format('SELECT (public.ver_pacote_alta_equipe(%L::uuid) ->> ''situacao'')', e2e.u('pacote34')), 'erro:Acesso negado');
SELECT e2e.passo('T6.gestor_depois', 34, 'gestor', '/alta/equipe', 'O gestor abre depois de 24 h',
  format('SELECT (public.ver_pacote_alta_equipe(%L::uuid) ->> ''situacao'')', e2e.u('pacote34')));
SELECT e2e.conferir('T6.leitura_gestor', 34, 'A abertura do gestor também fica registrada',
  e2e.t6_acessos('leitura_documento') = 2, e2e.t6_acessos('leitura_documento')::text);

SELECT passo, paciente, situacao, left(coalesce(detalhe, ''), 90) FROM e2e.resultados WHERE passo LIKE 'T6.%' AND situacao <> 'ok' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T6.%' GROUP BY 1 ORDER BY 1;
