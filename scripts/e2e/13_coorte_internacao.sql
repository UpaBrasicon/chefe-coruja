-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — etapas 4, 5, 8, 9 e 10: observação, internação,
-- enfermagem, técnico de enfermagem e farmácia.
-- Médico: plantonista2 (escalado na observação, internação e isolamento).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION e2e.item(p_n int, p_principio text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT i.id FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id
    JOIN public.medicamento m ON m.id = i.medicamento_id
   WHERE p.paciente_id = e2e.u('pac' || p_n) AND m.principio_ativo = p_principio AND i.suspenso_em IS NULL
   ORDER BY i.created_at DESC LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION e2e.item(int, text) TO authenticated;

-- ── 4. observação ───────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  FOREACH n IN ARRAY ARRAY[1, 2, 11] LOOP
    PERFORM e2e.passo('4.atender_observacao', n, 'plantonista2', '/observacao', 'Médico da observação assume o paciente',
      format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('int' || n)));
    PERFORM e2e.passo('4.evolucao_medica', n, 'plantonista2', '/observacao', 'Evolução médica na observação',
      format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('int' || n), 'evolucao', 'Evolução médica de teste E2E: reavaliado, segue em observação.'));
    PERFORM e2e.passo('4.evolucao_enfermagem', n, 'enfermeiro', '/observacao', 'Evolução de enfermagem na observação',
      format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('int' || n), 'evolucao_enfermagem', 'Evolução de enfermagem de teste E2E: sinais estáveis, aceitando dieta.'));
  END LOOP;
END $$;
SELECT e2e.passo('4.reavaliar_escore', 11, 'enfermeiro', '/observacao', 'Escala de Morse (risco de queda) na idosa com delirium',
  format('SELECT public.registrar_avaliacao(%L::uuid, %L, %L::jsonb, NULL, %L::uuid)::text', e2e.u('pac11'), 'morse',
         '{"quedas":25,"diagnostico":15,"auxilio":0,"terapia_ev":20,"marcha":10,"estado_mental":15}', e2e.u('int11')));
SELECT e2e.passo('4.ajustar_prescricao', 2, 'plantonista2', '/observacao', 'Ajusta a prescrição (prednisolona de horário)',
  format('SELECT public.alterar_item_prescricao(%L::uuid, %L::jsonb, %L)::text', e2e.item(2, 'Prednisolona'), '{"posologia":"1x ao dia, pela manhã"}', 'Ajuste de horário'));
-- desfechos da observação (os exames pedidos na porta precisam de resultado antes da alta)
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT e.id, e.exame FROM public.exames_pedidos e WHERE e.paciente_id = e2e.u('pac2') AND e.situacao = 'pedido' LOOP
    PERFORM e2e.passo('4.resultado_exame', 2, 'plantonista2', '/observacao', 'Resultado na observação: ' || x.exame,
      format('SELECT public.resolver_exame(%L::uuid, %L)::text', x.id, 'Resultado de teste E2E'));
  END LOOP;
END $$;
SELECT e2e.passo('4.receita_alta', 2, 'plantonista2', '/observacao', 'Receita da alta da observação',
  format('SELECT public.emitir_documento(%L::uuid, %L, %L)::text', e2e.u('pac2'), 'receita', 'Prednisolona e salbutamol conforme orientação (teste E2E).'));
SELECT e2e.passo('4.alta_observacao', 2, 'plantonista2', '/observacao', 'Alta da observação (criança asmática)',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L)::text', e2e.u('int2'), 'alta_medica', 'J45.9'));
SELECT e2e.passo('4.observacao_para_internacao', 1, 'plantonista2', '/observacao', 'Lactente (sepse) da observação para a internação',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L, NULL, %L::jsonb)::text', e2e.u('int1'), 'internacao', 'A41.9',
         jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000005')));
SELECT e2e.passo('4.observacao_para_internacao', 11, 'plantonista2', '/observacao', 'Idosa com delirium da observação para a internação',
  format('SELECT public.finalizar_observacao(%L::uuid, %L, %L, NULL, %L::jsonb)::text', e2e.u('int11'), 'internacao', 'N39.0',
         jsonb_build_object('setor_id', 'e1200000-0000-4000-8000-000000000005')));

-- ── 5. internação: evolução diária, aprazamento, checagem, farmácia ─────────
DO $$
DECLARE n int;
BEGIN
  FOREACH n IN ARRAY ARRAY[4, 5, 6, 7, 8, 9, 10, 12, 13, 15] LOOP
    PERFORM e2e.passo('5.evolucao_diaria', n, 'plantonista2', '/internacao', 'Evolução diária do internado',
      format('SELECT public.registrar_evolucao(%L::uuid, %L, %L)::text', e2e.u('int' || n), 'evolucao', 'Evolução diária de teste E2E.'));
  END LOOP;
END $$;
-- aprazamento (enfermeiro), inclusive cruzando a meia-noite
SELECT e2e.passo('5.aprazar', 4, 'enfermeiro', '/checagem', 'Apraza ceftriaxona 12/12h (22h e 10h, cruza a meia-noite)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.item(4, 'Ceftriaxona'), '{22:00,10:00}'));
SELECT e2e.passo('5.aprazar', 5, 'enfermeiro', '/checagem', 'Apraza dipirona 6/6h',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.item(5, 'Dipirona sódica'), '{00:00,06:00,12:00,18:00}'));
SELECT e2e.passo('5.aprazar', 7, 'enfermeiro', '/checagem', 'Apraza heparina (alta vigilância)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.item(7, 'Heparina sódica'), '{14:00}'));
SELECT e2e.passo('5.aprazar', 13, 'enfermeiro', '/checagem', 'Apraza piperacilina 6/6h',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.item(13, 'Piperacilina + tazobactam'), '{06:00,12:00,18:00,00:00}'));
SELECT e2e.passo('5.tecnico_apraza', 5, 'tecnico', '/checagem', 'Técnico tenta aprazar (é do enfermeiro)',
  format('SELECT public.aprazar(%L::uuid, %L::text[])::text', e2e.item(5, 'Dipirona sódica'), '{01:00}'), 'erro');
-- farmácia: libera a heparina; devolve a piperacilina ao médico
SELECT e2e.passo('10.liberar_alta_vigilancia', 7, 'farmaceutico', '/farmacia', 'Farmacêutica valida e libera a heparina',
  format('SELECT public.validar_item(%L::uuid, true)::text', e2e.item(7, 'Heparina sódica')));
SELECT e2e.passo('10.devolver_ao_medico', 13, 'farmaceutico', '/farmacia', 'Farmacêutica devolve a piperacilina ao médico (dose a rever)',
  format('SELECT public.validar_item(%L::uuid, false, %L)::text', e2e.item(13, 'Piperacilina + tazobactam'), 'Ajustar a dose à função renal do paciente'));
SELECT e2e.passo('10.farmaceutico_alta', 5, 'farmaceutico', '/internacao', 'Farmacêutica tenta dar alta (deve ser negado)',
  format('SELECT public.dar_alta(%L::uuid, %L, %L)::text', e2e.u('int5'), 'alta_melhorada', 'K35.9'), 'erro');
SELECT e2e.lacuna('10.controlados', 12, 'farmaceutico', 'Aprovação/rejeição de controlados, intervenção farmacêutica, dispensação e lote',
  'A farmácia valida/libera item (validar_item) e cuida de faltas e estoque; não há aprovação de controlados, registro de intervenção, dispensação nem rastreio de lote.');
-- checagem (técnico)
SELECT e2e.passo('9.checar_feito', 4, 'tecnico', '/checagem', 'Técnico checa ceftriaxona das 22h como feita',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', e2e.item(4, 'Ceftriaxona'), 'feito', '22:00'));
SELECT e2e.passo('9.checar_nao_feito', 5, 'tecnico', '/checagem', 'Técnico registra dipirona não feita, com motivo',
  format('SELECT public.checar(%L::uuid, %L, %L, %L)::text', e2e.item(5, 'Dipirona sódica'), 'nao_feito', '06:00', 'Paciente em jejum para cirurgia, sem dor'));
SELECT e2e.passo('9.checar_alta_vigilancia_liberada', 7, 'tecnico', '/checagem', 'Técnico checa heparina liberada pela farmácia',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', e2e.item(7, 'Heparina sódica'), 'feito', '14:00'));
SELECT e2e.passo('9.checar_sem_horario', 4, 'tecnico', '/checagem', 'Checagem fora dos horários aprazados deve ser recusada',
  format('SELECT public.checar(%L::uuid, %L, %L)::text', e2e.item(4, 'Ceftriaxona'), 'feito', '03:00'), 'erro');
SELECT e2e.lacuna('9.atrasado', NULL, 'tecnico', 'Situação "atrasado" na checagem', 'A checagem aceita feito, não feito e recusado; o atraso só aparece calculado na fila (fila_checagem), não é registrado.');
-- sinais vitais seriados, glicemia, balanço hídrico (técnico)
SELECT e2e.passo('9.sinais_vitais', 10, 'tecnico', '/enfermagem/internacao', 'Saturação seriada do #10 (88%)', e2e.sql_sinal(e2e.u('pac10'), 'saturacao-o2', 88, e2e.u('int10')));
SELECT e2e.passo('9.glicemia', 8, 'tecnico', '/enfermagem/internacao', 'Glicemia capilar do #8 (142 mg/dL)', e2e.sql_sinal(e2e.u('pac8'), 'glicemia-capilar', 142, e2e.u('int8')));
SELECT e2e.passo('9.balanco_entrada', 10, 'tecnico', '/enfermagem/internacao', 'Balanço hídrico: entrada 500 mL',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('pac10'), 'entrada', 'Soro fisiológico', 500, e2e.u('int10')));
SELECT e2e.passo('9.balanco_saida', 10, 'tecnico', '/enfermagem/internacao', 'Balanço hídrico: diurese 300 mL',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('pac10'), 'saida', 'Diurese', 300, e2e.u('int10')));

-- ── 8. enfermagem (enfermeiro) ──────────────────────────────────────────────
SELECT e2e.passo('8.sae', 5, 'enfermeiro', '/enfermagem/internacao', 'SAE do paciente cirúrgico',
  format('SELECT public.registrar_sae(%L::uuid, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, NULL, %L::uuid)::text', e2e.u('pac5'), 'Histórico de enfermagem de teste E2E',
         '[{"titulo":"Dor aguda"}]', '[{"titulo":"Avaliar dor 4/4h"}]', '[{"titulo":"Analgesia conforme prescrição"}]', 'Evolução de teste E2E', e2e.u('int5')));
SELECT e2e.passo('8.curativo', 5, 'enfermeiro', '/enfermagem/internacao', 'Curativo (pós-operatório simulado)',
  format('SELECT public.registrar_curativo(%L::uuid, %L, %L, %L, NULL, NULL, NULL, %L::uuid)::text', e2e.u('pac5'), 'Fossa ilíaca direita', 'Gaze estéril', 'limpo', e2e.u('int5')));
SELECT e2e.passo('8.dispositivo', 10, 'enfermeiro', '/enfermagem/internacao', 'Sonda nasogástrica',
  format('SELECT public.registrar_dispositivo(%L::uuid, %L, %L, %L, %L::date, NULL, NULL, NULL, %L::uuid)::text', e2e.u('pac10'), 'Sonda nasogástrica ou nasoenteral', 'Narina direita', '16Fr', private.data_atual(), e2e.u('int10')));
SELECT e2e.passo('8.dispositivo', 13, 'enfermeiro', '/enfermagem/internacao', 'Acesso venoso periférico',
  format('SELECT public.registrar_dispositivo(%L::uuid, %L, %L, %L, %L::date, NULL, NULL, NULL, %L::uuid)::text', e2e.u('pac13'), 'Acesso venoso periférico', 'MSE', '18G', private.data_atual(), e2e.u('int13')));
SELECT e2e.passo('8.queda', 11, 'enfermeiro', '/enfermagem/internacao', 'Notifica queda (intercorrência) na idosa com delirium',
  format('SELECT public.registrar_intercorrencia(%L::uuid, NULL, %L::uuid, %L, NULL, %L, now(), %L, %L)::text', e2e.u('pac11'), e2e.u('int11'), 'queda', 'leve',
         'Queda da própria altura ao tentar levantar sozinha (teste E2E).', 'Avaliada, sem lesão; grade elevada e acompanhante orientado.'));
SELECT e2e.passo('8.agitacao', 12, 'enfermeiro', '/enfermagem/internacao', 'Agitação psicomotora (intercorrência)',
  format('SELECT public.registrar_intercorrencia(%L::uuid, NULL, %L::uuid, %L, NULL, %L, now(), %L, %L)::text', e2e.u('pac12'), e2e.u('int12'), 'agitacao', 'moderada',
         'Paciente agitado, agressivo com a equipe (teste E2E).', 'Médico avisado; medicado conforme prescrição.'));
SELECT e2e.lacuna('8.contencao', 12, 'enfermeiro', 'Registro de contenção mecânica', 'Não há registro próprio de contenção (indicação, horário, revisão, retirada); só a intercorrência de agitação.');
SELECT e2e.passo('8.fugulin', 10, 'enfermeiro', '/enfermagem/internacao', 'Fugulin do paciente em ventilação',
  format('SELECT public.registrar_fugulin(%L::uuid, %L::jsonb)::text', e2e.u('int10'), (SELECT jsonb_object_agg(a, 4) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a)));

-- ── passagem de plantão ─────────────────────────────────────────────────────
SELECT e2e.passo('5.passagem_medica', 9, 'plantonista2', '/internacao', 'Passagem de plantão médica para o outro plantonista',
  format('SELECT public.enviar_passagem(%L::uuid, %L::uuid, %L)::text', e2e.u('int9'), e2e.conta('plantonista'), 'AVC isquêmico, aguardando regulação; pendente TC de controle.'), 'ok', 'passagem9');
SELECT e2e.passo('5.passagem_medica_aceite', 9, 'plantonista', '/plantao', 'Plantonista que recebe aceita a passagem',
  format('SELECT public.responder_passagem(%L::uuid, true)::text', e2e.v('passagem9')));
SELECT e2e.passo('8.passagem_enfermagem', NULL, 'enfermeiro', '/enfermagem/passagem', 'Passagem de plantão da enfermagem na internação (leito a leito)',
  format('SELECT public.entregar_passagem_enfermagem(%L::uuid, (SELECT jsonb_agg(jsonb_build_object(''paciente_id'', x.paciente_id, ''texto'', ''Estável (teste E2E)'')) FROM public.enfermagem_leitos(%L) x WHERE x.setor_id = %L), %L)::text',
         'e1200000-0000-4000-8000-000000000005', 'e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000005', 'Plantão sem intercorrências graves.'), 'ok', 'passagem_enf');
SELECT e2e.passo('8.passagem_enfermagem_receber', NULL, 'tecnico', '/enfermagem/passagem', 'Técnico recebe a passagem da enfermagem',
  format('SELECT public.receber_passagem_enfermagem(%L::uuid)::text', e2e.v('passagem_enf')));

-- ── transferência interna de leito, suspensão, prescrição vencida ───────────
SELECT e2e.passo('5.transferencia_leito', 15, 'plantonista2', '/internacao', 'Paciente sem leito vai para leito da observação adulto',
  format('SELECT public.registrar_evento_adt(%L::uuid, %L, %L::uuid, %L::uuid, %L)::text', e2e.u('int15'), 'transferencia_leito', 'e1200000-0000-4000-8000-000000000003', e2e.leito('OA-02'), 'Sem leito na internação'));
SELECT e2e.passo('5.suspender_item', 12, 'plantonista2', '/internacao', 'Suspende a prometazina',
  format('SELECT public.suspender_item(%L::uuid, %L)::text', e2e.item(12, 'Prometazina'), 'Paciente calmo, sem necessidade'));
SELECT e2e.lacuna('5.prescricao_vencida', NULL, 'plantonista', 'Prescrição vencida e renovação', 'A prescrição tem valida_ate, mas não há fluxo de renovação nem bloqueio/aviso de prescrição vencida para a checagem.');

SELECT 'internação' AS etapa, situacao, count(*) FROM e2e.resultados WHERE passo ~ '^(4|5|8|9|10)\.' GROUP BY situacao ORDER BY situacao;
