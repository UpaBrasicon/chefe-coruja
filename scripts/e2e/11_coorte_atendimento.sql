-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — etapa 3: atendimento médico na porta (plantonista).
-- Anamnese/exame/hipótese (SOAP com CID), peso na criança, prescrição,
-- exames, alergia × prescrição, dois médicos, desfecho.
-- Doses e resultados são entradas de teste, não referência clínica.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION e2e.falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.med(p_principio text, p_apresentacao_parcial text DEFAULT NULL) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.medicamento WHERE principio_ativo = p_principio
     AND (p_apresentacao_parcial IS NULL OR apresentacao ILIKE '%' || p_apresentacao_parcial || '%') ORDER BY apresentacao LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION e2e.med(text, text) TO authenticated;

-- registra um sinal vital (peso, glicemia...) como o sistema grava: pela sincronização
CREATE OR REPLACE FUNCTION e2e.sql_sinal(p_pac uuid, p_conceito text, p_valor numeric, p_internacao uuid DEFAULT NULL) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$SELECT CASE WHEN r->0->>'status' = 'gravado' THEN 'gravado' ELSE e2e.falhar(coalesce(r->0->>'motivo', r::text)) END
                   FROM (SELECT public.sincronizar_registros(jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao',
                     'hora', now(), 'sem_conexao', false, 'aparelho_id', 'e2e',
                     'dados', jsonb_build_object('paciente_id', %L, 'internacao_id', %L, 'conceito_id', (SELECT id FROM public.conceito WHERE nome = %L),
                                                 'valor_num', %s, 'origem', 'manual'))))::jsonb AS r) x$q$,
                p_pac, p_internacao, p_conceito, p_valor)
$$;

-- ── 3.1 iniciar e SOAP (todos) ──────────────────────────────────────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte ORDER BY n LOOP
    PERFORM e2e.passo('3.iniciar', c.n, 'plantonista', '/plantao/porta', 'Plantonista inicia o atendimento',
      format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ep' || c.n)));
    PERFORM e2e.passo('3.soap', c.n, 'plantonista', '/plantao/porta', 'Anamnese, exame físico e hipótese com CID',
      format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('ep' || c.n),
             'Queixa: ' || c.queixa || '. Início há poucas horas. (texto de teste E2E)',
             'Exame físico de teste E2E; sinais vitais da triagem conferidos.',
             'Hipótese: ' || c.cid || ' (teste E2E).', 'Conduta conforme protocolo da unidade (teste E2E).', c.cid));
  END LOOP;
END $$;

-- ── 3.2 peso das crianças (obrigatório para prescrever) ─────────────────────
SELECT e2e.passo('3.prescricao_sem_peso', 1, 'plantonista', '/plantao/porta', 'Prescrição na criança sem peso deve ser recusada',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac1'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Dipirona sódica', 'gotas'), 'dose', '60 mg', 'via', 'oral', 'posologia', '6/6h')), 'erro');
SELECT e2e.passo('3.peso', 1, 'enfermeiro', '/triagem', 'Peso do lactente (6,4 kg)', e2e.sql_sinal(e2e.u('pac1'), 'peso', 6.4));
SELECT e2e.passo('3.peso', 2, 'enfermeiro', '/triagem', 'Peso da criança (21 kg)', e2e.sql_sinal(e2e.u('pac2'), 'peso', 21));
SELECT e2e.passo('3.glicemia', 15, 'enfermeiro', '/triagem', 'Glicemia capilar do desconhecido (52 mg/dL)', e2e.sql_sinal(e2e.u('pac15'), 'glicemia-capilar', 52));

-- ── 3.3 prescrições ─────────────────────────────────────────────────────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT * FROM (VALUES
      (1,  'Dipirona sódica', 'gotas', '60 mg', 'oral', '6/6h se febre', 'ok'),
      (1,  'Ampicilina', NULL, '320 mg', 'endovenosa', '6/6h', 'ok'),
      (2,  'Salbutamol', NULL, '4 jatos', 'inalatória', '20/20 min por 3 vezes', 'ok'),
      (2,  'Prednisolona', NULL, '20 mg', 'oral', '1x ao dia', 'ok'),
      (3,  'Paracetamol', 'comprimido', '750 mg', 'oral', 'dose única', 'ok'),
      (4,  'Ceftriaxona', NULL, '2 g', 'endovenosa', '12/12h', 'ok'),
      (5,  'Dipirona sódica', 'ampola', '1 g', 'endovenosa', '6/6h', 'ok'),
      (6,  'Cloreto de sódio', NULL, '500 mL', 'endovenosa', 'correr em 30 min', 'ok'),
      (7,  'Dipirona sódica', 'ampola', '1 g', 'endovenosa', '6/6h', 'erro:ALERGIA'),
      (7,  'Ácido acetilsalicílico', NULL, '300 mg', 'oral', 'dose única', 'ok'),
      (7,  'Clopidogrel', NULL, '300 mg', 'oral', 'dose única', 'ok'),
      (7,  'Heparina sódica', NULL, '5.000 UI', 'endovenosa', 'dose única', 'ok'),
      (8,  'Gluconato de cálcio', NULL, '10 mL', 'endovenosa', 'dose única', 'ok'),
      (8,  'Insulina humana regular', NULL, '10 UI', 'endovenosa', 'com glicose', 'ok'),
      (9,  'Alteplase', NULL, 'conforme peso', 'endovenosa', 'protocolo AVC', 'ok'),
      (10, 'Ceftriaxona', NULL, '2 g', 'endovenosa', '1x ao dia', 'ok'),
      (10, 'Midazolam', NULL, 'conforme protocolo', 'endovenosa', 'contínuo', 'ok'),
      (10, 'Fentanila', NULL, 'conforme protocolo', 'endovenosa', 'contínuo', 'ok'),
      (11, 'Ceftriaxona', NULL, '1 g', 'endovenosa', '1x ao dia', 'ok'),
      (12, 'Haloperidol', NULL, '5 mg', 'intramuscular', 'dose única', 'ok'),
      (12, 'Prometazina', NULL, '50 mg', 'intramuscular', 'dose única', 'ok'),
      (13, 'Noradrenalina', NULL, 'conforme protocolo', 'endovenosa', 'contínuo', 'ok'),
      (13, 'Piperacilina + tazobactam', NULL, '4,5 g', 'endovenosa', '6/6h', 'ok'),
      (14, 'Paracetamol', 'comprimido', '750 mg', 'oral', 'dose única', 'ok'),
      (15, 'Glicose', NULL, '50 mL', 'endovenosa', 'dose única', 'ok')
    ) x(n, principio, apres, dose, via, posologia, esperado) LOOP
    PERFORM e2e.passo('3.prescrever', p.n, 'plantonista', '/plantao/porta', 'Prescreve ' || p.principio || ' ' || p.dose,
      format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac' || p.n),
             jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med(p.principio, p.apres), 'dose', p.dose, 'via', p.via,
                                'posologia', p.posologia, 'justificativa_interacao', 'Benefício maior que o risco no caso de teste E2E')),
      p.esperado);
  END LOOP;
END $$;
SELECT e2e.passo('3.prescricao_duplicada', 4, 'plantonista', '/plantao/porta', 'Mesmo medicamento e via duas vezes deve ser recusado',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac4'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Ceftriaxona'), 'dose', '2 g', 'via', 'endovenosa', 'posologia', '12/12h')), 'erro');
SELECT e2e.passo('3.tecnico_prescreve', 14, 'tecnico', '/plantao/porta', 'Técnico tenta prescrever (deve ser negado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac14'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Paracetamol'), 'dose', '500 mg', 'via', 'oral', 'posologia', 'dose única')), 'erro');
SELECT e2e.passo('3.farmaceutico_desfecho', 14, 'farmaceutico', '/plantao/porta', 'Farmacêutica tenta dar alta (deve ser negado)',
  format('SELECT public.registrar_desfecho(%L::uuid, %L)::text', e2e.u('ep14'), 'alta'), 'erro');
SELECT e2e.passo('3.outra_rede', 4, 'plantonista_outra_rede', '/prontuarios', 'Médico de outra organização tenta ver o paciente (deve ser negado)',
  format('SELECT CASE WHEN count(*) = 0 THEN e2e.falhar(''nenhuma linha visível'') ELSE count(*)::text END FROM public.pacientes WHERE id = %L', e2e.u('pac4')), 'erro');
SELECT e2e.passo('3.segundo_medico', 5, 'plantonista2', '/plantao/porta', 'Segundo plantonista (escalado na Observação) escreve no atendimento da porta',
  format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('ep5'), 'Complemento do segundo médico (teste E2E).', 'Sem mudança.', 'K35.8 mantido.', 'Mantém.', 'K35.8'), 'erro');
SELECT e2e.lacuna('3.medicacao_controlada', 12, 'plantonista', 'Prescrição de medicação controlada (receita especial, aprovação da farmácia)',
  'O catálogo não marca controlado e a prescrição/farmácia não têm regra de controlados (haloperidol e midazolam entram como qualquer item).');
SELECT e2e.lacuna('3.reabrir_atendimento', NULL, 'plantonista', 'Reabrir atendimento depois do desfecho', 'Não há RPC de reabertura; depois do desfecho a etapa sai de "atendimento" e tudo fica bloqueado.');

-- #15: adulto inconsciente sem idade conhecida — o sistema exige peso antes de qualquer medicamento
SELECT e2e.passo('3.peso_estimado', 15, 'enfermeiro', '/triagem', 'Peso estimado do desconhecido (70 kg)', e2e.sql_sinal(e2e.u('pac15'), 'peso', 70));
SELECT e2e.passo('3.prescrever', 15, 'plantonista', '/plantao/porta', 'Prescreve Glicose 50 mL (depois do peso)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac15'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Glicose'), 'dose', '50 mL', 'via', 'endovenosa', 'posologia', 'dose única')));

-- ── 3.4 exames ──────────────────────────────────────────────────────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM e2e.coorte WHERE n NOT IN (14) ORDER BY n LOOP
    PERFORM e2e.passo('3.pedir_exames', c.n, 'plantonista', '/plantao/porta', 'Pede laboratório e imagem',
      format('SELECT public.pedir_exames_atendimento(%L::uuid, %L::text[])::text', e2e.u('ep' || c.n),
             CASE c.n WHEN 3 THEN ARRAY['Raio-X de punho'] WHEN 7 THEN ARRAY['Troponina', 'ECG'] WHEN 9 THEN ARRAY['Tomografia de crânio', 'Glicemia']
                      WHEN 10 THEN ARRAY['Gasometria arterial', 'Raio-X de tórax', 'Hemograma'] ELSE ARRAY['Hemograma', 'PCR'] END));
  END LOOP;
END $$;
-- resultados (o do #3 sai antes da alta; os demais seguem na observação/internação)
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT e.id, c.n, e.exame FROM public.exames_pedidos e JOIN e2e.coorte c ON e.paciente_id = e2e.u('pac' || c.n)
            WHERE c.n IN (3, 7, 9) AND e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('3.resultado_exame', x.n, 'plantonista', '/plantao/porta', 'Registra resultado: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, 'Resultado de teste E2E para ' || x.exame));
  END LOOP;
END $$;

SELECT 'atendimento' AS etapa, situacao, count(*) FROM e2e.resultados WHERE passo LIKE '3.%' GROUP BY situacao ORDER BY situacao;
