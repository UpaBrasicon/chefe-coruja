-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D06.
-- Evasão na porta e na observação: desfecho, indicador e conta.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D06.
--
-- (a) Jonas: UBS F5 → UPA F5, evasão na PORTA antes do médico, contas F5
--     (pacientes novos do bloco D; nenhum box ocupado).
-- (b) Lúcia: evasão da OBSERVAÇÃO na UPA Bloco D (boxes OBD-, do próprio bloco),
--     para não disputar os boxes da Observação Adulto da UPA F5 com os outros
--     blocos. Contas do bloco D: recepção, enfermagem, plantonista A (porta),
--     médica e enfermeiro da Observação D, faturamento e gestor.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs reais.
-- Prescrição SEM dose de memória: a dose é o texto 'conforme protocolo — dado
-- fictício de teste de fluxo'. A cor da classificação é a escolha da
-- enfermeira de teste. Custos: o sistema calcula pelo SIGTAP; nada é digitado.
--
-- Rodar antes: 41, 47, 49d (e o 80, que associa o SIGTAP de classificação na
-- UPA Bloco D).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/85_cenario_d06.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d06_rodada', (coalesce(e2e.d_v('d06_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd06\_%' AND nome <> 'd06_rodada';
SELECT e2e.d_guardar('d06_suf', CASE WHEN e2e.d_v('d06_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d06_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d06_nome_j', 'Jonas Teste Evasão' || e2e.d_v('d06_suf'));
SELECT e2e.d_guardar('d06_nome_l', 'Lúcia Teste Observação' || e2e.d_v('d06_suf'));
SELECT e2e.d_guardar('d06_cad_j', jsonb_build_object('nome', e2e.d_v('d06_nome_j'), 'data_nascimento', '1990-05-20', 'sexo', 'M', 'raca_cor', 'parda',
  'cns', e2e.d_cns(9860 + e2e.d_v('d06_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D06', 'endereco', 'Rua do Teste, 6', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.d_guardar('d06_cad_l', jsonb_build_object('nome', e2e.d_v('d06_nome_l'), 'data_nascimento', '1962-11-08', 'sexo', 'F', 'raca_cor', 'branca',
  'cns', e2e.d_cns(9870 + e2e.d_v('d06_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D06 L', 'endereco', 'Rua do Teste, 7', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.d_guardar('d06_data', private.data_do_turno(now())::text);
SELECT e2e.d_guardar('d06_turno', CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '07:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '13:00' THEN 'manha'
                                       WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '19:00' THEN 'tarde'
                                       ELSE 'noite' END);
SELECT e2e.d_guardar('d06_hora', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));

-- plantão do bloco D no turno em curso + check-in (cria ou reaproveita)
CREATE OR REPLACE FUNCTION e2e.d06_plantao(p_conta text, p_papel text, p_setor uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  SELECT id INTO r FROM public.escala_plantao WHERE perfil_id = e2e.d_conta(p_conta) AND data = e2e.d_v('d06_data')::date AND turno = e2e.d_v('d06_turno') AND ativo;
  IF r IS NULL THEN
    PERFORM e2e.d_passo('D06.00.escala_' || p_conta, 6, 'd_ges', '/escala', 'Gestor escala ' || p_conta || ' no turno em curso',
      format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, %L)::text$q$,
        'fd100000-0000-4000-8000-000000000001', p_setor, e2e.d_conta(p_conta), e2e.d_v('d06_data'), e2e.d_v('d06_turno'), p_papel));
    SELECT id INTO r FROM public.escala_plantao WHERE perfil_id = e2e.d_conta(p_conta) AND data = e2e.d_v('d06_data')::date AND turno = e2e.d_v('d06_turno') AND ativo;
  END IF;
  IF r IS NOT NULL AND private.checkin_do_plantao(r) IS NULL THEN
    PERFORM e2e.d_passo('D06.00.checkin_' || p_conta, 6, p_conta, '/plantao/check-in', 'Check-in de ' || p_conta,
      format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'));
  END IF;
  RETURN coalesce(r::text, 'sem plantão');
END $$;

-- ── 0. pré-condições ────────────────────────────────────────────────────────
SELECT e2e.d06_plantao('d_rec', 'recepcao', 'fd300000-0000-4000-8000-000000000011');
SELECT e2e.d06_plantao('d_enf', 'enfermeiro', 'fd300000-0000-4000-8000-000000000011');
SELECT e2e.d06_plantao('d_plant_a', 'plantonista', 'fd300000-0000-4000-8000-000000000011');
SELECT e2e.d06_plantao('d_med_obs', 'plantonista', 'fd300000-0000-4000-8000-000000000012');
SELECT e2e.d06_plantao('d_enf_obs', 'enfermeiro', 'fd300000-0000-4000-8000-000000000012');
SELECT e2e.d_passo('D06.00.bpa_' || x.uso, 6, 'd_fat', '/faturamento (BPA)', 'Faturamento associa o SIGTAP ' || x.cod || ' ao uso ' || x.uso || ' na UPA Bloco D',
  format('SELECT public.associar_procedimento_bpa(%L::uuid, %L, %L)::text', 'fd100000-0000-4000-8000-000000000001', x.cod, x.uso))
  FROM (VALUES ('atendimento_medico', '0301060096'), ('medicacao', '0301100012')) x(uso, cod)
 WHERE NOT EXISTS (SELECT 1 FROM public.bpa_procedimentos_unidade b WHERE b.unidade_id = 'fd100000-0000-4000-8000-000000000001' AND b.uso = x.uso AND b.vigente_ate IS NULL);

-- ════ (a) Jonas: UBS F5 → UPA F5, evasão na porta ═══════════════════════════
SELECT e2e.d_passo('D06.01.ficha_ubs', 1, 'f5_rec_ubs', '/recepcao (UBS)', 'Recepção da UBS abre a ficha de escuta inicial de Jonas',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor abdominal há 1 dia', NULL, %L::jsonb || '{"tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.d_v('d06_cad_j')), 'ok', 'd06_ep_ubs');
SELECT e2e.d_dep('d06_ep_ubs', 'D06.01.ficha_ubs', 'D06.01.escuta', 1, 'f5_enf_ubs', '/escuta', 'Escuta inicial com sinais crus; cor amarelo = escolha da enfermeira de teste; saída consulta',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'amarelo', 'consulta', 'Dor abdominal há 1 dia, sem melhora com analgésico comum',
    '{"pressao-arterial-sistolica":126,"pressao-arterial-diastolica":80,"frequencia-cardiaca":96,"temperatura":37.6}'::jsonb)::text$q$, e2e.d_v('d06_ep_ubs')));
SELECT e2e.d_dep('d06_ep_ubs', 'D06.01.ficha_ubs', 'D06.01.enviar', 1, 'f5_enf_ubs', '/escuta → EnviarUpa', 'Enfermeira da UBS envia Jonas à UPA F5 com motivo',
  format($q$SELECT public.encaminhar_upa(%L::uuid, %L::uuid, 'Dor abdominal persistente, avaliação na UPA (teste D06)')::text$q$,
    e2e.d_v('d06_ep_ubs'), 'f5100000-0000-4000-8000-000000000002'), 'ok', 'd06_env');
SELECT e2e.d_passo('D06.02.ficha_upa', 1, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção da UPA F5 abre a ficha de Jonas no Pronto Socorro',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor abdominal há 1 dia (vindo da UBS)', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.d_v('d06_cad_j')), 'ok', 'd06_ep_j');
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.02.chegou', 1, 'f5_rec_upa', '/recepcao → VindoDaUbs', 'Marca "Chegou" com a ficha escolhida',
  format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid)::text', e2e.d_v('d06_env'), e2e.d_v('d06_ep_j')));
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.02.conta', 1, 'banco', NULL, 'Conta ambulatorial aberta, sem itens',
  format($q$SELECT c.id::text FROM public.contas c WHERE c.episodio_id = %L AND c.tipo = 'ambulatorial' AND c.status = 'aberta'$q$, e2e.d_v('d06_ep_j')), 'ok', 'd06_conta_j');
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.03.chamar', 1, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama Jonas para a Triagem 1',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d06_ep_j'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.03.classificar', 1, 'f5_enf_upa', '/triagem (Classificar)', 'Classifica: "Dor abdominal" (adulto), sinais crus; cor verde = escolha da enfermeira de teste',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde',
    '{"frequencia-cardiaca":94,"frequencia-respiratoria":18,"temperatura":37.5,"saturacao-o2":98,"escala-dor":5,"pressao-arterial-sistolica":124,"pressao-arterial-diastolica":78}'::jsonb,
    %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'verde'), '{}'::jsonb)::text$q$,
    e2e.d_v('d06_ep_j'), 'ae4698d1-8d90-4874-9584-42b92d788737', 'f5100000-0000-4000-8000-000000000002', 'ae4698d1-8d90-4874-9584-42b92d788737'));
SELECT e2e.d_lacuna('D06.04.chamadas_sem_resposta', 1, 'f5_rec_upa', 'Fila médica mostra as chamadas do painel sem resposta',
  'Só na tela (/recepcao/fila-medica e painel de chamada): as três chamadas sem resposta são o motivo descrito no desfecho.');
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.06.relato_curto', 1, 'f5_med_upa', '/atendimento → AbaDesfecho (MotivoEvasao)', 'Evasão com relato de 10 letras (deve ser recusada)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'evasao', 'Não voltou', '{"motivo_evasao":"demora"}'::jsonb)::text$q$, e2e.d_v('d06_ep_j')), 'erro:Descreva o ocorrido');
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.05.evasao_porta', 1, 'f5_med_upa', '/atendimento → AbaDesfecho (MotivoEvasao)',
  'Sem SOAP e sem assumir: evasão com relato ≥ 15 e motivo "demora" (o momento sai do estado do episódio: aguardando médico)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'evasao', 'Paciente não respondeu a três chamadas do painel', '{"motivo_evasao":"demora"}'::jsonb)::text$q$, e2e.d_v('d06_ep_j')));
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.05.encerrado', 1, 'banco', NULL, 'Episódio encerrado com desfecho evasão, autor = login do médico, sem atendimento médico',
  format($q$SELECT e2e.d_confere(desfecho = 'evasao' AND encerrado_em IS NOT NULL AND desfecho_por = %L AND atendimento_medico_id IS NULL,
      'desfecho ' || coalesce(desfecho, '?') || ', motivo ' || coalesce(desfecho_detalhes ->> 'motivo_evasao', '?'))
     FROM public.episodios WHERE id = %L$q$, 'f5200000-0000-4000-8000-000000000008', e2e.d_v('d06_ep_j')));
SELECT e2e.d_dep('d06_ep_j', 'D06.02.ficha_upa', 'D06.07.contrarreferencia', 1, 'f5_enf_ubs', '/encaminhados (Retornos)', 'A contrarreferência de Jonas chega à UBS como a_ver',
  format($q$SELECT coalesce((SELECT r ->> 'id' FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid, 7)) r
      WHERE r -> 'paciente' ->> 'nome' = %L LIMIT 1), e2e.d_falhar('sem contrarreferência para Jonas'))$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.d_v('d06_nome_j')), 'ok', 'd06_ret');
SELECT e2e.d_dep('d06_ret', 'D06.07.contrarreferencia', 'D06.07.abrir', 1, 'f5_enf_ubs', '/encaminhados (Retornos)', 'Enfermeira da UBS abre o retorno (desfecho evasão)',
  format('SELECT left(public.contrarreferencia_abrir(%L::uuid)::text, 300)', e2e.d_v('d06_ret')));
SELECT e2e.d_dep('d06_ret', 'D06.07.contrarreferencia', 'D06.07.visto', 1, 'banco', NULL, 'a_ver → visto, com o desfecho evasão',
  format($q$SELECT e2e.d_confere(situacao = 'visto' AND desfecho = 'evasao', 'situação ' || situacao || ', desfecho ' || coalesce(desfecho, '?')) FROM public.contrarreferencias WHERE id = %L$q$, e2e.d_v('d06_ret')));

-- ════ (b) Lúcia: observação e evasão da observação (UPA Bloco D) ═════════════
SELECT e2e.d_passo('D06.08.ficha', 2, 'd_rec', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Lúcia no Pronto Socorro D',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Tontura e vômitos', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'fd300000-0000-4000-8000-000000000011', e2e.d_v('d06_cad_l')), 'ok', 'd06_ep_l');
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.08.paciente', 2, 'banco', NULL, 'Paciente e conta de Lúcia',
  format($q$SELECT paciente_id::text FROM public.episodios WHERE id = %L$q$, e2e.d_v('d06_ep_l')), 'ok', 'd06_pac_l');
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.08.conta', 2, 'banco', NULL, 'Conta ambulatorial aberta',
  format($q$SELECT c.id::text FROM public.contas c WHERE c.episodio_id = %L AND c.tipo = 'ambulatorial' AND c.status = 'aberta'$q$, e2e.d_v('d06_ep_l')), 'ok', 'd06_conta_l');
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.09.chamar', 2, 'd_enf', '/triagem (Fila)', 'Enfermeira chama Lúcia',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d06_ep_l'), 'fd400000-0000-4000-8000-000000000001'));
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.09.classificar', 2, 'd_enf', '/triagem (Classificar)', 'Classifica: "Desmaio, vertigem" (adulto), sinais crus; cor amarelo = escolha da enfermeira de teste',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo',
    '{"frequencia-cardiaca":102,"frequencia-respiratoria":18,"temperatura":36.8,"saturacao-o2":97,"escala-dor":2,"pressao-arterial-sistolica":108,"pressao-arterial-diastolica":64}'::jsonb,
    %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'amarelo'), '{}'::jsonb)::text$q$,
    e2e.d_v('d06_ep_l'), '9f72e450-391c-46fc-955e-9880a10cde26', 'fd100000-0000-4000-8000-000000000001', '9f72e450-391c-46fc-955e-9880a10cde26'));
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.10.iniciar', 2, 'd_plant_a', '/atendimento', 'Plantonista A assume Lúcia',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.d_v('d06_ep_l')));
SELECT e2e.d_dep('d06_pac_l', 'D06.08.paciente', 'D06.10.peso', 2, 'd_plant_a', '/atendimento (Prescrição → peso)', 'Peso referido pela paciente, antes de prescrever (valor cru)',
  e2e.d_sinais(e2e.d_u('d06_pac_l'), '{"peso":68}', NULL, 'referido'));
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.10.soap', 2, 'd_plant_a', '/atendimento', 'SOAP com CID R42 (tontura)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Tontura e vômitos desde a manhã (teste D06)', 'PA 108x64, FC 102, sinais crus', 'Tontura com vômitos, desidratação leve', 'Antiemético e observação', 'R42')::text$q$, e2e.d_v('d06_ep_l')));
SELECT e2e.d_dep('d06_pac_l', 'D06.08.paciente', 'D06.10.prescrever', 2, 'd_plant_a', '/atendimento (Prescrição)',
  'Prescreve ondansetrona injetável do catálogo, "Agora"; dose = texto de teste (a dose real é a da tela, de fonte citada)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.d_v('d06_pac_l'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', 'e6462c72-c71c-4282-9ccf-3ca8a53fff8f', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Teste de fluxo D06 (sem dose de memória)')), 'ok', 'd06_item');
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.10.observacao', 2, 'd_plant_a', '/atendimento (AbaDesfecho)', 'Desfecho observação: box livre da Observação D',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d06_ep_l')));
SELECT e2e.d_dep('d06_ep_l', 'D06.08.ficha', 'D06.10.internacao', 2, 'banco', NULL, 'Internação de observação no box OBD-, sem conta própria (uma conta só, a da porta)',
  format($q$SELECT i.id::text FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
     WHERE i.episodio_id = %L AND i.status = 'em_observacao' AND l.identificador LIKE 'OBD-%%'
       AND (SELECT count(*) FROM public.contas c WHERE c.paciente_id = i.paciente_id) = 1$q$, e2e.d_v('d06_ep_l')), 'ok', 'd06_int');
SELECT e2e.d_dep('d06_item', 'D06.10.prescrever', 'D06.11.aprazar', 2, 'd_enf_obs', '/checagem', 'Enfermeiro da Observação D apraza a dose para agora',
  format('SELECT public.aprazar(%L::uuid, %L::text[], NULL)::text', e2e.d_v('d06_item'), ARRAY[e2e.d_v('d06_hora')]));
SELECT e2e.d_dep('d06_item', 'D06.10.prescrever', 'D06.11.checar', 2, 'd_enf_obs', '/checagem', 'Checa a dose "feito"',
  format('SELECT public.checar(%L::uuid, %L, %L, NULL)::text', e2e.d_v('d06_item'), 'feito', e2e.d_v('d06_hora')), 'ok', 'd06_adm');
SELECT e2e.d_dep('d06_int', 'D06.10.internacao', 'D06.12.observacao_curta', 2, 'd_med_obs', '/plantao/observacao (PacientesObservacao)', 'Evasão da observação com observação de 8 letras (deve ser recusada)',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_evasao', 'R42', NULL, NULL, 'Saiu só.', '{"motivo_evasao":"outro"}'::jsonb)::text$q$, e2e.d_v('d06_int')), 'erro:Descreva o ocorrido');
SELECT e2e.d_dep('d06_int', 'D06.10.internacao', 'D06.12.evasao_observacao', 2, 'd_med_obs', '/plantao/observacao (PacientesObservacao)', 'Lúcia saiu do box sem avisar: dar_alta alta_evasao, CID R42, observação ≥ 15',
  format($q$SELECT public.dar_alta(%L::uuid, 'alta_evasao', 'R42', NULL, NULL, 'Paciente saiu do box sem avisar a equipe', '{"motivo_evasao":"outro"}'::jsonb)::text$q$, e2e.d_v('d06_int')));
SELECT e2e.d_dep('d06_int', 'D06.10.internacao', 'D06.12.encerrada', 2, 'banco', NULL, 'Internação encerrada com alta_evasao; episódio encerrado; box liberado',
  format($q$SELECT e2e.d_confere(i.status = 'alta_evasao' AND e.encerrado_em IS NOT NULL AND i.leito_atual_id IS NULL,
      'internação ' || i.status || ', episódio encerrado ' || coalesce(to_char(e.encerrado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'não') || ', sem leito atual (box liberado)')
     FROM public.internacoes i JOIN public.episodios e ON e.id = i.episodio_id
    WHERE i.id = %L$q$, e2e.d_v('d06_int')));

-- ── 13. indicador de evasão ─────────────────────────────────────────────────
SELECT e2e.d_passo('D06.13.indicador_upa_f5', 1, 'f5_ges_upa', '/gestao (PainelGestor)', 'Indicador de evasão da UPA F5: Jonas, momento aguardando_medico, motivo demora',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'casos') c WHERE c ->> 'nome' = %L AND c ->> 'momento' = 'aguardando_medico' AND c ->> 'motivo' = 'demora'),
      'por_momento ' || coalesce((r -> 'por_momento')::text, '?'))
     FROM (SELECT public.indicador_evasao(%L::uuid, private.data_atual() - 1, private.data_atual()) r) x$q$,
    e2e.d_v('d06_nome_j'), 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.d_passo('D06.13.indicador_bloco_d', 2, 'd_ges', '/gestao (PainelGestor)', 'Indicador de evasão da UPA Bloco D: Lúcia, momento observacao, motivo outro',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'casos') c WHERE c ->> 'nome' = %L AND c ->> 'momento' = 'observacao' AND c ->> 'motivo' = 'outro'),
      'por_momento ' || coalesce((r -> 'por_momento')::text, '?'))
     FROM (SELECT public.indicador_evasao(%L::uuid, private.data_atual() - 1, private.data_atual()) r) x$q$,
    e2e.d_v('d06_nome_l'), 'fd100000-0000-4000-8000-000000000001'));
SELECT e2e.d_passo('D06.13.recepcao_sem_indicador', 2, 'd_rec', '/gestao', 'Recepção não lê o indicador (deve ser recusado)',
  format($q$SELECT public.indicador_evasao(%L::uuid, private.data_atual() - 1, private.data_atual())::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'erro');

-- ── 14. contas: valores e fechamento ────────────────────────────────────────
SELECT e2e.d_dep('d06_conta_j', 'D06.02.conta', 'D06.14.itens_jonas', 1, 'f5_fat', '/faturamento/contas', 'Conta de Jonas: só a classificação; consulta não nasce (médico não assumiu)',
  format($q$SELECT e2e.d_confere((d -> 'itens')::text LIKE '%%0301060118%%' AND (d -> 'itens')::text NOT LIKE '%%0301060096%%',
      'total ' || coalesce(d ->> 'total_referencia', '?') || '; itens ' || jsonb_array_length(d -> 'itens'))
     FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.d_v('d06_conta_j')));
SELECT e2e.d_dep('d06_conta_l', 'D06.08.conta', 'D06.14.itens_lucia', 2, 'd_fat', '/faturamento/contas', 'Conta de Lúcia: classificação, consulta e administração; medicamento sem valor',
  format($q$SELECT e2e.d_confere((d -> 'itens')::text LIKE '%%0301060118%%' AND (d -> 'itens')::text LIKE '%%0301060096%%' AND (d -> 'itens')::text LIKE '%%0301100012%%',
      'total ' || coalesce(d ->> 'total_referencia', '?') || '; itens ' || jsonb_array_length(d -> 'itens') || '; medicamentos ' || coalesce(jsonb_array_length(d -> 'medicamentos'), 0))
     FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.d_v('d06_conta_l')));
SELECT e2e.d_dep('d06_conta_j', 'D06.02.conta', 'D06.14.conferencia_j', 1, 'f5_fat', '/faturamento/contas', 'Conta de Jonas: aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 200)', e2e.d_v('d06_conta_j'), 'em_conferencia'));
SELECT e2e.d_dep('d06_conta_j', 'D06.02.conta', 'D06.14.fechar_j', 1, 'f5_fat', '/faturamento/contas', 'Conta de Jonas: em_conferencia → fechada (a evasão libera o fechamento)',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 200)', e2e.d_v('d06_conta_j'), 'fechada'));
SELECT e2e.d_dep('d06_conta_l', 'D06.08.conta', 'D06.14.conferencia_l', 2, 'd_fat', '/faturamento/contas', 'Conta de Lúcia: aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 200)', e2e.d_v('d06_conta_l'), 'em_conferencia'));
SELECT e2e.d_dep('d06_conta_l', 'D06.08.conta', 'D06.14.fechar_sem_cnes', 2, 'd_fat', '/faturamento/contas', 'Fechar a conta de Lúcia: a UPA Bloco D não tem CNES (pendência bloqueante; deve ser recusado)',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 200)', e2e.d_v('d06_conta_l'), 'fechada'), 'erro:A conta tem 1 pendência(s) bloqueante(s)');
SELECT e2e.d_dep('d06_conta_l', 'D06.08.conta', 'D06.14.liberar_l', 2, 'd_ges', '/faturamento/contas', 'Gestor libera o fechamento com motivo (unidade de teste sem CNES)',
  format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo D06: unidade de teste do bloco D sem CNES')::text, 200)$q$, e2e.d_v('d06_conta_l')));
SELECT e2e.d_dep('d06_conta_l', 'D06.08.conta', 'D06.14.fechar_l', 2, 'd_fat', '/faturamento/contas', 'Conta de Lúcia: em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 200)', e2e.d_v('d06_conta_l'), 'fechada'));
SELECT e2e.d_passo('D06.14.congelados', 0, 'banco', NULL, 'Contas fechadas com itens congelados; total de referência de cada uma',
  format($q$SELECT string_agg(p.nome || ': ' || c.status || ', ' || coalesce(jsonb_array_length(c.itens_congelados), 0) || ' itens congelados, total '
      || coalesce((SELECT sum((x ->> 'valor_total')::numeric) FROM jsonb_array_elements(c.itens_congelados) x)::text, 'nulo'), '; ')
     FROM public.contas c JOIN public.pacientes p ON p.id = c.paciente_id WHERE c.id IN (%L, %L)$q$,
    coalesce(e2e.d_v('d06_conta_j'), gen_random_uuid()::text), coalesce(e2e.d_v('d06_conta_l'), gen_random_uuid()::text)));

-- ── bordas ──────────────────────────────────────────────────────────────────
SELECT e2e.d_passo('D06.B1.ficha', 3, 'd_rec', '/recepcao', 'Borda: paciente que sai antes da triagem (ficha aberta)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de dente', NULL, %L::jsonb) ->> 'episodio_id')$q$, 'fd300000-0000-4000-8000-000000000011',
    jsonb_build_object('nome', 'Teste Evasão Antes Triagem D06' || e2e.d_v('d06_suf'), 'data_nascimento', '1988-03-03', 'sexo', 'M')), 'ok', 'd06_ep_b1');
SELECT e2e.d_dep('d06_ep_b1', 'D06.B1.ficha', 'D06.B1.evasao_antes_triagem', 3, 'd_plant_a', '/atendimento → AbaDesfecho', 'Borda (caminho do catálogo): o médico registra a evasão antes da triagem pelo desfecho (recusado: o episódio ainda está na triagem)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'evasao', 'Saiu antes de ser chamado para a triagem', '{"motivo_evasao":"demora"}'::jsonb)::text$q$, e2e.d_v('d06_ep_b1')), 'erro:O episódio não está em atendimento');
SELECT e2e.d_dep('d06_ep_b1', 'D06.B1.ficha', 'D06.B1.retirar_da_fila', 3, 'd_rec', '/recepcao (retirar da fila)', 'Borda: o caminho do produto é retirar da fila com motivo evasão (justificativa ≥ 15)',
  format($q$SELECT public.retirar_da_fila(%L::uuid, 'evasao', 'Saiu antes de ser chamado para a triagem')::text$q$, e2e.d_v('d06_ep_b1')));
SELECT e2e.d_dep('d06_ep_b1', 'D06.B1.ficha', 'D06.B1.conta_sem_itens', 3, 'd_fat', '/faturamento/contas', 'Conta do episódio retirado da fila (evasão antes da triagem): sem itens',
  format($q$SELECT e2e.d_confere(jsonb_array_length(public.conta_detalhe(c.id) -> 'itens') = 0, 'conta ' || c.status || ' com ' || jsonb_array_length(public.conta_detalhe(c.id) -> 'itens') || ' itens')
     FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') x, LATERAL (SELECT (x ->> 'id')::uuid AS id, x ->> 'status' AS status) c
    WHERE x -> 'paciente' ->> 'nome' = %L$q$, 'fd100000-0000-4000-8000-000000000001', 'Teste Evasão Antes Triagem D06' || e2e.d_v('d06_suf')));
SELECT e2e.d_lacuna('D06.B2.rascunho_descartado', 3, 'd_plant_a', 'Evasão durante o atendimento com rascunho de SOAP: o rascunho é descartado',
  'Coberto pelo código: registrar_desfecho apaga atendimento_rascunhos do episódio (DELETE no fim da RPC); não exercitado nesta rodada.');
SELECT e2e.d_lacuna('D06.B4.cancelar_alta', 3, 'd_med_obs', 'Alta desfeita (cancelar_alta) da evasão cancela a contrarreferência', 'Não exercitado nesta rodada (coorte F5 #9 cobre).');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D06.%' AND em >= now() GROUP BY 1;
