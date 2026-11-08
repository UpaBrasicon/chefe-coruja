-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D07.
-- Óbito na UPA: sumário, notificação compulsória (SINAN) e regulação em curso.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D07.
--
-- Roda na UPA F5 e na Central de Regulação F5 (a regulação precisa da central
-- da rede), com as contas F5 e uma paciente NOVA do bloco D. Nenhum leito é
-- reservado: a regulação fica em análise e é negada no fim. Nenhuma dose de
-- memória: a dose é o texto 'conforme protocolo — dado fictício de teste de
-- fluxo'. A cor da classificação é a escolha da enfermeira de teste.
--
-- Achado já previsto no catálogo e conferido aqui: o óbito NÃO cancela a
-- regulação em curso (passo 14).
--
-- Rodar antes: 41, 47 e 49d.
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/86_cenario_d07.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d07_rodada', (coalesce(e2e.d_v('d07_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd07\_%' AND nome <> 'd07_rodada';
SELECT e2e.d_guardar('d07_nome', 'Benedita Teste Óbito' || CASE WHEN e2e.d_v('d07_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d07_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d07_cadastro', jsonb_build_object('nome', e2e.d_v('d07_nome'), 'data_nascimento', '1951-03-15', 'sexo', 'F', 'raca_cor', 'parda',
  'cns', e2e.d_cns(9880 + e2e.d_v('d07_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D07', 'endereco', 'Rua do Teste, 70', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.d_guardar('d07_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
SELECT e2e.d_guardar('d07_ficha_sinan', jsonb_build_object('nome', e2e.d_v('d07_nome'), 'nascimento', '1951-03-15', 'sexo', 'F')::text);

-- ── 1 a 3. porta: ficha, classificação, atendimento ─────────────────────────
SELECT e2e.d_passo('D07.01.ficha', 7, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Benedita no Pronto Socorro',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Febre, rigidez de nuca e rebaixamento há 6 h', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.d_v('d07_cadastro')), 'ok', 'd07_ep');
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.01.paciente', 7, 'banco', NULL, 'Paciente da ficha', format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.d_v('d07_ep')), 'ok', 'd07_pac');
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.01.conta', 7, 'banco', NULL, 'Conta ambulatorial aberta',
  format($q$SELECT id::text FROM public.contas WHERE episodio_id = %L AND tipo = 'ambulatorial' AND status = 'aberta'$q$, e2e.d_v('d07_ep')), 'ok', 'd07_conta');
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.02.chamar', 7, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama Benedita',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d07_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.02.classificar', 7, 'f5_enf_upa', '/triagem (Classificar)', 'Classifica: "Mal-estar geral" (adulto), sinais crus; cor laranja = escolha da enfermeira de teste',
  format($q$SELECT public.classificar_risco(%L::uuid, 'laranja',
    '{"frequencia-cardiaca":118,"frequencia-respiratoria":24,"temperatura":39.4,"saturacao-o2":94,"escala-dor":7,"pressao-arterial-sistolica":96,"pressao-arterial-diastolica":58}'::jsonb,
    %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'laranja'), '{}'::jsonb)::text$q$,
    e2e.d_v('d07_ep'), '5b981a47-948c-46e2-838f-403c7d27da81', 'f5100000-0000-4000-8000-000000000002', '5b981a47-948c-46e2-838f-403c7d27da81'));
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.03.iniciar', 7, 'f5_med_upa', '/atendimento', 'Médico assume Benedita',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.d_v('d07_ep')));
SELECT e2e.d_dep('d07_pac', 'D07.01.paciente', 'D07.03.peso', 7, 'f5_med_upa', '/atendimento (Prescrição → peso)', 'Peso estimado antes de prescrever (paciente rebaixada; valor cru)',
  e2e.d_sinais(e2e.d_u('d07_pac'), '{"peso":60}', NULL, 'estimado'));
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.03.soap', 7, 'f5_med_upa', '/atendimento', 'SOAP com CID de meningite (G03.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Febre, rigidez de nuca e rebaixamento há 6 h (teste D07)', 'T 39,4; FC 118; PA 96x58; rigidez de nuca; sinais crus', 'Meningite provável', 'Exame, medicação e transferência', 'G03.9')::text$q$, e2e.d_v('d07_ep')));
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.03.exame', 7, 'f5_med_upa', '/atendimento (Exames)', 'Pede exame urgente (nome livre: a UPA F5 não tem lista de exames)',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"nome":"Líquor — citologia e bioquímica (teste D07)"}]'::jsonb, 'urgente', NULL)::text$q$, e2e.d_v('d07_ep')));
SELECT e2e.d_dep('d07_pac', 'D07.01.paciente', 'D07.03.prescrever', 7, 'f5_med_upa', '/atendimento (Prescrição)',
  'Prescreve dipirona injetável do catálogo, "Agora"; dose = texto de teste (a dose real é a da tela, de fonte citada)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.d_v('d07_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '00bc3daf-b7e5-4410-99d4-2c7301dd1922', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Teste de fluxo D07 (sem dose de memória)')), 'ok', 'd07_item');

-- ── 4. agravo ───────────────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_pac', 'D07.01.paciente', 'D07.04.agravo', 7, 'f5_med_upa', '/atendimento → ExamesEAgravos', 'Marca a suspeita de meningite (CID G03.9, que bate com o item 17b da LNNC)',
  format($q$SELECT public.marcar_agravo(%L::uuid, 'Meningite', 'G03.9')::text$q$, e2e.d_v('d07_pac')), 'ok', 'd07_agravo');

-- ── 5 e 6. regulação ────────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_pac', 'D07.01.paciente', 'D07.05.regulacao', 7, 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Solicita transferência: emergência, SIGTAP 0303010037, CID G03.9, transporte avançado',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.d_v('d07_pac'),
    jsonb_build_object('tipo', 'transferencia', 'procedimento', '0303010037', 'cid', 'G03.9', 'carater', 'urgencia', 'prioridade', 'emergencia',
      'destino_tipo', 'a_definir', 'tipo_leito', 'clinico', 'transporte', 'ambulancia_avancada',
      'quadro_clinico', 'Idosa com febre, rigidez de nuca e rebaixamento há 6 h; suspeita de meningite (teste D07).')), 'ok', 'd07_reg');
SELECT e2e.d_dep('d07_reg', 'D07.05.regulacao', 'D07.06.assumir', 7, 'f5_regulador', '/regulacao (Fila)', 'Regulador assume: em análise',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 200)', e2e.d_v('d07_reg')));

-- ── 7. checagem ─────────────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_item', 'D07.03.prescrever', 'D07.07.aprazar', 7, 'f5_enf_upa', '/checagem', 'Enfermeira apraza a dose para agora',
  format('SELECT public.aprazar(%L::uuid, %L::text[], NULL)::text', e2e.d_v('d07_item'), ARRAY[e2e.d_v('d07_hora')]));
SELECT e2e.d_dep('d07_item', 'D07.03.prescrever', 'D07.07.checar', 7, 'f5_enf_upa', '/checagem', 'Checa a dose "feito"',
  format('SELECT public.checar(%L::uuid, %L, %L, NULL)::text', e2e.d_v('d07_item'), 'feito', e2e.d_v('d07_hora')));

-- ── 8 e 9. notificação compulsória ──────────────────────────────────────────
SELECT e2e.d_dep('d07_pac', 'D07.01.paciente', 'D07.08.abrir', 7, 'f5_enf_upa', '/notificacao-compulsoria (FichaSinan)', 'Enfermeira abre a notificação do agravo (devolve a suspeita já marcada)',
  format($q$SELECT public.abrir_notificacao(%L::uuid, NULL, 'G03.9', %L::uuid, NULL)::text$q$, e2e.d_v('d07_pac'), e2e.d_v('d07_ep')), 'ok', 'd07_notif');
SELECT e2e.d_dep('d07_notif', 'D07.08.abrir', 'D07.08.mesma_suspeita', 7, 'banco', NULL, 'A notificação aberta é a mesma suspeita marcada pelo médico (não duplica)',
  format($q$SELECT e2e.d_confere(%L = %L, 'agravo ' || %L)$q$, e2e.d_v('d07_notif'), coalesce(e2e.d_v('d07_agravo'), '?'), e2e.d_v('d07_notif')));
SELECT e2e.d_dep('d07_notif', 'D07.08.abrir', 'D07.08.salvar_sem_7', 7, 'f5_enf_upa', 'FichaSinan', 'Salva a ficha com o campo 7 (data dos sintomas) vazio',
  format('SELECT public.salvar_ficha_notificacao(%L::uuid, %L::jsonb)::text', e2e.d_v('d07_notif'), e2e.d_v('d07_ficha_sinan')));
SELECT e2e.d_dep('d07_notif', 'D07.08.abrir', 'D07.08.registrar_sem_7', 7, 'f5_enf_upa', 'FichaSinan', 'Tenta registrar sem os campos 7 e 12 (deve listar as faltas pelo número do campo)',
  format('SELECT public.registrar_notificacao(%L::uuid, %L::jsonb, NULL)::text', e2e.d_v('d07_notif'), e2e.d_v('d07_ficha_sinan')), 'erro:Falta para registrar: Campo 7');
SELECT e2e.d_dep('d07_notif', 'D07.08.abrir', 'D07.09.registrar', 7, 'f5_enf_upa', 'FichaSinan', 'Preenche 7 (sintomas há 6 h, não futura), 8, 9, 11 e 12 (gestante: 6 = não se aplica) e registra com o nº do SINAN',
  format('SELECT public.registrar_notificacao(%L::uuid, %L::jsonb, %L)::text', e2e.d_v('d07_notif'),
    (e2e.d_v('d07_ficha_sinan')::jsonb || jsonb_build_object('data_sintomas', to_char((now() - interval '6 hours') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'), 'gestante', '6')), '2026110700'));
SELECT e2e.d_dep('d07_notif', 'D07.08.abrir', 'D07.09.notificado', 7, 'banco', NULL, 'Situação notificado; notificador = login da enfermeira; nº do SINAN gravado',
  format($q$SELECT e2e.d_confere(situacao = 'notificado' AND resolvido_por = %L AND numero_sinan = '2026110700', 'situação ' || situacao || ', nº ' || coalesce(numero_sinan, '?'))
     FROM public.agravos_notificacao WHERE id = %L$q$, 'f5200000-0000-4000-8000-000000000007', e2e.d_v('d07_notif')));

-- ── 15 (antes). NIR ─────────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_reg', 'D07.05.regulacao', 'D07.15.nir_antes', 7, 'f5_nir', '/nir (nir_pendencias)', 'Antes da decisão: a regulação de Benedita aparece nas pendências do NIR da UPA?',
  format($q$SELECT CASE WHEN public.nir_pendencias(%L::uuid)::text LIKE '%%' || %L || '%%' THEN 'aparece' ELSE e2e.d_falhar('não aparece (a pendência de regulação só surge depois do prazo)') END$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.d_v('d07_reg')));

-- ── 10, 13 e 11. óbito ──────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.10.sem_do', 7, 'f5_med_upa', '/atendimento → AbaDesfecho', 'Óbito sem o número da DO (deve ser recusado)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'obito', 'Parada cardiorrespiratória sem resposta às manobras', %L::jsonb)::text$q$, e2e.d_v('d07_ep'),
    jsonb_build_object('hora_obito', now() - interval '10 minutes', 'cid_obito', 'G03.9')), 'erro:Informe o número da Declaração de Óbito');
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.13.hora_futura', 7, 'f5_med_upa', 'AbaDesfecho', 'Óbito com hora no futuro (+5 min) (deve ser recusado)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'obito', 'Parada cardiorrespiratória sem resposta às manobras', %L::jsonb)::text$q$, e2e.d_v('d07_ep'),
    jsonb_build_object('hora_obito', now() + interval '5 minutes', 'cid_obito', 'G03.9', 'numero_do', '123456789')), 'erro:Hora do óbito no futuro');
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.13.do_4_digitos', 7, 'f5_med_upa', 'AbaDesfecho', 'Óbito com DO de 4 dígitos (deve ser recusado)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'obito', 'Parada cardiorrespiratória sem resposta às manobras', %L::jsonb)::text$q$, e2e.d_v('d07_ep'),
    jsonb_build_object('hora_obito', now() - interval '10 minutes', 'cid_obito', 'G03.9', 'numero_do', '1234')), 'erro:Óbito: o número da Declaração de Óbito tem de 6 a 12');
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.11.obito', 7, 'f5_med_upa', 'AbaDesfecho', 'Óbito: relato ≥ 15, hora −10 min, CID G03.9, DO 123456789, sem setor (vem da ficha)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'obito', 'Parada cardiorrespiratória sem resposta às manobras de reanimação', %L::jsonb)::text$q$, e2e.d_v('d07_ep'),
    jsonb_build_object('hora_obito', now() - interval '10 minutes', 'cid_obito', 'g03.9', 'numero_do', '123.456.789')));
SELECT e2e.d_dep('d07_ep', 'D07.01.ficha', 'D07.11.registro', 7, 'banco', NULL, 'Episódio encerrado; CID normalizado, DO só dígitos, setor do óbito da ficha; exame cancelado com o motivo; prescrição encerrada',
  format($q$SELECT e2e.d_confere(e.desfecho = 'obito' AND e.encerrado_em IS NOT NULL AND e.desfecho_detalhes ->> 'cid_obito' = 'G03.9'
        AND e.desfecho_detalhes ->> 'numero_do' = '123456789' AND e.desfecho_detalhes ->> 'setor_obito' = 'Pronto Socorro'
        AND NOT EXISTS (SELECT 1 FROM public.exames_pedidos x WHERE x.episodio_id = e.id AND x.situacao IN ('pedido', 'coletado', 'em_analise')),
      'cid ' || coalesce(e.desfecho_detalhes ->> 'cid_obito', '?') || ', DO ' || coalesce(e.desfecho_detalhes ->> 'numero_do', '?') || ', setor ' || coalesce(e.desfecho_detalhes ->> 'setor_obito', '?')
      || ', exames: ' || coalesce((SELECT string_agg(x.situacao || ' (' || coalesce(x.motivo_cancelamento, '') || ')', '; ') FROM public.exames_pedidos x WHERE x.episodio_id = e.id), 'nenhum'))
     FROM public.episodios e WHERE e.id = %L$q$, e2e.d_v('d07_ep')));

-- ── 12. sumário de óbito ────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_pac', 'D07.01.paciente', 'D07.12.sumario', 7, 'f5_med_upa', '/plantao/documentos (PlantaoToolRouter)', 'Emite o sumário de óbito (documento clínico)',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'sumario_obito', 'Sumário de óbito (teste de fluxo D07): meningite provável, óbito no Pronto Socorro; DO 123456789.', %L::uuid, NULL, NULL) ->> 'id')$q$,
    e2e.d_v('d07_pac'), e2e.d_v('d07_ep')), 'ok', 'd07_doc');
SELECT e2e.d_dep('d07_doc', 'D07.12.sumario', 'D07.12.documento', 7, 'banco', NULL, 'documentos_clinicos tipo sumario_obito, autor = login do médico',
  format($q$SELECT e2e.d_confere(tipo_documento = 'sumario_obito' AND autor_id = %L, 'tipo ' || tipo_documento || ', autor ' || autor_id) FROM public.documentos_clinicos WHERE id = %L$q$,
    'f5200000-0000-4000-8000-000000000008', e2e.d_v('d07_doc')));

-- ── 14. a regulação em curso (achado previsto) ──────────────────────────────
SELECT e2e.d_dep('d07_reg', 'D07.05.regulacao', 'D07.14.regulacao_segue', 7, 'banco', NULL, 'Depois do óbito, a regulação continua em análise (nada a cancela)',
  format($q$SELECT e2e.d_confere(status = 'em_analise', 'status ' || status || ' depois do óbito') FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.d_v('d07_reg')));
SELECT e2e.d_lacuna('D07.14.obito_cancela_regulacao', 7, 'f5_regulador', 'O óbito encerra a regulação em curso',
  'Lacuna (MAPA) confirmada: registrar_desfecho(obito) cancela exames e pareceres, mas não toca regulacao_solicitacoes; o regulador nega à mão (ja_atendido_obito) ou a origem cancela.');
SELECT e2e.d_dep('d07_reg', 'D07.05.regulacao', 'D07.14.negar', 7, 'f5_regulador', '/regulacao (Detalhe)', 'Regulador nega com motivo ja_atendido_obito',
  format($q$SELECT left(public.regulacao_negar(%L::uuid, 'ja_atendido_obito', 'Paciente evoluiu a óbito na unidade de origem (teste D07)')::text, 200)$q$, e2e.d_v('d07_reg')));
SELECT e2e.d_dep('d07_reg', 'D07.05.regulacao', 'D07.14.negada', 7, 'banco', NULL, 'Regulação negada, com evento',
  format($q$SELECT e2e.d_confere(s.status = 'negada' AND s.motivo_negacao = 'ja_atendido_obito' AND EXISTS (SELECT 1 FROM public.regulacao_eventos v WHERE v.solicitacao_id = s.id AND v.evento = 'negada'),
      'status ' || s.status || ', ' || (SELECT count(*) FROM public.regulacao_eventos v WHERE v.solicitacao_id = s.id) || ' eventos') FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.d_v('d07_reg')));
SELECT e2e.d_dep('d07_reg', 'D07.05.regulacao', 'D07.15.nir_depois', 7, 'f5_nir', '/nir (nir_pendencias)', 'Depois da negação, a regulação da falecida não está nas pendências do NIR',
  format($q$SELECT e2e.d_confere(public.nir_pendencias(%L::uuid)::text NOT LIKE '%%' || %L || '%%', 'fora das pendências')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.d_v('d07_reg')));

-- ── 16. conta ───────────────────────────────────────────────────────────────
SELECT e2e.d_dep('d07_conta', 'D07.01.conta', 'D07.16.itens', 7, 'f5_fat', '/faturamento/contas', 'Itens da conta: classificação, consulta e administração; exame e medicamento sem valor',
  format($q$SELECT e2e.d_confere((d -> 'itens')::text LIKE '%%0301060118%%' AND (d -> 'itens')::text LIKE '%%0301060096%%' AND (d -> 'itens')::text LIKE '%%0301100012%%',
      'total ' || coalesce(d ->> 'total_referencia', '?') || '; itens ' || jsonb_array_length(d -> 'itens') || '; medicamentos ' || coalesce(jsonb_array_length(d -> 'medicamentos'), 0))
     FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.d_v('d07_conta')));
SELECT e2e.d_dep('d07_conta', 'D07.01.conta', 'D07.16.conferencia', 7, 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.d_v('d07_conta'), 'em_conferencia'));
SELECT e2e.d_dep('d07_conta', 'D07.01.conta', 'D07.16.fechar', 7, 'f5_fat', '/faturamento/contas', 'em_conferencia → fechada (o óbito libera o fechamento)',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.d_v('d07_conta'), 'fechada'));
SELECT e2e.d_dep('d07_conta', 'D07.01.conta', 'D07.16.congelado', 7, 'banco', NULL, 'Itens congelados e total',
  format($q$SELECT e2e.d_confere(status = 'fechada' AND jsonb_array_length(itens_congelados) >= 3, status || ', ' || jsonb_array_length(itens_congelados) || ' itens, total '
      || coalesce((SELECT sum((x ->> 'valor_total')::numeric) FROM jsonb_array_elements(itens_congelados) x)::text, 'nulo')) FROM public.contas WHERE id = %L$q$, e2e.d_v('d07_conta')));

-- ── 17. gestor ──────────────────────────────────────────────────────────────
SELECT e2e.d_passo('D07.17.notificacoes', 7, 'f5_ges_upa', '/notificacao-compulsoria', 'Gestor lê a notificação do período: notificado com o nº do SINAN',
  format($q$SELECT e2e.d_confere(r::text LIKE '%%2026110700%%', left(r::text, 300)) FROM (SELECT public.notificacao_compulsoria_periodo(%L::uuid, private.data_atual() - 1, private.data_atual(), NULL) r) x$q$,
    'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.d_passo('D07.17.panorama', 7, 'f5_ges_upa', '/gestao (panorama_gestor)', 'Gestor lê o panorama do dia (óbitos)',
  format($q$SELECT left(public.panorama_gestor(%L::uuid)::text, 300)$q$, 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.d_passo('D07.17.painel_admin', 7, 'f5_admin', '/painel (painel_organizacao)', 'Admin: óbitos da UPA F5 no período, agregados e suprimidos de 1 a 4',
  $q$SELECT left((SELECT string_agg(x::text, ' | ') FROM public.painel_organizacao(1) x WHERE x::text LIKE '%UPA Fase 5%'), 300)$q$);

-- ── bordas ──────────────────────────────────────────────────────────────────
SELECT e2e.d_lacuna('D07.B1.obito_notificacao_aberta', 7, 'f5_med_upa', 'Óbito com a notificação ainda a_registrar (passos 9 e 11 invertidos)',
  'Não exercitado nesta rodada (exige outro episódio). Pelo código, o agravo suspeito sem notificação é o único que continua impedindo a alta da internação (dar_alta); na porta, registrar_desfecho não confere agravos.');
SELECT e2e.d_lacuna('D07.B2.obito_internado', 7, 'f5_med_upa', 'Óbito de internado: dar_alta(obito) encerra o que está aberto', 'Não exercitado nesta rodada (sem internação de teste livre).');
SELECT e2e.d_lacuna('D07.L1.sinan', 7, 'f5_enf_upa', 'Envio ao SINAN e mapeamento CID → agravo conferido pela vigilância', 'Lacuna (MAPA): o nº do SINAN é digitado; lnnc_cids traz "a conferir pela vigilância".');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D07.%' AND em >= now() GROUP BY 1;
