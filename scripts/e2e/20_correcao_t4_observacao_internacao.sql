-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 4 — regressão da observação que vira
-- internação. Roda depois de 01–04 e 10–19, no mesmo banco. Pacientes novos
-- #31 a #33 ("E2E T4 ..."); usa e2e.t1_porta, e2e.t1_internar e e2e.conferir
-- do script 17.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E T4 Convertida') THEN
    RAISE EXCEPTION 'A regressão da tarefa 4 já rodou neste banco (limpe com 99 e rode de novo).';
  END IF;
END $$;

-- observação na porta, guardando a internação
CREATE OR REPLACE FUNCTION e2e.t4_observar(p_n int) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM e2e.passo('T4.observacao', p_n, 'plantonista', '/plantao/porta', 'Vai para a observação adulto',
    format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep' || p_n), 'observacao',
           jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000003')));
  PERFORM e2e.guardar('int' || p_n, (SELECT id::text FROM public.internacoes WHERE paciente_id = e2e.u('pac' || p_n) AND data_alta IS NULL LIMIT 1));
END $$;

-- ── #31: observação que vira internação ─────────────────────────────────────
SELECT e2e.t1_porta(31, 'E2E T4 Convertida', 'J18.9', NULL);
SELECT e2e.t4_observar(31);
SELECT e2e.conferir('T4.na_observacao', 31, 'Na observação: tipo observação e sem hora de internação',
  (SELECT tipo_internacao = 'observacao' AND internado_em IS NULL FROM public.internacoes WHERE id = e2e.u('int31')),
  (SELECT tipo_internacao || ' / ' || coalesce(internado_em::text, 'sem internado_em') FROM public.internacoes WHERE id = e2e.u('int31')));
SELECT e2e.ajuste('T4.envelhecer_observacao', 'Observação do #31 começou há 5 h',
  format('UPDATE public.internacoes SET data_admissao = now() - interval ''5 hours'' WHERE id = %L', e2e.u('int31')));
SELECT e2e.passo('T4.converter', 31, 'plantonista2', '/observacao', 'Finaliza a observação com internação',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, NULL, NULL, %L::jsonb)::text', e2e.u('int31'), 'internacao',
         jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000005')));
SELECT e2e.conferir('T4.tipo_urgencia', 31, 'A internação convertida fica com o tipo urgência',
  (SELECT tipo_internacao = 'urgencia' FROM public.internacoes WHERE id = e2e.u('int31')),
  (SELECT tipo_internacao FROM public.internacoes WHERE id = e2e.u('int31')));
SELECT e2e.conferir('T4.internado_em', 31, 'internado_em é a hora da conversão e a admissão continua a entrada na observação',
  (SELECT internado_em > data_admissao + interval '4 hours' AND internado_em > now() - interval '10 minutes' FROM public.internacoes WHERE id = e2e.u('int31')),
  (SELECT data_admissao::text || ' -> ' || coalesce(internado_em::text, '-') FROM public.internacoes WHERE id = e2e.u('int31')));
SELECT e2e.conferir('T4.nir_sem_aih', 31, 'A internação convertida aparece na lista do NIR de internação sem AIH',
  EXISTS (SELECT 1 FROM private.nir_itens('e1100000-0000-4000-8000-000000000001') x WHERE x.ref_id = e2e.u('int31')),
  NULL);
SELECT e2e.passo('T4.internado_ha', 31, 'enfermeiro', '/enfermagem/internacao', '"Internado há" da enfermagem conta da conversão',
  format('SELECT CASE WHEN data_admissao > now() - interval ''10 minutes'' THEN ''da conversão'' ELSE e2e.falhar(''conta da observação: '' || data_admissao) END
            FROM public.enfermagem_leitos(%L) WHERE internacao_id = %L', 'e1100000-0000-4000-8000-000000000001', e2e.u('int31')));

-- ── #32: internação direta da porta ─────────────────────────────────────────
SELECT e2e.t1_porta(32, 'E2E T4 Direta', 'I63.9', NULL);
SELECT e2e.t1_internar(32);
SELECT e2e.conferir('T4.direta', 32, 'Internação direta: tipo urgência e internado_em igual à admissão',
  (SELECT tipo_internacao = 'urgencia' AND internado_em = data_admissao FROM public.internacoes WHERE id = e2e.u('int32')),
  (SELECT tipo_internacao || ' / ' || coalesce(internado_em::text, '-') FROM public.internacoes WHERE id = e2e.u('int32')));

-- ── #33: observação com alta direto ─────────────────────────────────────────
SELECT e2e.t1_porta(33, 'E2E T4 Só Observação', 'R10.4', NULL);
SELECT e2e.t4_observar(33);
SELECT e2e.passo('T4.alta_observacao', 33, 'plantonista2', '/observacao', 'Alta da observação',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('int33'), 'alta_medica', 'R10.4'));
SELECT e2e.conferir('T4.so_observacao', 33, 'Alta direto da observação: continua tipo observação, sem internado_em',
  (SELECT tipo_internacao = 'observacao' AND internado_em IS NULL FROM public.internacoes WHERE id = e2e.u('int33')),
  (SELECT tipo_internacao || ' / ' || coalesce(internado_em::text, 'sem internado_em') FROM public.internacoes WHERE id = e2e.u('int33')));

SELECT passo, paciente, situacao, left(coalesce(detalhe, ''), 90) FROM e2e.resultados WHERE passo LIKE 'T4.%' AND situacao <> 'ok' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T4.%' GROUP BY 1 ORDER BY 1;
