-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 7 — regressão dos avisos de item devolvido pela
-- farmácia e de leito liberado. Roda depois de 01–04 e 10–22, no mesmo banco.
-- Paciente novo #35 ("E2E T7 Farmácia"); usa e2e.t1_porta, e2e.t1_internar e
-- e2e.conferir do script 17. Usa os leitos OA-01 (Observação Adulto, com
-- pacientes sem leito) e OP-01 (Observação Pediátrica, ninguém aguardando),
-- que a coorte deixa em higienização.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E T7 Farmácia') THEN
    RAISE EXCEPTION 'A regressão da tarefa 7 já rodou neste banco (limpe com 99 e rode de novo).';
  END IF;
  IF (SELECT status FROM public.leitos WHERE id = e2e.leito('OA-01')) <> 'higienizacao'
     OR (SELECT status FROM public.leitos WHERE id = e2e.leito('OP-01')) <> 'higienizacao' THEN
    RAISE EXCEPTION 'OA-01 e OP-01 precisam estar em higienização (rode a coorte 10–16 antes).';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION e2e.t7_aviso(p_papel text, p_prefixo text, p_ref uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = e2e.conta(p_papel) AND tipo = p_prefixo || p_ref)
$$;

-- ── item devolvido ──────────────────────────────────────────────────────────
SELECT e2e.t1_porta(35, 'E2E T7 Farmácia', 'J18.9', NULL);
SELECT e2e.t1_internar(35);
SELECT e2e.passo('T7.prescrever2', 35, 'plantonista', '/plantao/porta', 'Segundo item (dipirona)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac35'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Dipirona sódica'), 'dose', '1 g', 'via', 'endovenosa', 'posologia', '6/6h se dor')));
SELECT e2e.passo('T7.devolver', 35, 'farmaceutico', '/farmacia', 'Farmácia devolve a ceftriaxona com motivo',
  format('SELECT public.validar_item(%L::uuid, false, %L)::text', e2e.item(35, 'Ceftriaxona'), 'Ajustar a dose à função renal (teste E2E)'));
SELECT e2e.conferir('T7.aviso_prescritor', 35, 'O médico que prescreveu recebe o aviso (categoria Farmácia)',
  e2e.t7_aviso('plantonista', 'farm_devolvido_', e2e.item(35, 'Ceftriaxona')),
  (SELECT mensagem FROM public.notificacoes_plantonista WHERE tipo = 'farm_devolvido_' || e2e.item(35, 'Ceftriaxona') LIMIT 1));
SELECT e2e.conferir('T7.sem_aviso_setor', 35, 'Com o prescritor de plantão, o médico do setor não é avisado',
  NOT e2e.t7_aviso('plantonista2', 'farm_devolvido_', e2e.item(35, 'Ceftriaxona')), NULL);
SELECT e2e.passo('T7.conferir', 35, 'farmaceutico', '/farmacia', 'Item conferido não gera aviso',
  format('SELECT public.validar_item(%L::uuid, true)::text', e2e.item(35, 'Dipirona sódica')));
SELECT e2e.conferir('T7.conferido_sem_aviso', 35, 'Nenhum aviso para o item conferido',
  NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'farm_devolvido_' || e2e.item(35, 'Dipirona sódica')), NULL);

-- prescritor fora do plantão: o médico escalado no setor também é avisado
SELECT e2e.ajuste('T7.prescritor_fora', 'Plantão atual do prescritor desligado',
  format('UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = %L AND now() >= inicio AND now() < inicio + make_interval(mins => duracao_min)', e2e.conta('plantonista')));
SELECT e2e.passo('T7.devolver_fora', 35, 'farmaceutico', '/farmacia', 'Farmácia devolve a dipirona com o prescritor fora do plantão',
  format('SELECT public.validar_item(%L::uuid, false, %L)::text', e2e.item(35, 'Dipirona sódica'), 'Dose máxima diária ultrapassada (teste E2E)'));
SELECT e2e.conferir('T7.aviso_setor', 35, 'Prescritor fora do plantão: prescritor e médico do setor recebem o aviso',
  e2e.t7_aviso('plantonista', 'farm_devolvido_', e2e.item(35, 'Dipirona sódica')) AND e2e.t7_aviso('plantonista2', 'farm_devolvido_', e2e.item(35, 'Dipirona sódica')), NULL);
SELECT e2e.ajuste('T7.prescritor_volta', 'Plantão atual do prescritor religado',
  format('UPDATE public.escala_plantao SET ativo = true WHERE perfil_id = %L AND now() >= inicio AND now() < inicio + make_interval(mins => duracao_min)', e2e.conta('plantonista')));

-- ── leito liberado ──────────────────────────────────────────────────────────
SELECT e2e.passo('T7.higienizar_oa', NULL, 'tecnico', '/enfermagem/internacao', 'Técnico conclui a higienização do OA-01 (setor com paciente sem leito)',
  format('SELECT public.concluir_higienizacao(%L::uuid)::text', e2e.leito('OA-01')));
SELECT e2e.conferir('T7.aviso_nir', NULL, 'NIR recebe o aviso do leito liberado (categoria Leitos)',
  e2e.t7_aviso('nir', 'leito_livre_', e2e.leito('OA-01')),
  (SELECT mensagem FROM public.notificacoes_plantonista WHERE tipo = 'leito_livre_' || e2e.leito('OA-01') LIMIT 1));
SELECT e2e.conferir('T7.aviso_enfermeiro', NULL, 'Enfermeiro escalado no setor recebe o aviso (há paciente sem leito)',
  e2e.t7_aviso('enfermeiro', 'leito_livre_', e2e.leito('OA-01')), NULL);
SELECT e2e.passo('T7.higienizar_op', NULL, 'tecnico', '/enfermagem/internacao', 'Técnico conclui a higienização do OP-01 (ninguém aguardando)',
  format('SELECT public.concluir_higienizacao(%L::uuid)::text', e2e.leito('OP-01')));
SELECT e2e.conferir('T7.op_nir', NULL, 'NIR recebe sempre',
  e2e.t7_aviso('nir', 'leito_livre_', e2e.leito('OP-01')), NULL);
SELECT e2e.conferir('T7.op_sem_enfermeiro', NULL, 'Sem paciente aguardando, o enfermeiro do setor não é avisado',
  NOT e2e.t7_aviso('enfermeiro', 'leito_livre_', e2e.leito('OP-01')), NULL);

SELECT passo, paciente, situacao, left(coalesce(detalhe, ''), 100) FROM e2e.resultados WHERE passo LIKE 'T7.%' AND situacao <> 'ok' ORDER BY id;
SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'T7.%' GROUP BY 1 ORDER BY 1;
