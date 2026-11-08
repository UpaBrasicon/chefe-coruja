-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D08.
-- Sem conexão: fila cifrada com chave do servidor, recarga, volta da rede e
-- revisão tardia. Especificação: CENARIOS-D-bordas-acessos.md, seção D08.
--
-- O modo sem conexão é de TELA (IndexedDB, AES-GCM, recarga, outra aba,
-- relógio do aparelho). Aqui se confere o que é do banco: chave_fila() só
-- depois do 2º fator, sincronizar_registros (tipos aceitos, hora do fato,
-- limite de 2 h, idempotência, registro de mais de 24 h para revisão),
-- decidir_revisao_sincronizacao, contingência e reentrada, trocar_chave_fila.
-- O resto fica registrado como "só na tela".
--
-- Roda na UPA Bloco D (boxes OBD-), com as contas do bloco: recepção,
-- enfermagem da porta, plantonista A, enfermeiro e médica da Observação D e
-- gestor. Paciente fictício novo por rodada ("Pedro Teste Sem Rede").
-- A chave exigir_segundo_fator é ligada SÓ dentro da transação e volta a false.
--
-- Rodar antes: 47, 49d e 85 (o D06 escala e faz o check-in da Observação D).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/87_cenario_d08.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d08_rodada', (coalesce(e2e.d_v('d08_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE (nome LIKE 'd08\_%' AND nome <> 'd08_rodada') OR nome = 'd_claims_d_enf_obs';
SELECT e2e.d_guardar('d08_nome', 'Pedro Teste Sem Rede' || CASE WHEN e2e.d_v('d08_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d08_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d08_cadastro', jsonb_build_object('nome', e2e.d_v('d08_nome'), 'data_nascimento', '1978-07-27', 'sexo', 'M', 'raca_cor', 'parda',
  'cns', e2e.d_cns(9890 + e2e.d_v('d08_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D08', 'endereco', 'Rua do Teste, 8', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.d_guardar('d08_data', private.data_do_turno(now())::text);
SELECT e2e.d_guardar('d08_turno', CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '07:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '13:00' THEN 'manha'
                                       WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '19:00' THEN 'tarde'
                                       ELSE 'noite' END);
SELECT e2e.d_guardar('d08_s', gen_random_uuid()::text);
SELECT e2e.d_guardar('d08_i1', gen_random_uuid()::text), e2e.d_guardar('d08_i2', gen_random_uuid()::text),
       e2e.d_guardar('d08_i6', gen_random_uuid()::text), e2e.d_guardar('d08_i7', gen_random_uuid()::text);

-- item da fila como a tela envia (sincronizar.ts): hora do fato, sem conexão, último contato
CREATE OR REPLACE FUNCTION e2e.d08_item(p_id text, p_tipo text, p_hora timestamptz, p_contato timestamptz, p_dados jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('id', p_id, 'tipo', p_tipo, 'hora', p_hora, 'sem_conexao', true, 'ultimo_contato', p_contato, 'aparelho_id', 'e2e-d08', 'dados', p_dados)
$$;
CREATE OR REPLACE FUNCTION e2e.d08_fc(p_valor numeric, p_int boolean DEFAULT true) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('paciente_id', e2e.d_v('d08_pac'), 'internacao_id', CASE WHEN p_int THEN e2e.d_v('d08_int') END,
    'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = 'frequencia-cardiaca' AND c.unidade_id IS NULL), 'valor_num', p_valor, 'origem', 'manual')
$$;
CREATE OR REPLACE FUNCTION e2e.d08_doc(p_tipo text, p_texto text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('paciente_id', e2e.d_v('d08_pac'), 'tipo', p_tipo, 'conteudo', p_texto, 'episodio_id', e2e.d_v('d08_ep'))
$$;

-- ── 0. paciente em observação na UPA Bloco D ────────────────────────────────
SELECT e2e.d_passo('D08.00.ficha', 8, 'd_rec', '/recepcao', 'Recepção abre a ficha de Pedro',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Desidratação, vômitos desde ontem', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'fd300000-0000-4000-8000-000000000011', e2e.d_v('d08_cadastro')), 'ok', 'd08_ep');
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.paciente', 8, 'banco', NULL, 'Paciente da ficha', format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.d_v('d08_ep')), 'ok', 'd08_pac');
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.chamar', 8, 'd_enf', '/triagem', 'Enfermeira chama Pedro',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d08_ep'), 'fd400000-0000-4000-8000-000000000001'));
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.classificar', 8, 'd_enf', '/triagem (Classificar)', 'Classifica: "Diarreia e vômitos" (adulto), sinais crus; cor verde = escolha da enfermeira de teste',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde',
    '{"frequencia-cardiaca":100,"frequencia-respiratoria":18,"temperatura":37.2,"saturacao-o2":98,"escala-dor":3,"pressao-arterial-sistolica":112,"pressao-arterial-diastolica":70}'::jsonb,
    %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'verde'), '{}'::jsonb)::text$q$,
    e2e.d_v('d08_ep'), '5322011f-5f03-4006-8377-eda81320fb71', 'fd100000-0000-4000-8000-000000000001', '5322011f-5f03-4006-8377-eda81320fb71'));
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.iniciar', 8, 'd_plant_a', '/atendimento', 'Plantonista A assume', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.d_v('d08_ep')));
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.soap', 8, 'd_plant_a', '/atendimento', 'SOAP com CID E86 (desidratação)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Vômitos desde ontem (teste D08)', 'Mucosas secas, sinais crus da triagem', 'Desidratação leve', 'Observação e hidratação oral', 'E86')::text$q$, e2e.d_v('d08_ep')));
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.observacao', 8, 'd_plant_a', '/atendimento (AbaDesfecho)', 'Desfecho observação (box da Observação D)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d08_ep')));
SELECT e2e.d_dep('d08_ep', 'D08.00.ficha', 'D08.00.internacao', 8, 'banco', NULL, 'Internação de observação',
  format($q$SELECT id::text FROM public.internacoes WHERE episodio_id = %L AND status = 'em_observacao'$q$, e2e.d_v('d08_ep')), 'ok', 'd08_int');
SELECT CASE WHEN e2e.d_v('d08_ep') IS NOT NULL THEN e2e.d_ajuste('D08.00.chegou_antes', 8, 'Pedro chegou 3 h antes e está em observação há 2 h (datas do episódio e da internação levadas ao passado; paciente do bloco D)',
  format($q$UPDATE public.episodios SET chegada_em = now() - interval '3 hours', classificado_em = now() - interval '170 minutes', atendimento_iniciado_em = now() - interval '150 minutes', desfecho_em = now() - interval '2 hours' WHERE id = %L;
            UPDATE public.internacoes SET data_admissao = now() - interval '2 hours', data_entrada_setor = now() - interval '2 hours' WHERE id = %L$q$, e2e.d_v('d08_ep'), e2e.d_v('d08_int'))) END;

-- ── 1. chave da fila só depois do 2º fator ──────────────────────────────────
SELECT e2e.d_ajuste('D08.01.liga_2fa', 8, 'Liga exigir_segundo_fator SÓ dentro desta transação (volta a false no fim)',
  $q$UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator'$q$);
SELECT e2e.d_passo('D08.01.sem_2fa', 8, 'd_enf_obs', 'login → /enfermagem', 'Sem o 2º fator, chave_fila() recusa',
  $q$SELECT 'chave entregue (' || length(public.chave_fila()) || ' caracteres)'$q$, 'erro:SEGUNDO_FATOR');
SELECT e2e.d_ajuste('D08.01.simula_codigo', 8, 'Simula o código confirmado na sessão de teste do enfermeiro da Observação D',
  format('INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (%L, %L, now())', e2e.d_v('d08_s'), 'fd200000-0000-4000-8000-000000000011'));
SELECT e2e.d_guardar('d_claims_d_enf_obs', jsonb_build_object('session_id', e2e.d_v('d08_s'))::text);
SELECT e2e.d_passo('D08.01.com_2fa', 8, 'd_enf_obs', 'login → /enfermagem', 'Depois do 2º fator, chave_fila() entrega a chave (o valor não é registrado aqui)',
  $q$SELECT 'chave entregue (' || length(public.chave_fila()) || ' caracteres em base64)'$q$);
SELECT e2e.d_passo('D08.01.uma_por_perfil', 8, 'banco', NULL, 'private.chave_fila: uma linha por perfil; a mesma chave nas chamadas seguintes',
  $q$SELECT e2e.d_confere(count(*) = 1, count(*) || ' linha(s) do enfermeiro') FROM private.chave_fila WHERE perfil_id = 'fd200000-0000-4000-8000-000000000011'$q$);
DELETE FROM e2e.vars WHERE nome = 'd_claims_d_enf_obs';
SELECT e2e.d_ajuste('D08.01.desliga_2fa', 8, 'exigir_segundo_fator volta a false (estado da homologação)',
  $q$UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator'$q$);

-- ── 2. leitura com rede ─────────────────────────────────────────────────────
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.02.painel', 8, 'd_enf_obs', '/enfermagem/pronto-socorro (painel_observacao)', 'Com rede, o enfermeiro da Observação D vê Pedro no painel',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.painel_observacao(%L::uuid) x WHERE x::text LIKE '%%' || %L || '%%'), 'no painel')$q$,
    'fd100000-0000-4000-8000-000000000001', e2e.d_v('d08_nome')));

-- ── 3 e 9. fila: sinal vital (enfermagem) e folha provisória (médica) feitos sem rede, enviados na volta ─
SELECT e2e.d_lacuna('D08.03.fila_cifrada', 8, 'd_enf_obs', 'Fila IndexedDB cifrada (AES-GCM) com "na fila" e hora do aparelho corrigida', 'Só na tela (DevTools → Offline): fila.ts, relogio.ts.');
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.03.evolucao_enfermagem', 8, 'd_enf_obs', 'sem rede (AbasRegistro)',
  'Evolução de enfermagem como documento da fila (o catálogo espera aceitar; o servidor só aceita os tipos de folha da porta)',
  format($q$SELECT coalesce((SELECT e2e.d_falhar(x ->> 'motivo') FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x WHERE x ->> 'status' = 'recusado'), 'aceito')$q$,
    jsonb_build_array(e2e.d08_item(gen_random_uuid()::text, 'documento', now() - interval '8 minutes', now() - interval '20 minutes',
      e2e.d08_doc('evolucao_enfermagem', 'Evolução de enfermagem registrada sem conexão: paciente aceitando líquidos (teste D08).')))), 'ok');
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.sincronizar_sinal', 8, 'd_enf_obs', 'volta da rede (sincronizar.ts)',
  'Volta da rede: o enfermeiro envia a FC registrada há 10 min, sem conexão desde 20 min atrás',
  format($q$SELECT e2e.d_confere(bool_and(x ->> 'status' = 'gravado'), string_agg(x ->> 'status' || coalesce(' (' || (x ->> 'motivo') || ')', ''), '; ')) FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x$q$,
    jsonb_build_array(e2e.d08_item(e2e.d_v('d08_i1'), 'observacao', now() - interval '10 minutes', now() - interval '20 minutes', e2e.d08_fc(92)))));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.sincronizar_folha', 8, 'd_med_obs', 'volta da rede (prontuario.ts → folha provisória)',
  'Volta da rede: a médica envia a folha provisória (atestado) emitida há 8 min sem conexão',
  format($q$SELECT e2e.d_confere(bool_and(x ->> 'status' = 'gravado'), string_agg(x ->> 'status' || coalesce(' (' || (x ->> 'motivo') || ')', ''), '; ')) FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x$q$,
    jsonb_build_array(e2e.d08_item(e2e.d_v('d08_i2'), 'documento', now() - interval '8 minutes', now() - interval '20 minutes',
      e2e.d08_doc('atestado', 'Atestado de comparecimento emitido sem conexão (teste D08).')))));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.hora_do_fato', 8, 'banco', NULL, 'Gravados com o autor de cada um e a hora do fato (não a da chegada); marcados sem conexão; a folha ganha número',
  format($q$SELECT e2e.d_confere((SELECT registrado_por FROM public.observacao WHERE id = %L) = %L
        AND (SELECT aferido_em FROM public.observacao WHERE id = %L) = now() - interval '10 minutes'
        AND (SELECT autor_id FROM public.documentos_clinicos WHERE id = %L) = %L AND (SELECT sem_conexao FROM public.documentos_clinicos WHERE id = %L),
      'FC aferida às ' || coalesce((SELECT to_char(aferido_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') FROM public.observacao WHERE id = %L), '?')
      || '; folha ' || coalesce((SELECT tipo_documento || ' nº ' || coalesce(numero, '?') || ' emitida ' || to_char(emitido_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') FROM public.documentos_clinicos WHERE id = %L), 'não gravada'))$q$,
    e2e.d_v('d08_i1'), 'fd200000-0000-4000-8000-000000000011', e2e.d_v('d08_i1'), e2e.d_v('d08_i2'), 'fd200000-0000-4000-8000-000000000010', e2e.d_v('d08_i2'), e2e.d_v('d08_i1'), e2e.d_v('d08_i2')));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.idempotente', 8, 'd_enf_obs', 'volta da rede', 'Reenvio do mesmo sinal não duplica (ja_recebido)',
  format($q$SELECT e2e.d_confere(bool_and(x ->> 'status' = 'ja_recebido'), string_agg(x ->> 'status', '; ')) FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x$q$,
    jsonb_build_array(e2e.d08_item(e2e.d_v('d08_i1'), 'observacao', now() - interval '10 minutes', now() - interval '20 minutes', e2e.d08_fc(92)))));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.uma_linha', 8, 'banco', NULL, 'Depois do reenvio, uma linha só do sinal',
  format($q$SELECT e2e.d_confere(count(*) = 1, count(*) || ' linha(s)') FROM public.observacao WHERE id = %L$q$, e2e.d_v('d08_i1')));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.idempotente_folha', 8, 'd_med_obs', 'volta da rede', 'Reenvio da mesma folha não duplica (ja_recebido)',
  format($q$SELECT e2e.d_confere(bool_and(x ->> 'status' = 'ja_recebido'), string_agg(x ->> 'status', '; ')) FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x$q$,
    jsonb_build_array(e2e.d08_item(e2e.d_v('d08_i2'), 'documento', now() - interval '8 minutes', now() - interval '20 minutes',
      e2e.d08_doc('atestado', 'Atestado de comparecimento emitido sem conexão (teste D08).')))));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.09.id_de_outro', 8, 'd_med_obs', 'volta da rede', 'O mesmo id do sinal enviado por OUTRA pessoa é recusado (SYNC_ID_EM_USO)',
  format($q$SELECT coalesce((SELECT e2e.d_falhar(x ->> 'motivo') FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x WHERE x ->> 'status' = 'recusado'), 'aceito')$q$,
    jsonb_build_array(e2e.d08_item(e2e.d_v('d08_i1'), 'observacao', now() - interval '10 minutes', now() - interval '20 minutes', e2e.d08_fc(92)))), 'erro:SYNC_ID_EM_USO');

-- ── 4 e 7. o que não entra na fila e o limite de 2 h ────────────────────────
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.04.tipo_prescricao', 8, 'd_enf_obs', 'sem rede', 'Item de prescrição/checagem na fila é recusado (SYNC_TIPO): só observação e documento',
  format($q$SELECT coalesce((SELECT e2e.d_falhar(x ->> 'motivo') FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x WHERE x ->> 'status' = 'recusado'), 'aceito')$q$,
    jsonb_build_array(e2e.d08_item(gen_random_uuid()::text, 'checagem', now() - interval '5 minutes', now() - interval '20 minutes', '{}'::jsonb))), 'erro:SYNC_TIPO');
SELECT e2e.d_lacuna('D08.04.mensagem_tela', 8, 'd_enf_obs', 'Checar dose, prescrever ou dar desfecho sem rede: a tela recusa com mensagem',
  'Lacuna (MAPA): sem conexão só para observação e documento; o servidor recusa outros tipos (D08.04.tipo_prescricao); a mensagem é da tela.');
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.07.limite_2h', 8, 'd_enf_obs', 'sem rede', 'Registro feito 2 h e 10 min depois do último contato: recusado (SYNC_LIMITE)',
  format($q$SELECT coalesce((SELECT e2e.d_falhar(x ->> 'motivo') FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x WHERE x ->> 'status' = 'recusado'), 'aceito')$q$,
    jsonb_build_array(e2e.d08_item(gen_random_uuid()::text, 'observacao', now() - interval '5 minutes', now() - interval '135 minutes', e2e.d08_fc(90)))), 'erro:SYNC_LIMITE');
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.B1.hora_futura', 8, 'd_enf_obs', 'sem rede', 'Borda: relógio do aparelho adiantado (hora no futuro) é recusado (SYNC_HORA_FUTURA)',
  format($q$SELECT coalesce((SELECT e2e.d_falhar(x ->> 'motivo') FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x WHERE x ->> 'status' = 'recusado'), 'aceito')$q$,
    jsonb_build_array(e2e.d08_item(gen_random_uuid()::text, 'observacao', now() + interval '1 hour', now() - interval '10 minutes', e2e.d08_fc(90)))), 'erro:SYNC_HORA_FUTURA');
SELECT e2e.d_lacuna('D08.05.recarga', 8, 'd_enf_obs', 'Recarregar sem rede mantém a fila e o que a enfermagem leu', 'Só na tela (ligarConsultasSemConexao, fila.ts).');
SELECT e2e.d_lacuna('D08.06.outra_aba', 8, 'd_enf_obs', 'Outra aba sem a chave em memória não lê a fila', 'Só na tela: a chave fica só na memória da aba (o banco entrega por chave_fila, D08.01).');
SELECT e2e.d_lacuna('D08.12.fim_plantao', 8, 'd_enf_obs', 'Depois do fim do plantão + 20 min a fila fecha',
  'Regra de tela (regras.ts, tolerância do servidor = 20 min). No banco, o equivalente é SYNC_FORA_DO_PLANTAO (D08.12.fora_do_plantao).');
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.12.fora_do_plantao', 8, 'd_enf', 'volta da rede', 'Enfermeira da PORTA (sem plantão na Observação D) envia sinal de Pedro: SYNC_FORA_DO_PLANTAO',
  format($q$SELECT coalesce((SELECT e2e.d_falhar(x ->> 'motivo') FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x WHERE x ->> 'status' = 'recusado'), 'aceito')$q$,
    jsonb_build_array(e2e.d08_item(gen_random_uuid()::text, 'observacao', now() - interval '5 minutes', now() - interval '20 minutes', e2e.d08_fc(90)))), 'erro:SYNC_FORA_DO_PLANTAO');

-- ── 8. contingência em papel e reentrada ────────────────────────────────────
SELECT e2e.d_guardar('d08_cont', (SELECT id::text FROM public.contingencias WHERE unidade_id = 'fd100000-0000-4000-8000-000000000001'
   AND tstzrange(inicio, fim) && tstzrange(now() - interval '50 minutes', now() - interval '30 minutes') LIMIT 1))
 WHERE EXISTS (SELECT 1 FROM public.contingencias WHERE unidade_id = 'fd100000-0000-4000-8000-000000000001'
   AND tstzrange(inicio, fim) && tstzrange(now() - interval '50 minutes', now() - interval '30 minutes'));
SELECT CASE WHEN e2e.d_v('d08_cont') IS NOT NULL THEN 'contingência do período já registrada (rodada anterior): reaproveitada' ELSE e2e.d_passo('D08.08.contingencia', 8, 'd_enf_obs', '/contingencia (Contingencia.tsx)', 'Contingência em papel de 50 a 30 min atrás, registrada na volta da rede',
  format($q$SELECT public.registrar_contingencia(%L::uuid, now() - interval '50 minutes', now() - interval '30 minutes', 'Queda da internet na unidade (teste D08)')::text$q$,
    'fd100000-0000-4000-8000-000000000001'), 'ok', 'd08_cont') END;
SELECT e2e.d_dep('d08_cont', 'D08.08.contingencia', 'D08.08.reentrada', 8, 'd_enf_obs', '/contingencia', 'Marca a reentrada do que veio do papel no atendimento de Pedro',
  format($q$SELECT public.marcar_reentrada_contingencia(%L::uuid, %L::uuid, 'Sinais vitais de 00h00 transcritos do papel da contingência (teste D08)')::text$q$, e2e.d_v('d08_ep'), e2e.d_v('d08_cont')));
SELECT e2e.d_passo('D08.08.sobreposta', 8, 'd_enf_obs', '/contingencia', 'Segunda contingência no mesmo período (deve ser recusada)',
  format($q$SELECT public.registrar_contingencia(%L::uuid, now() - interval '45 minutes', now() - interval '35 minutes', 'Queda da internet de novo (teste D08)')::text$q$,
    'fd100000-0000-4000-8000-000000000001'), 'erro:Já existe contingência');

-- ── 10 e 11. registro de mais de 24 h vai à revisão do gestor ───────────────
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.escala_plantao WHERE perfil_id = 'fd200000-0000-4000-8000-000000000011' AND data = e2e.d_v('d08_data')::date - 1 AND turno = 'noite' AND ativo)
  THEN 'plantão de ontem já registrado (rodada anterior)' ELSE e2e.d_passo('D08.10.escala_ontem', 8, 'd_ges', '/escala', 'Gestor registra o plantão de ontem à noite do enfermeiro na Observação D (acerto retroativo)',
  format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, 'noite', NULL, false, 'enfermeiro')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000012', 'fd200000-0000-4000-8000-000000000011', e2e.d_v('d08_data')::date - 1)) END;
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.10.mais_24h', 8, 'd_enf_obs', 'volta da rede', 'Dois registros feitos há 25 h (sem conexão há 25 h 30) chegam agora: vão à revisão, não ao prontuário',
  format($q$SELECT e2e.d_confere(bool_and(x ->> 'status' = 'em_revisao'), string_agg(x ->> 'status' || coalesce(' (' || (x ->> 'motivo') || ')', ''), '; ')) FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)) x$q$,
    jsonb_build_array(e2e.d08_item(e2e.d_v('d08_i6'), 'observacao', now() - interval '25 hours', now() - interval '25 hours 30 minutes', e2e.d08_fc(96, false)),
                      e2e.d08_item(e2e.d_v('d08_i7'), 'documento', now() - interval '25 hours', now() - interval '25 hours 30 minutes',
                                   e2e.d08_doc('atestado', 'Folha antiga trazida de um aparelho sem rede (teste D08).')))));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.10.fora_do_prontuario', 8, 'banco', NULL, 'Os itens de 25 h estão em sincronizacao_revisao e não em observacao/documentos_clinicos',
  format($q$SELECT e2e.d_confere((SELECT count(*) FROM public.sincronizacao_revisao WHERE id IN (%L, %L) AND decisao IS NULL) = 2
      AND NOT EXISTS (SELECT 1 FROM public.observacao WHERE id = %L) AND NOT EXISTS (SELECT 1 FROM public.documentos_clinicos WHERE id = %L), '2 em revisão, nada no prontuário')$q$,
    e2e.d_v('d08_i6'), e2e.d_v('d08_i7'), e2e.d_v('d08_i6'), e2e.d_v('d08_i7')));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.11.enfermeiro_nao_decide', 8, 'd_enf_obs', '/auditoria', 'O enfermeiro não decide a revisão (deve ser recusado)',
  format($q$SELECT public.decidir_revisao_sincronizacao(%L::uuid, true, 'eu mesmo confiro')::text$q$, e2e.d_v('d08_i6')), 'erro:Acesso negado');
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.11.aceitar', 8, 'd_ges', '/auditoria → RevisaoSemConexao', 'Gestor aceita o sinal vital: "conferido com o papel da contingência"',
  format($q$SELECT public.decidir_revisao_sincronizacao(%L::uuid, true, 'conferido com o papel da contingência')::text$q$, e2e.d_v('d08_i6')));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.11.recusar', 8, 'd_ges', '/auditoria → RevisaoSemConexao', 'Gestor recusa a evolução com motivo',
  format($q$SELECT public.decidir_revisao_sincronizacao(%L::uuid, false, 'registro duplicado do papel')::text$q$, e2e.d_v('d08_i7')));
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.11.resultado', 8, 'banco', NULL, 'Aceito entra no prontuário com a hora do fato; recusado fica fora com motivo; decisões com autor',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.observacao WHERE id = %L AND aferido_em = now() - interval '25 hours')
      AND NOT EXISTS (SELECT 1 FROM public.documentos_clinicos WHERE id = %L)
      AND (SELECT count(*) FROM public.sincronizacao_revisao WHERE id IN (%L, %L) AND decisao IS NOT NULL) = 2,
      (SELECT string_agg(tipo || ': ' || decisao || ' (' || coalesce(motivo, '') || ')', '; ') FROM public.sincronizacao_revisao WHERE id IN (%L, %L)))$q$,
    e2e.d_v('d08_i6'), e2e.d_v('d08_i7'), e2e.d_v('d08_i6'), e2e.d_v('d08_i7'), e2e.d_v('d08_i6'), e2e.d_v('d08_i7')));

-- ── 13. troca da chave da fila ──────────────────────────────────────────────
SELECT e2e.d_passo('D08.13.gestor_nao_troca', 8, 'd_ges', '—', 'Gestor tenta trocar a chave da fila do enfermeiro (deve ser recusado: só o administrador)',
  format('SELECT public.trocar_chave_fila(%L::uuid)::text', 'fd200000-0000-4000-8000-000000000011'), 'erro:Acesso negado: só o administrador');
SELECT e2e.d_lacuna('D08.13.admin_troca', 8, 'f5_admin', 'Administrador troca a chave da fila (aparelho perdido)',
  'A UPA Bloco D não tem administrador; o admin.f5 só administra a Secretaria F5. A recusa para quem não é admin está acima; o aceite fica no D12 (só se houver conta do bloco D sob o admin).');

-- ── fim: Pedro segue em observação (box OBD-) até o fim da rodada; alta para liberar o box
SELECT e2e.d_dep('d08_int', 'D08.00.internacao', 'D08.99.alta', 8, 'd_med_obs', '/plantao/observacao', 'Fim do cenário: alta médica de Pedro (libera o box do bloco D)',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'alta_medica', 'E86', 'Melhora, aceitando líquidos (teste D08)', '{}'::jsonb)::text$q$, e2e.d_v('d08_int')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D08.%' AND em >= now() GROUP BY 1;
