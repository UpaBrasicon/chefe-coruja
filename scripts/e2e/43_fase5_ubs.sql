-- ════════════════════════════════════════════════════════════════════════════
-- Portão da Fase 5 — etapa A, UBS (5A, tarefas 1 a 7), na rede F5.
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas mesmas RPCs das
-- telas; o resultado fica em e2e.resultados (passos 'F5.*'). Nada é corrigido
-- durante a rodada. Rodar 41_checkin_fase5.sql antes.
--
-- Coorte F5 (fictícia):
--   1 hipertensa e diabética: escuta com sinais, consulta, HbA1c, pés,
--     hiperdia, agenda do retorno
--   2 dor torácica na escuta (vermelho): o enfermeiro envia à UPA; a UPA recebe,
--     atende e dá alta com orientação; a UBS recebe o retorno e abre o resumo
--   3 consulta com envio à UPA que não chega em 12 h
--   4 consulta com envio à UPA cancelado pela UBS
--   5 gestante (pré-natal ainda sem programa: lacuna conhecida)
--   6 criança de 2 anos (puericultura ainda sem programa: lacuna conhecida)
--   7 paciente da UBS que vai à UPA por conta própria e evade
--   8 regulação de consulta especializada aberta da consulta
--   9 paciente da UBS internado na UPA: alta com orientação e alta desfeita
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION e2e.confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.confere(boolean, text) TO authenticated;

-- ── 1. hiperdia ─────────────────────────────────────────────────────────────
SELECT e2e.passo('F5.1.ficha', 1, 'f5_rec_ubs', '/recepcao', 'Recepção da UBS abre a ficha da escuta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Renovar a receita da pressão e do diabetes', NULL,
    '{"nome":"Maria F5 Hiperdia","data_nascimento":"1959-02-01","cns":"898001160000001","tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep1');
SELECT e2e.passo('F5.1.paciente', 1, 'f5_rec_ubs', '/recepcao', 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('f5ep1')), 'ok', 'f5pac1');
SELECT e2e.passo('F5.1.tecnico_nao_classifica', 1, 'f5_tec_ubs', '/escuta', 'Técnico não faz a escuta do CAB 28 (deve ser recusado)',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'verde', 'consulta')::text$q$, e2e.u('f5ep1')), 'erro');
SELECT e2e.passo('F5.1.escuta', 1, 'f5_enf_ubs', '/escuta', 'Enfermeira faz a escuta (verde) com pressão, peso e altura',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'verde', 'consulta', 'Renovar a receita, sem queixas agudas',
    '{"pressao-arterial-sistolica":152,"pressao-arterial-diastolica":94,"peso":81,"estatura":162}'::jsonb)::text$q$, e2e.u('f5ep1')));
SELECT e2e.passo('F5.1.atender', 1, 'f5_med_ubs', '/atendimento', 'Médica abre o atendimento',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5ep1')));
SELECT e2e.passo('F5.1.soap', 1, 'f5_med_ubs', '/atendimento', 'SOAP da consulta',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Hipertensa e diabética há 8 anos', 'PA 152x94', 'Hipertensão e diabetes sem controle ideal',
    'Ajuste da medicação, HbA1c e retorno', 'I10')::text$q$, e2e.u('f5ep1')));
SELECT e2e.passo('F5.1.hba1c', 1, 'f5_med_ubs', '/atendimento (Exames)', 'Pede a hemoglobina glicada',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"nome":"Hemoglobina glicada (HbA1c)"}]'::jsonb)::text$q$, e2e.u('f5ep1')));
SELECT e2e.passo('F5.1.pes', 1, 'f5_med_ubs', '/atendimento (Conduta, Hiperdia)', 'Registra a avaliação dos pés',
  format($q$SELECT public.registrar_avaliacao_pes(%L::uuid, 'sem_alteracao')::text$q$, e2e.u('f5ep1')));
SELECT e2e.passo('F5.1.conduta', 1, 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com hipertensão e diabetes (CIAP K86 e T90)',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{hipertensao_arterial,diabetes}', '{}',
    '{retorno_cuidado_continuado}', 'Retorno em 30 dias com a HbA1c', '{K86,T90}')::text$q$, e2e.u('f5ep1')));
SELECT e2e.passo('F5.1.painel', 1, 'f5_tec_ubs', '/hiperdia', 'Painel: os dois programas, com consulta, pressão, peso e altura, HbA1c e pés',
  format($q$SELECT e2e.confere((SELECT jsonb_array_length(p -> 'programas') = 2 AND (p ->> 'ultima_pa') IS NOT NULL AND (p ->> 'ultimo_peso_altura') IS NOT NULL
      AND (p ->> 'ultima_hba1c') IS NOT NULL AND (p ->> 'ultima_avaliacao_pes') IS NOT NULL
    FROM jsonb_array_elements(public.hiperdia_painel(%L::uuid)) p WHERE (p ->> 'paciente_id')::uuid = %L::uuid), 'painel do hiperdia')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('f5pac1')));
SELECT e2e.passo('F5.1.recepcao_sem_painel', 1, 'f5_rec_ubs', '/hiperdia', 'Recepção não vê o hiperdia (deve ser recusado)',
  format('SELECT public.hiperdia_painel(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000001'), 'erro:O hiperdia é visto');
SELECT e2e.passo('F5.1.agenda_grade', 1, 'f5_ges_ubs', '/agenda-consultas (configuração)', 'Gestor configura a grade da médica',
  format($q$SELECT public.agenda_definir_configuracao(%L::uuid, %L::uuid,
    (SELECT jsonb_agg(jsonb_build_object('dia', d, 'periodo', 'manha', 'inicio', '07:00', 'fim', '12:00', 'duracao', 20)) FROM generate_series(0, 6) d))::text$q$,
    'f5100000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000004'));
SELECT e2e.passo('F5.1.agendar', 1, 'f5_rec_ubs', '/agenda-consultas', 'Recepção marca o retorno ("Agendar" do hiperdia)',
  format($q$SELECT public.agenda_marcar(%L::uuid, %L::uuid, ((private.data_atual() + 30) + time '08:00') AT TIME ZONE 'America/Sao_Paulo',
    %L::uuid, 'consulta_programada', 'Retorno do hiperdia', NULL)::text$q$,
    'f5100000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000004', e2e.u('f5pac1')), 'ok', 'f5ag1');
SELECT e2e.passo('F5.1.proxima', 1, 'f5_enf_ubs', '/hiperdia', 'Painel mostra a próxima consulta',
  format($q$SELECT e2e.confere((SELECT (p ->> 'proxima_consulta') IS NOT NULL FROM jsonb_array_elements(public.hiperdia_painel(%L::uuid)) p
    WHERE (p ->> 'paciente_id')::uuid = %L::uuid), 'próxima consulta no painel')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('f5pac1')));

-- ── 2. escuta vermelha → UPA → alta com orientação → retorno ────────────────
SELECT e2e.passo('F5.2.ficha', 2, 'f5_rec_ubs', '/recepcao', 'Ficha da escuta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor no peito há 1 hora', NULL,
    '{"nome":"José F5 Dor Torácica","data_nascimento":"1966-06-06","cns":"700500000000004","tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep2');
SELECT e2e.passo('F5.2.recepcao_nao_envia', 2, 'f5_rec_ubs', '/escuta', 'Recepção não envia à UPA (deve ser recusado)',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Dor torácica típica na escuta')::text$q$, e2e.u('f5ep2'), 'f5100000-0000-4000-8000-000000000002'),
  'erro:Acesso negado: envia');
SELECT e2e.passo('F5.2.enviar', 2, 'f5_enf_ubs', '/escuta (vermelho)', 'Enfermeira envia à UPA da rede pela escuta',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Dor torácica típica, sudorese, sem ECG na UBS')::text$q$,
    e2e.u('f5ep2'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'f5env2');
SELECT e2e.passo('F5.2.vindo', 2, 'f5_rec_upa', '/recepcao (Vindo da UBS)', 'UPA vê o paciente vindo da UBS',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) e WHERE (e ->> 'id')::uuid = %L::uuid), 'vindo da UBS')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('f5env2')));
SELECT e2e.passo('F5.2.ficha_upa', 2, 'f5_rec_upa', '/recepcao', 'Recepção da UPA abre a ficha',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor torácica (vindo da UBS)', NULL,
    '{"nome":"José F5 Dor Torácica","data_nascimento":"1966-06-06","cns":"700500000000004"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011'), 'ok', 'f5epu2');
SELECT e2e.passo('F5.2.chegou', 2, 'f5_rec_upa', '/recepcao (Vindo da UBS)', 'Marca a chegada ligando a ficha',
  format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid)::text', e2e.u('f5env2'), e2e.u('f5epu2')));
SELECT e2e.ajuste('F5.2.sem_triagem', 'Classificação de risco da UPA fora do escopo desta etapa: a ficha vai direto ao médico',
  format('UPDATE public.episodios SET etapa = %L WHERE id = %L', 'atendimento', e2e.u('f5epu2')));
SELECT e2e.passo('F5.2.atender_upa', 2, 'f5_med_upa', '/atendimento', 'Médico da UPA atende',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5epu2')));
SELECT e2e.passo('F5.2.soap_upa', 2, 'f5_med_upa', '/atendimento', 'SOAP da UPA',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor torácica', 'ECG sem supra, troponina negativa', 'Dor torácica não cardíaca provável',
    'Alta com sintomático e retorno à UBS', 'R07.4')::text$q$, e2e.u('f5epu2')));
SELECT e2e.passo('F5.2.alta_upa', 2, 'f5_med_upa', '/atendimento (Desfecho)', 'Alta com orientação à UBS',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{"cid_alta":"R07.4","orientacao_ubs":"Investigar dor torácica atípica e reavaliar em 7 dias"}'::jsonb)::text$q$,
    e2e.u('f5epu2')));
SELECT e2e.passo('F5.2.envio_chegou', 2, 'f5_med_ubs', '/encaminhados', '"Encaminhados" mostra que chegou',
  format($q$SELECT e2e.confere((SELECT e ->> 'situacao' = 'chegou' FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid)) e
    WHERE (e ->> 'id')::uuid = %L::uuid), 'envio chegou')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('f5env2')));
SELECT e2e.passo('F5.2.retorno_lista', 2, 'f5_rec_ubs', '/encaminhados?aba=retornos', 'A recepção vê o retorno, sem o resumo',
  format($q$SELECT (r ->> 'id') FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE (r ->> 'encaminhamento_numero') IS NOT NULL AND NOT (r ? 'resumo') LIMIT 1$q$, 'f5100000-0000-4000-8000-000000000001'), 'ok', 'f5ret2');
SELECT e2e.passo('F5.2.recepcao_sem_resumo', 2, 'f5_rec_ubs', '/encaminhados?aba=retornos', 'Recepção não abre o resumo (deve ser recusado)',
  format('SELECT public.contrarreferencia_abrir(%L::uuid)::text', e2e.u('f5ret2')), 'erro:O resumo do retorno é visto');
SELECT e2e.passo('F5.2.abrir_resumo', 2, 'f5_enf_ubs', '/encaminhados?aba=retornos', 'Enfermeira abre o resumo com a orientação',
  format($q$SELECT e2e.confere((SELECT r ->> 'orientacao' LIKE 'Investigar dor torácica%%' AND r -> 'resumo' ->> 'cid' = 'R07.4'
    FROM public.contrarreferencia_abrir(%L::uuid) r), 'resumo e orientação')$q$, e2e.u('f5ret2')));

-- ── 3. envio que não chega em 12 h ──────────────────────────────────────────
SELECT e2e.passo('F5.3.ficha', 3, 'f5_rec_ubs', '/recepcao', 'Ficha da consulta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Cefaleia intensa súbita', NULL,
    '{"nome":"Rita F5 Cefaleia","data_nascimento":"1980-03-03","tipo_atendimento":"consulta_no_dia"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep3');
SELECT e2e.passo('F5.3.atender', 3, 'f5_med_ubs', '/atendimento', 'Médica atende', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5ep3')));
SELECT e2e.passo('F5.3.enviar', 3, 'f5_med_ubs', '/atendimento (Conduta)', 'Envia à UPA (encaminhamento para urgência)',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Cefaleia súbita, pior da vida, sem tomografia na UBS')::text$q$,
    e2e.u('f5ep3'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'f5env3');
SELECT e2e.ajuste('F5.3.prazo', 'Simula o prazo de 12 h vencido e roda o job do prazo',
  format('UPDATE public.encaminhamentos_upa SET prazo_em = now() - interval %L WHERE id = %L; SELECT private.encaminhamentos_upa_prazo()', '1 minute', e2e.u('f5env3')));
SELECT e2e.passo('F5.3.nao_chegou', 3, 'f5_med_ubs', '/encaminhados', 'O envio passa a "não chegou"',
  format($q$SELECT e2e.confere((SELECT e ->> 'situacao' = 'nao_chegou' FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid)) e
    WHERE (e ->> 'id')::uuid = %L::uuid), 'não chegou')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('f5env3')));

-- ── 4. envio cancelado ──────────────────────────────────────────────────────
SELECT e2e.passo('F5.4.ficha', 4, 'f5_rec_ubs', '/recepcao', 'Ficha da consulta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Tontura', NULL,
    '{"nome":"Bento F5 Tontura","data_nascimento":"1958-08-08","tipo_atendimento":"consulta_no_dia"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep4');
SELECT e2e.passo('F5.4.atender', 4, 'f5_med_ubs', '/atendimento', 'Médica atende', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5ep4')));
SELECT e2e.passo('F5.4.enviar', 4, 'f5_med_ubs', '/atendimento (Conduta)', 'Envia à UPA',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Vertigem com suspeita de déficit focal')::text$q$,
    e2e.u('f5ep4'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'f5env4');
SELECT e2e.passo('F5.4.cancelar', 4, 'f5_med_ubs', '/encaminhados', 'Cancela o envio com motivo',
  format($q$SELECT public.encaminhamento_upa_cancelar(%L::uuid, 'Reavaliada: sem déficit, segue na UBS')::text$q$, e2e.u('f5env4')));

-- ── 5 e 6. gestante e criança (consultas; programas ainda não existem) ──────
SELECT e2e.passo('F5.5.ficha', 5, 'f5_rec_ubs', '/recepcao', 'Ficha da gestante',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Consulta de pré-natal', NULL,
    '{"nome":"Ana F5 Gestante","data_nascimento":"1998-04-04","tipo_atendimento":"consulta_programada"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep5');
SELECT e2e.passo('F5.5.atender', 5, 'f5_med_ubs', '/atendimento', 'Médica atende', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5ep5')));
SELECT e2e.passo('F5.5.soap', 5, 'f5_med_ubs', '/atendimento', 'SOAP do pré-natal',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Gestante de 14 semanas, sem queixas', 'PA 110x70', 'Gestação de baixo risco', 'Exames do 1º trimestre', 'Z34.9')::text$q$, e2e.u('f5ep5')));
SELECT e2e.passo('F5.5.conduta', 5, 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com pré-natal',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{pre_natal}', '{}', '{retorno_cuidado_continuado}', NULL, '{}')::text$q$, e2e.u('f5ep5')));
SELECT e2e.lacuna('F5.5.programa', 5, 'f5_med_ubs', 'Programa de pré-natal (nota C3)', 'Fora da tarefa 7 (J1 = hiperdia primeiro); depende de ACS, vacina e saúde bucal.');
SELECT e2e.passo('F5.6.ficha', 6, 'f5_rec_ubs', '/recepcao', 'Ficha da criança de 2 anos',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Consulta de puericultura', NULL,
    jsonb_build_object('nome', 'Davi F5 Criança', 'data_nascimento', (private.data_atual() - interval '2 years 1 month')::date, 'tipo_atendimento', 'consulta_programada')) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep6');
SELECT e2e.passo('F5.6.atender', 6, 'f5_med_ubs', '/atendimento', 'Médica atende', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5ep6')));
SELECT e2e.passo('F5.6.soap', 6, 'f5_med_ubs', '/atendimento', 'SOAP da puericultura',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Criança de 2 anos, sem queixas', 'Peso e estatura adequados', 'Crescimento adequado', 'Retorno em 6 meses', 'Z00.1')::text$q$, e2e.u('f5ep6')));
SELECT e2e.passo('F5.6.conduta', 6, 'f5_med_ubs', '/atendimento (Conduta)', 'Encerra com puericultura',
  format($q$SELECT public.registrar_conduta_aps(%L::uuid, 'consulta_programada', '{puericultura}', '{}', '{retorno_cuidado_continuado}', NULL, '{}')::text$q$, e2e.u('f5ep6')));
SELECT e2e.lacuna('F5.6.programa', 6, 'f5_med_ubs', 'Programa de puericultura (nota C2)', 'Fora da tarefa 7 (J1 = hiperdia primeiro); depende de ACS, vacina e curvas da OMS.');

-- ── 7. paciente da UBS que evade na UPA ─────────────────────────────────────
SELECT e2e.passo('F5.7.ficha', 7, 'f5_rec_ubs', '/recepcao', 'Cadastro na UBS (consulta do dia)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor lombar', NULL,
    '{"nome":"Pedro F5 Evasão","data_nascimento":"1975-07-07","cns":"700600000000006","tipo_atendimento":"consulta_no_dia"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep7');
SELECT e2e.passo('F5.7.ficha_upa', 7, 'f5_rec_upa', '/recepcao', 'Vai à UPA por conta própria',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor lombar forte', NULL,
    '{"nome":"Pedro F5 Evasão","data_nascimento":"1975-07-07","cns":"700600000000006"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011'), 'ok', 'f5epu7');
SELECT e2e.passo('F5.7.evasao', 7, 'f5_rec_upa', '/recepcao', 'Evade da sala de espera',
  format($q$SELECT public.retirar_da_fila(%L::uuid, 'evasao', 'Saiu da sala de espera sem avisar a recepção')::text$q$, e2e.u('f5epu7')));
SELECT e2e.passo('F5.7.retorno', 7, 'f5_enf_ubs', '/encaminhados?aba=retornos', 'A UBS recebe o retorno da evasão (pelo CNS)',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE r ->> 'desfecho' = 'evasao' AND r -> 'paciente' ->> 'nome' = 'Pedro F5 Evasão'), 'retorno da evasão')$q$, 'f5100000-0000-4000-8000-000000000001'));

-- ── 8. regulação de consulta pela conduta ───────────────────────────────────
SELECT e2e.passo('F5.8.ficha', 8, 'f5_rec_ubs', '/recepcao', 'Ficha da consulta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Falta de ar aos esforços', NULL,
    jsonb_build_object('nome', 'Lúcia F5 Cardio', 'data_nascimento', '1952-05-05', 'cpf', e2e.cpf('519000008'), 'tipo_atendimento', 'consulta_programada')) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep8');
SELECT e2e.passo('F5.8.paciente', 8, 'f5_rec_ubs', '/recepcao', 'Paciente da ficha',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('f5ep8')), 'ok', 'f5pac8');
SELECT e2e.passo('F5.8.atender', 8, 'f5_med_ubs', '/atendimento', 'Médica atende', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5ep8')));
SELECT e2e.passo('F5.8.solicitar', 8, 'f5_med_ubs', '/regulacao (aberta da conduta)', 'Solicita consulta de cardiologia pela regulação',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('f5pac8'),
    jsonb_build_object('tipo', 'consulta', 'especialidade', 'Cardiologia', 'procedimento', '0301010072', 'cid', 'I50.0', 'carater', 'eletivo',
      'prioridade', 'eletiva', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('f5ep8'),
      'quadro_clinico', 'Dispneia aos esforços há 3 meses, edema de membros inferiores.', 'tempo_evolucao', 'Meses', 'telefone_contato', '(11) 0000-0000')),
  'ok', 'f5reg8');
SELECT e2e.passo('F5.8.lista', 8, 'f5_med_ubs', '/encaminhados', 'A regulação aparece na lista da unidade',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_lista(%L::uuid)) r WHERE (r ->> 'id')::uuid = %L::uuid), 'regulação na lista')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('f5reg8')));
SELECT e2e.passo('F5.8.assumir', 8, 'f5_regulador', '/regulacao', 'Regulador assume', format('SELECT public.regulacao_assumir(%L::uuid)::text', e2e.u('f5reg8')));
SELECT e2e.passo('F5.8.autorizar', 8, 'f5_regulador', '/regulacao', 'Autoriza para o hospital da rede',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('f5reg8'), 'rede', 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.passo('F5.8.historico', 8, 'f5_med_ubs', '/atendimento (Encaminhar)', 'Histórico de regulação do paciente na consulta',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_historico_paciente(%L::uuid)) r WHERE (r ->> 'id')::uuid = %L::uuid), 'histórico')$q$,
    e2e.u('f5pac8'), e2e.u('f5reg8')));

-- ── 9. internação na UPA, alta e alta desfeita ──────────────────────────────
SELECT e2e.passo('F5.9.ficha', 9, 'f5_rec_ubs', '/recepcao', 'Cadastro na UBS',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Tosse', NULL,
    jsonb_build_object('nome', 'Carlos F5 Pneumonia', 'data_nascimento', '1950-09-09', 'cpf', e2e.cpf('519000016'), 'tipo_atendimento', 'consulta_no_dia')) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep9');
SELECT e2e.passo('F5.9.ficha_upa', 9, 'f5_rec_upa', '/recepcao', 'Vai à UPA com febre e falta de ar',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Febre e falta de ar', NULL,
    jsonb_build_object('nome', 'Carlos F5 Pneumonia', 'data_nascimento', '1950-09-09', 'cpf', e2e.cpf('519000016'))) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011'), 'ok', 'f5epu9');
SELECT e2e.ajuste('F5.9.sem_triagem', 'Classificação de risco da UPA fora do escopo desta etapa',
  format('UPDATE public.episodios SET etapa = %L WHERE id = %L', 'atendimento', e2e.u('f5epu9')));
SELECT e2e.passo('F5.9.atender', 9, 'f5_med_upa', '/atendimento', 'Médico da UPA atende', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5epu9')));
SELECT e2e.passo('F5.9.soap', 9, 'f5_med_upa', '/atendimento', 'SOAP',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Febre e dispneia', 'Crepitações em base direita, SpO2 92%%', 'Pneumonia comunitária', 'Internar, antibiótico', 'J18.9')::text$q$, e2e.u('f5epu9')));
SELECT e2e.passo('F5.9.internar', 9, 'f5_med_upa', '/atendimento (Desfecho)', 'Interna na própria UPA',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, jsonb_build_object('setor_id', %L))::text$q$, e2e.u('f5epu9'), 'f5300000-0000-4000-8000-000000000013'));
SELECT e2e.passo('F5.9.internacao', 9, 'f5_med_int', '/internacao', 'Internação aberta',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L$q$, e2e.u('f5epu9')), 'ok', 'f5int9');
SELECT e2e.passo('F5.9.alta', 9, 'f5_med_int', '/internacao (Alta)', 'Alta melhorada com orientação à UBS',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_melhorada', 'J18.9', NULL, NULL, 'Boa evolução com antibiótico',
    '{"orientacao_ubs":"Reavaliar em 7 dias e conferir o término do antibiótico"}'::jsonb)::text$q$, e2e.u('f5int9')));
SELECT e2e.passo('F5.9.retorno', 9, 'f5_med_ubs', '/encaminhados?aba=retornos', 'A UBS recebe o retorno da internação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE (r ->> 'internacao')::boolean AND r -> 'paciente' ->> 'nome' = 'Carlos F5 Pneumonia'), 'retorno da internação')$q$, 'f5100000-0000-4000-8000-000000000001'));
SELECT e2e.passo('F5.9.desfaz', 9, 'f5_med_int', '/internacao', 'Desfaz a alta com justificativa',
  format($q$SELECT public.cancelar_alta(%L::uuid, 'Alta registrada no paciente errado, desfeita')::text$q$, e2e.u('f5int9')));
SELECT e2e.passo('F5.9.retorno_cancelado', 9, 'f5_med_ubs', '/encaminhados?aba=retornos', 'O retorno da alta desfeita sai da lista',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE (r ->> 'internacao')::boolean AND r -> 'paciente' ->> 'nome' = 'Carlos F5 Pneumonia'), 'retorno cancelado')$q$, 'f5100000-0000-4000-8000-000000000001'));

-- ── permissão de outra rede ─────────────────────────────────────────────────
SELECT e2e.passo('F5.X.outra_rede', NULL, 'plantonista', '/encaminhados', 'Conta de outra rede não lê os retornos da UBS F5 (deve ser recusado)',
  format('SELECT public.contrarreferencias_da_unidade(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000001'), 'erro:Acesso negado');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'F5.%' AND em > now() - interval '2 hours' GROUP BY 1 ORDER BY 1;
