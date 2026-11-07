-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D10.
-- Pedido de prontuário encerrado: pedido, aprovação, 24 h, vencido, histórico
-- por motivo, gestor direto e farmacêutico barrado.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D10.
--
-- Roda na UPA F5 e na UBS F5 com as contas F5 e uma paciente NOVA do bloco D
-- ("Rosa Teste Arquivo"): dois atendimentos encerrados na UPA e um na UBS,
-- feitos pelo próprio script; no fim, o atendimento novo de Rosa é encerrado
-- (alta) para não ficar na porta da UPA F5. O "pedido próprio do gestor" usa a
-- conta gestor.d.f5 numa paciente do bloco D (o gestor não pede pela RPC).
-- A cor da classificação é a escolha da enfermeira de teste.
--
-- Rodar antes: 41, 47 e 49d (e o 85, para a paciente Lúcia do bloco D).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/89_cenario_d10.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d10_rodada', (coalesce(e2e.d_v('d10_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd10\_%' AND nome <> 'd10_rodada';
SELECT e2e.d_guardar('d10_nome', 'Rosa Teste Arquivo' || CASE WHEN e2e.d_v('d10_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d10_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d10_cadastro', jsonb_build_object('nome', e2e.d_v('d10_nome'), 'data_nascimento', '1958-06-30', 'sexo', 'F', 'raca_cor', 'branca',
  'cns', e2e.d_cns(9900 + e2e.d_v('d10_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D10', 'endereco', 'Rua do Teste, 10', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- um atendimento completo e encerrado na porta da UPA F5 (ficha → classificação → SOAP → alta)
CREATE OR REPLACE FUNCTION e2e.d10_episodio_upa(p_n int, p_queixa text, p_cid text, p_cor text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_ep text;
BEGIN
  PERFORM e2e.d_passo('D10.00.ficha_' || p_n, 10, 'f5_rec_upa', '/recepcao', 'Ficha ' || p_n || ' de Rosa na UPA F5 (' || p_queixa || ')',
    format($q$SELECT (public.registrar_ficha(%L::uuid, %L, %L::uuid, %L::jsonb) ->> 'episodio_id')$q$, 'f5300000-0000-4000-8000-000000000011', p_queixa,
      e2e.d_v('d10_pac'), CASE WHEN e2e.d_v('d10_pac') IS NULL THEN e2e.d_v('d10_cadastro') ELSE '{}' END), 'ok', 'd10_ep' || p_n);
  v_ep := e2e.d_v('d10_ep' || p_n);
  IF v_ep IS NULL THEN RETURN 'sem ficha'; END IF;
  IF e2e.d_v('d10_pac') IS NULL THEN PERFORM e2e.d_guardar('d10_pac', (SELECT paciente_id::text FROM public.episodios WHERE id = v_ep::uuid)); END IF;
  PERFORM e2e.d_passo('D10.00.chamar_' || p_n, 10, 'f5_enf_upa', '/triagem', 'Chama Rosa', format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', v_ep, '167a0658-f599-450c-85fc-f246f68f0d51'));
  PERFORM e2e.d_passo('D10.00.classificar_' || p_n, 10, 'f5_enf_upa', '/triagem (Classificar)', 'Classifica (cor ' || p_cor || ' = escolha da enfermeira de teste), sinais crus',
    format($q$SELECT public.classificar_risco(%L::uuid, %L,
      '{"frequencia-cardiaca":84,"frequencia-respiratoria":17,"temperatura":36.5,"saturacao-o2":97,"escala-dor":3,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":86}'::jsonb,
      %L::uuid, e2e.disc(%L::uuid, %L::uuid, %L), '{}'::jsonb)::text$q$, v_ep, p_cor,
      '5b981a47-948c-46e2-838f-403c7d27da81', 'f5100000-0000-4000-8000-000000000002', '5b981a47-948c-46e2-838f-403c7d27da81', p_cor));
  PERFORM e2e.d_passo('D10.00.iniciar_' || p_n, 10, 'f5_med_upa', '/atendimento', 'Médico assume', format('SELECT public.iniciar_atendimento(%L::uuid)::text', v_ep));
  PERFORM e2e.d_passo('D10.00.soap_' || p_n, 10, 'f5_med_upa', '/atendimento', 'SOAP com CID ' || p_cid,
    format($q$SELECT public.registrar_soap(%L::uuid, %L, 'Sinais crus da triagem (teste D10)', 'Avaliação do teste D10', 'Alta com orientação', %L)::text$q$, v_ep, p_queixa || ' (teste D10)', p_cid));
  RETURN v_ep;
END $$;

-- ── 0. histórico de Rosa: dois atendimentos encerrados na UPA e um na UBS ──
SELECT e2e.d10_episodio_upa(1, 'Dor no peito ao esforço', 'R07.4', 'amarelo');
SELECT e2e.d_dep('d10_ep1', 'D10.00.ficha_1', 'D10.00.alta_1', 10, 'f5_med_upa', '/atendimento → AbaDesfecho', 'Alta do 1º atendimento',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d10_ep1')));
SELECT e2e.d10_episodio_upa(2, 'Tontura ao levantar', 'R42', 'verde');
SELECT e2e.d_dep('d10_ep2', 'D10.00.ficha_2', 'D10.00.alta_2', 10, 'f5_med_upa', '/atendimento → AbaDesfecho', 'Alta do 2º atendimento',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d10_ep2')));
SELECT e2e.d_passo('D10.00.ficha_ubs', 10, 'f5_rec_ubs', '/recepcao (UBS)', 'Ficha de escuta inicial de Rosa na UBS F5',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Renovar orientação de curativo', NULL, %L::jsonb || '{"tipo_atendimento":"escuta_inicial"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000001', e2e.d_v('d10_cadastro')), 'ok', 'd10_ep_ubs');
SELECT e2e.d_dep('d10_ep_ubs', 'D10.00.ficha_ubs', 'D10.00.escuta_ubs', 10, 'f5_enf_ubs', '/escuta', 'Escuta azul (escolha da enfermeira de teste) com orientação: encerra na UBS',
  format($q$SELECT public.registrar_escuta_aps(%L::uuid, 'azul', 'orientacao', 'Renovar orientação de curativo', '{}'::jsonb, NULL, 'Orientada sobre o curativo e o retorno (teste D10)')::text$q$, e2e.d_v('d10_ep_ubs')));
SELECT e2e.d_dep('d10_ep_ubs', 'D10.00.ficha_ubs', 'D10.00.pac_ubs', 10, 'banco', NULL, 'Cadastro de Rosa na UBS (outro registro de paciente)',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.d_v('d10_ep_ubs')), 'ok', 'd10_pac_ubs');

-- pré-condição do catálogo: os atendimentos de Rosa são de DATAS ANTERIORES. Sem isso, quem está escalado
-- no setor lê o encerrado nas 24 h seguintes (paciente_no_meu_plantao), inclusive o farmacêutico.
SELECT CASE WHEN e2e.d_v('d10_ep1') IS NOT NULL THEN e2e.d_ajuste('D10.00.datas_anteriores', 10, 'Atendimentos encerrados de Rosa levados 3 dias para trás (paciente do bloco D)',
  format($q$UPDATE public.episodios SET chegada_em = chegada_em - interval '3 days', classificado_em = classificado_em - interval '3 days',
       atendimento_iniciado_em = atendimento_iniciado_em - interval '3 days', desfecho_em = desfecho_em - interval '3 days', encerrado_em = encerrado_em - interval '3 days'
     WHERE id IN (%L, %L, %L)$q$, e2e.d_v('d10_ep1'), coalesce(e2e.d_v('d10_ep2'), e2e.d_v('d10_ep1')), coalesce(e2e.d_v('d10_ep_ubs'), e2e.d_v('d10_ep1')))) END;

-- ── 1 a 4. pedido do médico que não cuida de Rosa ───────────────────────────
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.01.buscar', 10, 'f5_med_int', '/prontuarios (PedidosProntuario)', 'Médica da Internação busca Rosa (nome + nascimento) para pedir acesso',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.buscar_paciente_para_pedido(%L::uuid, NULL, %L, '1958-06-30') x WHERE x.paciente_id = %L::uuid), 'achada')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.d_v('d10_nome'), e2e.d_v('d10_pac')));
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.01.pedir', 10, 'f5_med_int', '/prontuarios', 'Pede acesso: "revisar internação anterior para parecer"',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'revisar internação anterior para parecer')::text$q$, e2e.d_v('d10_pac')), 'ok', 'd10_pedido');
SELECT e2e.d_dep('d10_pedido', 'D10.01.pedir', 'D10.01.pendente', 10, 'banco', NULL, 'Pedido pendente, sem validade',
  format($q$SELECT e2e.d_confere(status = 'pendente' AND valido_ate IS NULL, 'status ' || status) FROM public.pedidos_acesso_prontuario WHERE id = %L$q$, e2e.d_v('d10_pedido')));
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.02.repetir', 10, 'f5_med_int', '/prontuarios', 'Repete o pedido (deve ser recusado: já há um pendente)',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'revisar internação anterior para parecer')::text$q$, e2e.d_v('d10_pac')), 'erro:Já existe um pedido seu aguardando');
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.03.abrir_antes', 10, 'f5_med_int', '/prontuarios/:pacienteId (ProntuarioLeitura)', 'Tenta abrir antes da decisão (deve ser recusado)',
  format('SELECT left(public.abrir_prontuario(%L::uuid, NULL)::text, 100)', e2e.d_v('d10_pac')), 'erro');
SELECT e2e.d_passo('D10.04.motivo_curto', 10, 'f5_med_int', '/prontuarios', 'Motivo de 8 letras em outra paciente encerrada (deve ser recusado)',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'ver dado')::text$q$, coalesce(e2e.d_v('d07_pac'), e2e.d_v('d10_pac'))), 'erro:Escreva o motivo do pedido');

-- ── 5 e 6. gestor aprova; leitura por 24 h ──────────────────────────────────
SELECT e2e.d_dep('d10_pedido', 'D10.01.pedir', 'D10.05.lista_gestor', 10, 'f5_ges_upa', '/auditoria', 'O pedido aparece para o gestor da UPA',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.pedidos_acesso_da_unidade(%L::uuid, 7) x WHERE x.id = %L::uuid), 'na lista')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.d_v('d10_pedido')));
SELECT e2e.d_dep('d10_pedido', 'D10.01.pedir', 'D10.05.aprovar', 10, 'f5_ges_upa', '/auditoria', 'Gestor aprova',
  format('SELECT (public.decidir_pedido_acesso(%L::uuid, true, NULL)).status', e2e.d_v('d10_pedido')));
SELECT e2e.d_dep('d10_pedido', 'D10.01.pedir', 'D10.05.validade', 10, 'banco', NULL, 'aprovado, valido_ate = decidido_em + 24 h, decidido_por = gestor (cruza a meia-noite sem encurtar)',
  format($q$SELECT e2e.d_confere(status = 'aprovado' AND valido_ate = decidido_em + interval '24 hours' AND decidido_por = %L,
      'válido até ' || to_char(valido_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ' (decidido ' || to_char(decidido_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ')')
     FROM public.pedidos_acesso_prontuario WHERE id = %L$q$, 'f5200000-0000-4000-8000-000000000009', e2e.d_v('d10_pedido')));
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.06.abrir', 10, 'f5_med_int', '/prontuarios/:pacienteId', 'Abre e lê o prontuário encerrado (só leitura)',
  format('SELECT left(public.abrir_prontuario(%L::uuid, NULL)::text, 200)', e2e.d_v('d10_pac')));
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.06.log', 10, 'banco', NULL, 'log_acesso_prontuario registra quem e quando',
  format($q$SELECT e2e.d_confere(count(*) >= 1, count(*) || ' acesso(s) da médica da Internação') FROM public.log_acesso_prontuario
     WHERE paciente_id = %L AND acessado_por = %L$q$, e2e.d_v('d10_pac'), 'f5200000-0000-4000-8000-000000000015'));
SELECT e2e.d_lacuna('D10.06.so_leitura', 10, 'f5_med_int', 'Nenhuma ação de escrita na tela do prontuário encerrado', 'Só na tela (ProntuarioLeitura.tsx).');

-- ── 7. vencido ──────────────────────────────────────────────────────────────
SELECT CASE WHEN e2e.d_v('d10_pedido') IS NOT NULL THEN e2e.d_ajuste('D10.07.vence', 10, 'O pedido aprovado vence (valido_ate = agora − 1 min; pedido do bloco D)',
  format('UPDATE public.pedidos_acesso_prontuario SET valido_ate = now() - interval %L WHERE id = %L', '1 minute', e2e.d_v('d10_pedido'))) END;
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.07.abrir_vencido', 10, 'f5_med_int', '/prontuarios/:pacienteId', 'Com o pedido vencido, abrir é recusado',
  format('SELECT left(public.abrir_prontuario(%L::uuid, NULL)::text, 100)', e2e.d_v('d10_pac')), 'erro');
SELECT e2e.d_dep('d10_pedido', 'D10.01.pedir', 'D10.07.meus_pedidos', 10, 'f5_med_int', '/prontuarios', 'meus_pedidos_acesso mostra o pedido como não vigente',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.meus_pedidos_acesso(%L::uuid) x WHERE x.id = %L::uuid AND x.vigente IS FALSE), 'vigente = false')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.d_v('d10_pedido')));

-- ── 8. técnico da UBS: pedido recusado ──────────────────────────────────────
SELECT e2e.d_dep('d10_pac_ubs', 'D10.00.pac_ubs', 'D10.08.pedir_tecnico', 10, 'f5_tec_ubs', '/prontuarios (UBS)', 'Técnico da UBS pede acesso ao cadastro de Rosa na UBS',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'acompanhar curativo da consulta anterior')::text$q$, e2e.d_v('d10_pac_ubs')), 'ok', 'd10_pedido_tec');
SELECT e2e.d_dep('d10_pedido_tec', 'D10.08.pedir_tecnico', 'D10.08.recusar_sem_motivo', 10, 'f5_ges_ubs', '/auditoria (UBS)', 'Gestor da UBS recusa sem motivo (deve ser recusado)',
  format('SELECT (public.decidir_pedido_acesso(%L::uuid, false, NULL)).status', e2e.d_v('d10_pedido_tec')), 'erro:Para recusar, escreva o motivo');
SELECT e2e.d_dep('d10_pedido_tec', 'D10.08.pedir_tecnico', 'D10.08.recusar', 10, 'f5_ges_ubs', '/auditoria (UBS)', 'Gestor da UBS recusa: "sem vínculo com o cuidado"',
  format($q$SELECT (public.decidir_pedido_acesso(%L::uuid, false, 'sem vínculo com o cuidado')).status$q$, e2e.d_v('d10_pedido_tec')));
SELECT e2e.d_dep('d10_pedido_tec', 'D10.08.pedir_tecnico', 'D10.08.tecnico_ve', 10, 'f5_tec_ubs', '/prontuarios (UBS)', 'O técnico vê a recusa e o motivo em meus_pedidos_acesso',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.meus_pedidos_acesso(%L::uuid) x WHERE x.status = 'recusado' AND x.motivo_decisao = 'sem vínculo com o cuidado'), 'recusa visível com o motivo')$q$, 'f5100000-0000-4000-8000-000000000001'));

-- ── 9. gestor não pede; ninguém decide o próprio ────────────────────────────
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.09.gestor_nao_pede', 10, 'f5_ges_upa', '/prontuarios', 'Gestor tenta pedir acesso (deve ser recusado)',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'gestor pedindo acesso de teste')::text$q$, e2e.d_v('d10_pac')), 'erro:Acesso negado: seu papel');
SELECT CASE WHEN e2e.d_v('d06_pac_l') IS NOT NULL THEN e2e.d_ajuste('D10.09.pedido_do_gestor', 10, 'Pedido gravado no banco em nome do gestor do bloco D (a RPC não deixa o gestor pedir), para conferir a regra "ninguém decide o próprio"',
  format($q$INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo)
     VALUES ('fd000000-0000-4000-8000-000000000001', 'fd100000-0000-4000-8000-000000000001', %L, 'fd200000-0000-4000-8000-000000000005', 'plantonista', 'pedido próprio de teste do D10')$q$, e2e.d_v('d06_pac_l'))) END;
SELECT e2e.d_guardar('d10_pedido_ges', (SELECT id::text FROM public.pedidos_acesso_prontuario WHERE solicitante_id = 'fd200000-0000-4000-8000-000000000005' AND status = 'pendente' ORDER BY criado_em DESC LIMIT 1))
 WHERE EXISTS (SELECT 1 FROM public.pedidos_acesso_prontuario WHERE solicitante_id = 'fd200000-0000-4000-8000-000000000005' AND status = 'pendente');
SELECT e2e.d_dep('d10_pedido_ges', 'D10.09.pedido_do_gestor', 'D10.09.decidir_proprio', 10, 'd_ges', '/auditoria', 'Gestor tenta decidir o próprio pedido (deve ser recusado)',
  format('SELECT (public.decidir_pedido_acesso(%L::uuid, true, NULL)).status', e2e.d_v('d10_pedido_ges')), 'erro:Ninguém decide o próprio pedido');
SELECT CASE WHEN e2e.d_v('d10_pedido_ges') IS NOT NULL THEN e2e.d_ajuste('D10.09.cancela_pedido_do_gestor', 10, 'O pedido de teste do gestor é cancelado (não fica pendente)',
  format($q$UPDATE public.pedidos_acesso_prontuario SET status = 'cancelado' WHERE id = %L$q$, e2e.d_v('d10_pedido_ges'))) END;

-- ── 10 e 11. gestor lê direto; farmacêutico barrado ─────────────────────────
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.10.gestor_le', 10, 'f5_ges_upa', '/prontuarios/:pacienteId', 'Gestor abre o prontuário de Rosa sem pedido',
  format('SELECT left(public.abrir_prontuario(%L::uuid, NULL)::text, 120)', e2e.d_v('d10_pac')));
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.10.log_gestor', 10, 'banco', NULL, 'log_acesso_prontuario registra o gestor',
  format($q$SELECT e2e.d_confere(count(*) >= 1, count(*) || ' acesso(s) do gestor') FROM public.log_acesso_prontuario WHERE paciente_id = %L AND acessado_por = %L$q$,
    e2e.d_v('d10_pac'), 'f5200000-0000-4000-8000-000000000009'));
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.11.farm_pede', 10, 'f5_farm', '/prontuarios', 'Farmacêutico tenta pedir (deve ser recusado)',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'conferir histórico de medicação')::text$q$, e2e.d_v('d10_pac')), 'erro:Acesso negado: seu papel');
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.11.farm_abre', 10, 'f5_farm', '/prontuarios/:pacienteId', 'Farmacêutico tenta abrir (deve ser recusado)',
  format('SELECT left(public.abrir_prontuario(%L::uuid, NULL)::text, 100)', e2e.d_v('d10_pac')), 'erro');
SELECT e2e.d_lacuna('D10.11.rota', 10, 'f5_farm', 'A rota /prontuarios não aparece no menu do farmacêutico (RequireRole)', 'Só na tela.');

-- ── 12 a 16. Rosa volta: histórico encerrado para quem cuida agora ──────────
SELECT e2e.d10_episodio_upa(3, 'Dor no peito há 1 h', 'R07.4', 'laranja');
SELECT e2e.d_dep('d10_ep3', 'D10.00.ficha_3', 'D10.13.historico', 10, 'f5_med_upa', '/atendimento → HistoricoEncerrado', 'Quem cuida agora vê o resumo dos encerrados desta unidade sem pedido (sem o episódio da UBS)',
  format($q$SELECT e2e.d_confere(h::text LIKE '%%' || %L || '%%' AND h::text LIKE '%%' || %L || '%%' AND h::text NOT LIKE '%%' || %L || '%%', left(h::text, 300))
     FROM (SELECT to_jsonb(public.historico_encerrado(%L::uuid)) h) x$q$, e2e.d_v('d10_ep1'), e2e.d_v('d10_ep2'), coalesce(e2e.d_v('d10_ep_ubs'), '-'), e2e.d_v('d10_pac')));
SELECT e2e.d_dep('d10_ep3', 'D10.00.ficha_3', 'D10.14.abrir_historico', 10, 'f5_med_upa', 'HistoricoEncerrado', 'Abre o detalhe com motivo "comparar ECG com o episódio anterior" (12 h)',
  format($q$SELECT public.abrir_historico_encerrado(%L::uuid, 'comparar ECG com o episódio anterior')::text$q$, e2e.d_v('d10_pac')));
SELECT e2e.d_dep('d10_ep3', 'D10.00.ficha_3', 'D10.14.registro', 10, 'banco', NULL, 'private.acessos_historico com quem, motivo e validade de 12 h',
  format($q$SELECT e2e.d_confere(count(*) >= 1, count(*) || ' acesso(s) com motivo') FROM private.acessos_historico WHERE paciente_id = %L AND perfil_id = %L AND motivo LIKE 'comparar ECG%%'$q$,
    e2e.d_v('d10_pac'), 'f5200000-0000-4000-8000-000000000008'));
SELECT e2e.d_dep('d10_ep3', 'D10.00.ficha_3', 'D10.15.motivo_curto', 10, 'f5_med_upa', 'HistoricoEncerrado', 'Motivo de 6 letras (deve ser recusado)',
  format($q$SELECT public.abrir_historico_encerrado(%L::uuid, 'ver ecg')::text$q$, e2e.d_v('d10_pac')), 'erro:Escreva o motivo');
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.16.nao_cuida', 10, 'f5_med_int', '/atendimento', 'Quem não cuida de Rosa agora não lê o histórico (deve ser recusado)',
  format('SELECT left(to_jsonb(public.historico_encerrado(%L::uuid))::text, 100)', e2e.d_v('d10_pac')), 'erro');

-- ── 17. cancelar o próprio pedido pendente ──────────────────────────────────
SELECT e2e.d_dep('d10_pac', 'D10.00.ficha_1', 'D10.17.pedir_de_novo', 10, 'f5_med_int', '/prontuarios', 'Novo pedido da médica da Internação (o anterior venceu)',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'segundo pedido de teste para cancelar')::text$q$, e2e.d_v('d10_pac')), 'ok', 'd10_pedido2');
SELECT e2e.d_dep('d10_pedido2', 'D10.17.pedir_de_novo', 'D10.17.cancelar', 10, 'f5_med_int', '/prontuarios', 'Cancela o próprio pedido pendente',
  format('SELECT public.cancelar_pedido_acesso(%L::uuid)::text', e2e.d_v('d10_pedido2')));
SELECT e2e.d_dep('d10_pedido2', 'D10.17.pedir_de_novo', 'D10.17.cancelado', 10, 'banco', NULL, 'status cancelado',
  format($q$SELECT e2e.d_confere(status = 'cancelado', 'status ' || status) FROM public.pedidos_acesso_prontuario WHERE id = %L$q$, e2e.d_v('d10_pedido2')));

-- ── fim: o atendimento novo de Rosa é encerrado (não fica na porta da UPA F5)
SELECT e2e.d_dep('d10_ep3', 'D10.00.ficha_3', 'D10.99.alta_3', 10, 'f5_med_upa', '/atendimento → AbaDesfecho', 'Fim do cenário: alta do 3º atendimento',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d10_ep3')));
SELECT e2e.d_lacuna('D10.L1.prazo_gestor', 10, 'f5_ges_upa', 'Prazo para o gestor decidir e expiração do pedido pendente', 'Lacuna (MAPA): não existe; um pendente fica pendente até alguém agir.');
SELECT e2e.d_lacuna('D10.L2.telemedicina', 10, 'f5_tele', 'Pedido feito pela telemedicina', 'Não exercitado nesta rodada (a conta telemedicina.f5 existe desde o 46).');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D10.%' AND em >= now() GROUP BY 1;
