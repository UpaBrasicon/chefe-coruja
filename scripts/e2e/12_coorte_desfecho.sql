-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — reclassificação e desfecho na porta (etapas 2–3).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION e2e.leito(p_ident text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT l.id FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
   WHERE s.unidade_id = 'e1100000-0000-4000-8000-000000000001' AND l.identificador = p_ident
$$;

-- reclassificação verde → laranja depois de piora (#3)
SELECT e2e.passo('2.reclassificar_enfermagem', 3, 'enfermeiro', '/triagem', 'Enfermeira reclassifica verde → laranja após piora',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, (SELECT id FROM public.protocolo_fluxogramas WHERE nome = %L AND publico = %L), %L, ''{}''::jsonb, NULL, %L)::text',
         e2e.u('ep3'), 'laranja', '{"frequencia-cardiaca":124,"frequencia-respiratoria":24,"temperatura":36.6,"saturacao-o2":97,"escala-dor":9,"pressao-arterial-sistolica":96,"pressao-arterial-diastolica":60}',
         'Politraumas', 'adulto', e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Politraumas' AND publico = 'adulto'), 'laranja'),
         'Piora da dor e queda da pressão na sala de espera'));
SELECT e2e.passo('2.reclassificar_medico', 3, 'plantonista', '/plantao/porta', 'Plantonista reclassifica verde → laranja (motivo)',
  format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, (SELECT id FROM public.protocolo_fluxogramas WHERE nome = %L AND publico = %L), %L, ''{}''::jsonb, NULL, %L)::text',
         e2e.u('ep3'), 'laranja', '{"frequencia-cardiaca":124,"frequencia-respiratoria":24,"temperatura":36.6,"saturacao-o2":97,"escala-dor":9,"pressao-arterial-sistolica":96,"pressao-arterial-diastolica":60}',
         'Politraumas', 'adulto', e2e.disc('e1100000-0000-4000-8000-000000000001', (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Politraumas' AND publico = 'adulto'), 'laranja'),
         'Piora da dor e queda da pressão na sala de espera'));

-- ── desfechos ───────────────────────────────────────────────────────────────
-- altas (#3 com RX resolvido, #14 fluxo mínimo)
SELECT e2e.passo('3.desfecho_alta', 3, 'plantonista', '/plantao/porta', 'Alta com RX',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('ep3'), 'alta', 'Alta com imobilização e orientação (teste E2E).', '{"cid_alta":"S62.0"}'));
SELECT e2e.passo('3.desfecho_alta', 14, 'plantonista', '/plantao/porta', 'Alta rápida',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('ep14'), 'alta', NULL, '{"cid_alta":"M54.5"}'));
-- documentos de alta
SELECT e2e.passo('3.receita', 14, 'plantonista', '/plantao/porta', 'Emite receita na alta',
  format('SELECT public.emitir_documento(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('pac14'), 'receita', 'Paracetamol 750 mg, 1 comprimido de 6/6h se dor, por 3 dias (teste E2E).', e2e.u('ep14')));
SELECT e2e.passo('3.atestado', 14, 'plantonista', '/plantao/porta', 'Emite atestado de 2 dias',
  format('SELECT public.emitir_documento(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('pac14'), 'atestado', 'Atesto que o paciente esteve em atendimento nesta data e necessita de 2 dias de afastamento. CID M54.5 (teste E2E).', e2e.u('ep14')));
SELECT e2e.passo('3.declaracao_comparecimento', 3, 'plantonista', '/plantao/porta', 'Emite declaração de comparecimento do acompanhante',
  format('SELECT public.emitir_documento(%L::uuid, %L, %L, %L::uuid)::text', e2e.u('pac3'), 'atestado', 'Declaro que a acompanhante esteve nesta unidade das 10h às 12h (teste E2E).', e2e.u('ep3')));

-- observação (#1 e #2 pediátricos, #11 adulta)
SELECT e2e.passo('3.desfecho_observacao', 1, 'plantonista', '/plantao/porta', 'Lactente vai para a observação pediátrica',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep1'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000004', 'leito_id', e2e.leito('OP-01'))));
SELECT e2e.passo('3.desfecho_observacao', 2, 'plantonista', '/plantao/porta', 'Criança asmática vai para a observação pediátrica',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep2'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000004', 'leito_id', e2e.leito('OP-02'))));
SELECT e2e.passo('3.desfecho_observacao', 11, 'plantonista', '/plantao/porta', 'Idosa com delirium vai para a observação adulto',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep11'), 'observacao', jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000003', 'leito_id', e2e.leito('OA-01'))));

-- internações
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT * FROM (VALUES (4, 'e1200000-0000-4000-8000-000000000006', 'ISO-01'), (5, 'e1200000-0000-4000-8000-000000000005', 'INT-01'),
                                 (6, 'e1200000-0000-4000-8000-000000000005', 'INT-02'), (7, 'e1200000-0000-4000-8000-000000000005', 'INT-03'),
                                 (8, 'e1200000-0000-4000-8000-000000000005', 'INT-04'), (9, 'e1200000-0000-4000-8000-000000000005', 'INT-05'),
                                 (10, 'e1200000-0000-4000-8000-000000000005', 'INT-06'), (12, 'e1200000-0000-4000-8000-000000000006', 'ISO-02'),
                                 (13, 'e1200000-0000-4000-8000-000000000005', NULL), (15, 'e1200000-0000-4000-8000-000000000005', NULL)) v(n, setor, leito) LOOP
    PERFORM e2e.passo('3.desfecho_internacao', x.n, 'plantonista', '/plantao/porta',
      'Interna em ' || coalesce(x.leito, 'setor sem leito (todos ocupados)'),
      format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', e2e.u('ep' || x.n), 'internacao',
             jsonb_strip_nulls(jsonb_build_object('setor_id', x.setor, 'leito_id', e2e.leito(x.leito)))));
    PERFORM e2e.guardar('int' || x.n, (SELECT id::text FROM public.internacoes WHERE paciente_id = e2e.u('pac' || x.n) AND data_alta IS NULL ORDER BY created_at DESC LIMIT 1));
  END LOOP;
  FOR x IN SELECT n FROM (VALUES (1), (2), (11)) v(n) LOOP
    PERFORM e2e.guardar('int' || x.n, (SELECT id::text FROM public.internacoes WHERE paciente_id = e2e.u('pac' || x.n) AND data_alta IS NULL ORDER BY created_at DESC LIMIT 1));
  END LOOP;
END $$;

SELECT 'desfecho da porta' AS etapa, situacao, count(*) FROM e2e.resultados WHERE passo LIKE '3.desfecho%' OR passo LIKE '2.reclass%' OR passo IN ('3.receita', '3.atestado', '3.declaracao_comparecimento')
 GROUP BY situacao ORDER BY situacao;
SELECT nome, valor FROM e2e.vars WHERE nome LIKE 'int%' ORDER BY nome;
