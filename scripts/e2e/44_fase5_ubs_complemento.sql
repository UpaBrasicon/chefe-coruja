-- ════════════════════════════════════════════════════════════════════════════
-- Portão da Fase 5 — complemento da etapa A (UBS). Refaz os pacientes 2, 7, 8 e
-- 9, que na primeira rodada (43) caíram por erro do roteiro, não do produto:
-- CNS fictício com dígito errado, a consulta da regulação sem o CBO e a
-- internação lida por um papel que não a enxerga. Passos 'F5b.*'.
-- Rodar 41_checkin_fase5.sql antes.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── 2. escuta vermelha → UPA → alta com orientação → retorno ────────────────
SELECT e2e.passo('F5b.2.ficha', 2, 'f5_rec_ubs', '/recepcao', 'Ficha da escuta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor no peito há 1 hora', NULL,
    '{"nome":"José F5 Dor Torácica","data_nascimento":"1966-06-06","cns":"700500000000000","tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep2');
SELECT e2e.passo('F5b.2.recepcao_nao_envia', 2, 'f5_rec_ubs', '/escuta', 'Recepção não envia à UPA (deve ser recusado)',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Dor torácica típica na escuta')::text$q$, e2e.u('f5ep2'), 'f5100000-0000-4000-8000-000000000002'),
  'erro:Acesso negado: envia');
SELECT e2e.passo('F5b.2.enviar', 2, 'f5_enf_ubs', '/escuta (vermelho)', 'Enfermeira envia à UPA da rede pela escuta',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Dor torácica típica, sudorese, sem ECG na UBS')::text$q$,
    e2e.u('f5ep2'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'f5env2');
SELECT e2e.passo('F5b.2.vindo', 2, 'f5_rec_upa', '/recepcao (Vindo da UBS)', 'UPA vê o paciente vindo da UBS',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) e WHERE (e ->> 'id')::uuid = %L::uuid), 'vindo da UBS')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('f5env2')));
SELECT e2e.passo('F5b.2.ubs_nao_ve_destino', 2, 'f5_rec_ubs', '/recepcao', 'A UBS não lê a lista "Vindo da UBS" da UPA (deve ser recusado)',
  format('SELECT public.encaminhamentos_upa_destino(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000002'), 'erro:Acesso negado');
SELECT e2e.passo('F5b.2.ficha_upa', 2, 'f5_rec_upa', '/recepcao', 'Recepção da UPA abre a ficha',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor torácica (vindo da UBS)', NULL,
    '{"nome":"José F5 Dor Torácica","data_nascimento":"1966-06-06","cns":"700500000000000"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011'), 'ok', 'f5epu2');
SELECT e2e.passo('F5b.2.chegou', 2, 'f5_rec_upa', '/recepcao (Vindo da UBS)', 'Marca a chegada ligando a ficha',
  format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid)::text', e2e.u('f5env2'), e2e.u('f5epu2')));
SELECT e2e.ajuste('F5b.2.sem_triagem', 'Classificação de risco da UPA fora do escopo desta etapa: a ficha vai direto ao médico',
  format('UPDATE public.episodios SET etapa = %L WHERE id = %L', 'atendimento', e2e.u('f5epu2')));
SELECT e2e.passo('F5b.2.atender_upa', 2, 'f5_med_upa', '/atendimento', 'Médico da UPA atende',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('f5epu2')));
SELECT e2e.passo('F5b.2.soap_upa', 2, 'f5_med_upa', '/atendimento', 'SOAP da UPA',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor torácica', 'ECG sem supra, troponina negativa', 'Dor torácica não cardíaca provável',
    'Alta com sintomático e retorno à UBS', 'R07.4')::text$q$, e2e.u('f5epu2')));
SELECT e2e.passo('F5b.2.alta_upa', 2, 'f5_med_upa', '/atendimento (Desfecho)', 'Alta com orientação à UBS',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{"cid_alta":"R07.4","orientacao_ubs":"Investigar dor torácica atípica e reavaliar em 7 dias"}'::jsonb)::text$q$,
    e2e.u('f5epu2')));
SELECT e2e.passo('F5b.2.envio_chegou', 2, 'f5_med_ubs', '/encaminhados', '"Encaminhados" mostra que chegou',
  format($q$SELECT e2e.confere((SELECT e ->> 'situacao' = 'chegou' FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid)) e
    WHERE (e ->> 'id')::uuid = %L::uuid), 'envio chegou')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('f5env2')));
SELECT e2e.passo('F5b.2.aviso_retorno', 2, 'f5_med_ubs', '/notificacoes', 'A médica da UBS recebe o aviso do retorno',
  $q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = 'f5200000-0000-4000-8000-000000000004'
    AND tipo LIKE 'ubs_retorno_%' AND mensagem LIKE 'José F5 Dor Torácica%'), 'aviso do retorno')$q$);
SELECT e2e.passo('F5b.2.retorno_lista', 2, 'f5_rec_ubs', '/encaminhados?aba=retornos', 'A recepção vê o retorno, sem o resumo',
  format($q$SELECT (r ->> 'id') FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE r -> 'paciente' ->> 'nome' = 'José F5 Dor Torácica' AND NOT (r ? 'resumo') LIMIT 1$q$, 'f5100000-0000-4000-8000-000000000001'), 'ok', 'f5ret2');
SELECT e2e.passo('F5b.2.recepcao_sem_resumo', 2, 'f5_rec_ubs', '/encaminhados?aba=retornos', 'Recepção não abre o resumo (deve ser recusado)',
  format('SELECT public.contrarreferencia_abrir(%L::uuid)::text', e2e.u('f5ret2')), 'erro:O resumo do retorno é visto');
SELECT e2e.passo('F5b.2.abrir_resumo', 2, 'f5_enf_ubs', '/encaminhados?aba=retornos', 'Enfermeira abre o resumo com a orientação',
  format($q$SELECT e2e.confere((SELECT r ->> 'orientacao' LIKE 'Investigar dor torácica%%' AND r -> 'resumo' ->> 'cid' = 'R07.4'
    FROM public.contrarreferencia_abrir(%L::uuid) r), 'resumo e orientação')$q$, e2e.u('f5ret2')));

-- ── 7. paciente da UBS que evade na UPA ─────────────────────────────────────
SELECT e2e.passo('F5b.7.ficha', 7, 'f5_rec_ubs', '/recepcao', 'Cadastro na UBS (consulta do dia)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor lombar', NULL,
    '{"nome":"Pedro F5 Evasão","data_nascimento":"1975-07-07","cns":"700600000000018","tipo_atendimento":"consulta_no_dia"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001'), 'ok', 'f5ep7');
SELECT e2e.passo('F5b.7.ficha_upa', 7, 'f5_rec_upa', '/recepcao', 'Vai à UPA por conta própria',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor lombar forte', NULL,
    '{"nome":"Pedro F5 Evasão","data_nascimento":"1975-07-07","cns":"700600000000018"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011'), 'ok', 'f5epu7');
SELECT e2e.passo('F5b.7.evasao', 7, 'f5_rec_upa', '/recepcao', 'Evade da sala de espera',
  format($q$SELECT public.retirar_da_fila(%L::uuid, 'evasao', 'Saiu da sala de espera sem avisar a recepção')::text$q$, e2e.u('f5epu7')));
SELECT e2e.passo('F5b.7.retorno', 7, 'f5_enf_ubs', '/encaminhados?aba=retornos', 'A UBS recebe o retorno da evasão (pelo CNS)',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE r ->> 'desfecho' = 'evasao' AND r -> 'paciente' ->> 'nome' = 'Pedro F5 Evasão'), 'retorno da evasão')$q$, 'f5100000-0000-4000-8000-000000000001'));

-- ── 8. regulação de consulta pela conduta ───────────────────────────────────
SELECT e2e.passo('F5b.8.solicitar', 8, 'f5_med_ubs', '/regulacao (aberta da conduta)', 'Solicita consulta de cardiologia pela regulação',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000001', e2e.u('f5pac8'),
    jsonb_build_object('tipo', 'consulta', 'especialidade', 'Cardiologia', 'cbo', '225120', 'procedimento', '0301010072', 'cid', 'I50.0', 'carater', 'eletivo',
      'prioridade', 'eletiva', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('f5ep8'),
      'quadro_clinico', 'Dispneia aos esforços há 3 meses, edema de membros inferiores.', 'tempo_evolucao', 'Meses', 'telefone_contato', '(11) 0000-0000')),
  'ok', 'f5reg8');
SELECT e2e.passo('F5b.8.lista', 8, 'f5_med_ubs', '/encaminhados', 'A regulação aparece na lista da unidade',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_lista(%L::uuid)) r WHERE (r ->> 'id')::uuid = %L::uuid), 'regulação na lista')$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('f5reg8')));
SELECT e2e.passo('F5b.8.assumir', 8, 'f5_regulador', '/regulacao', 'Regulador assume', format('SELECT public.regulacao_assumir(%L::uuid)::text', e2e.u('f5reg8')));
SELECT e2e.passo('F5b.8.autorizar', 8, 'f5_regulador', '/regulacao', 'Autoriza para o hospital da rede',
  format('SELECT public.regulacao_autorizar(%L::uuid, %L, %L::uuid)::text', e2e.u('f5reg8'), 'rede', 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.passo('F5b.8.historico', 8, 'f5_med_ubs', '/atendimento (Encaminhar)', 'Histórico de regulação do paciente na consulta',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_historico_paciente(%L::uuid)) r WHERE (r ->> 'id')::uuid = %L::uuid), 'histórico')$q$,
    e2e.u('f5pac8'), e2e.u('f5reg8')));

-- ── 9. internação na UPA, alta e alta desfeita ──────────────────────────────
SELECT e2e.passo('F5b.9.internacao', 9, 'f5_med_upa', '/atendimento', 'Internação aberta pelo desfecho (lida por quem internou)',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L$q$, e2e.u('f5epu9')), 'ok', 'f5int9');
SELECT e2e.passo('F5b.9.alta', 9, 'f5_med_int', '/internacao (Alta)', 'Alta melhorada com orientação à UBS',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_melhorada', 'J18.9', NULL, NULL, 'Boa evolução com antibiótico',
    '{"orientacao_ubs":"Reavaliar em 7 dias e conferir o término do antibiótico"}'::jsonb)::text$q$, e2e.u('f5int9')));
SELECT e2e.passo('F5b.9.retorno', 9, 'f5_med_ubs', '/encaminhados?aba=retornos', 'A UBS recebe o retorno da internação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE (r ->> 'internacao')::boolean AND r -> 'paciente' ->> 'nome' = 'Carlos F5 Pneumonia'), 'retorno da internação')$q$, 'f5100000-0000-4000-8000-000000000001'));
SELECT e2e.passo('F5b.9.desfaz', 9, 'f5_med_int', '/internacao', 'Desfaz a alta com justificativa',
  format($q$SELECT public.cancelar_alta(%L::uuid, 'Alta registrada no paciente errado, desfeita')::text$q$, e2e.u('f5int9')));
SELECT e2e.passo('F5b.9.retorno_cancelado', 9, 'f5_med_ubs', '/encaminhados?aba=retornos', 'O retorno da alta desfeita sai da lista',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid)) r
    WHERE (r ->> 'internacao')::boolean AND r -> 'paciente' ->> 'nome' = 'Carlos F5 Pneumonia'), 'retorno cancelado')$q$, 'f5100000-0000-4000-8000-000000000001'));

-- ── permissão de outra rede (depois da correção 20270219000001) ─────────────
SELECT e2e.passo('F5b.X.outra_rede_retornos', NULL, 'plantonista', '/encaminhados', 'Conta de outra rede não lê os retornos da UBS F5 (deve ser recusado)',
  format('SELECT public.contrarreferencias_da_unidade(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000001'), 'erro:Acesso negado');
SELECT e2e.passo('F5b.X.outra_rede_envios', NULL, 'plantonista', '/encaminhados', 'Conta de outra rede não lê os envios da UBS F5 (deve ser recusado)',
  format('SELECT public.encaminhamentos_upa_origem(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000001'), 'erro:Acesso negado');
SELECT e2e.passo('F5b.X.outra_rede_agenda', NULL, 'plantonista', '/agenda-consultas', 'Conta de outra rede não lê a agenda da UBS F5 (deve ser recusado)',
  format('SELECT public.agenda_dia(%L::uuid, private.data_atual())::text', 'f5100000-0000-4000-8000-000000000001'), 'erro');
SELECT e2e.passo('F5b.X.outra_rede_pendencias', NULL, 'plantonista', '/pendencias', 'Conta de outra rede não lê as pendências da UPA F5 (deve ser recusado)',
  format('SELECT public.pendencias_pep(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000002'), 'erro:Acesso negado');
SELECT e2e.passo('F5b.X.outra_rede_hiperdia', NULL, 'plantonista', '/hiperdia', 'Conta de outra rede não lê o hiperdia da UBS F5 (deve ser recusado)',
  format('SELECT public.hiperdia_painel(%L::uuid)::text', 'f5100000-0000-4000-8000-000000000001'), 'erro');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'F5b.%' AND em > now() - interval '1 hour' GROUP BY 1 ORDER BY 1;
