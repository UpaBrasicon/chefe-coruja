-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — etapa 11 (gestor) e os itens transversais:
-- números do painel × banco, histórico com justificativa, auditoria,
-- concorrência, evasão depois do atendimento, alta a pedido com termo,
-- recusa de tratamento, notificações, carga (60+ pacientes, 500 eventos).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── 11. painel do gestor × banco ────────────────────────────────────────────
SELECT e2e.passo('11.panorama', NULL, 'gestor', '/gestao', 'Panorama do gestor carrega', $q$SELECT left(public.panorama_gestor('e1100000-0000-4000-8000-000000000001')::text, 400)$q$, 'ok', 'panorama');
SELECT e2e.passo('11.mapa_leitos', NULL, 'gestor', '/unidade', 'Mapa de leitos com pacientes por plantonista', $q$SELECT left(public.mapa_leitos_gestor('e1100000-0000-4000-8000-000000000001')::text, 400)$q$);
SELECT e2e.passo('11.porta_agora', NULL, 'gestor', '/gestao/porta', 'Porta agora (tempos e gargalo)', $q$SELECT left(public.porta_agora('e1100000-0000-4000-8000-000000000001')::text, 400)$q$, 'ok', 'porta');
SELECT e2e.passo('11.ocupacao', NULL, 'gestor', '/indicadores', 'Ocupação por setor', $q$SELECT string_agg(x::text, ' ') FROM public.ocupacao_setores('e1100000-0000-4000-8000-000000000001') x$q$, 'ok', 'ocupacao');
SELECT e2e.passo('11.espera_medico', NULL, 'gestor', '/indicadores', 'Tempo porta-médico (indicador)',
  $q$SELECT left(public.indicador_espera_medico('e1100000-0000-4000-8000-000000000001', current_date, current_date, NULL, NULL, NULL, NULL, NULL)::text, 400)$q$, 'ok', 'espera_medico');
SELECT e2e.passo('11.evasao', NULL, 'gestor', '/indicadores', 'Indicador de evasão',
  $q$SELECT left(public.indicador_evasao('e1100000-0000-4000-8000-000000000001', current_date, current_date, NULL, NULL, NULL, NULL, NULL)::text, 400)$q$, 'ok', 'evasao');
SELECT e2e.passo('11.regulacoes_abertas', NULL, 'gestor', '/regulacao', 'Regulações em aberto (painel de prazos da origem)',
  $q$SELECT (public.regulacao_sla_painel('e1100000-0000-4000-8000-000000000001') -> 'resumo')::text$q$, 'ok', 'reg_resumo');
SELECT e2e.lacuna('11.obitos_painel', NULL, 'gestor', 'Óbitos no painel do gestor', 'Não há indicador nem contagem de óbitos no painel (/gestao) nem em Indicadores.');
-- conferência direta no banco (como postgres)
SELECT e2e.ajuste('11.banco_ocupacao', 'Conferência no banco: leitos ocupados na UPA E2E',
  $q$INSERT INTO e2e.vars SELECT 'banco_ocupados', count(*)::text FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.unidade_id = 'e1100000-0000-4000-8000-000000000001' AND l.status = 'ocupado' ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor$q$);
SELECT e2e.ajuste('11.banco_internados', 'Conferência no banco: internações abertas na UPA E2E',
  $q$INSERT INTO e2e.vars SELECT 'banco_internados', count(*)::text FROM public.internacoes WHERE unidade_id = 'e1100000-0000-4000-8000-000000000001' AND data_alta IS NULL ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor$q$);

-- histórico do paciente com alta: exige justificativa e fica na auditoria
SELECT e2e.passo('11.historico_sem_motivo', 14, 'gestor', '/prontuarios', 'Abrir histórico encerrado sem justificativa (deve recusar)',
  format('SELECT public.abrir_historico_encerrado(%L::uuid, %L)::text', e2e.u('pac14'), 'curto'), 'erro');
-- Regra da Fase 3 (commit 472be01): só quem cuida do paciente agora abre o histórico encerrado com motivo; o gestor faz o pedido de acesso.
SELECT e2e.passo('11.historico_com_motivo', 14, 'gestor', '/prontuarios', 'Gestor tenta abrir histórico encerrado com justificativa (regra: o gestor faz o pedido)',
  format('SELECT public.abrir_historico_encerrado(%L::uuid, %L)::text', e2e.u('pac14'), 'Auditoria interna do teste de ponta a ponta'), 'erro:Só quem cuida do paciente agora');
SELECT e2e.passo('11.historico_pedido', 14, 'gestor', '/prontuarios', 'Gestor pede acesso ao histórico com justificativa',
  format('SELECT public.pedir_acesso_prontuario(%L::uuid, %L)::text', e2e.u('pac14'), 'Auditoria interna do teste de ponta a ponta (gestor).'), 'ok', 'pedido14g');
SELECT e2e.passo('11.historico_auditado', 14, 'gestor', '/auditoria', 'O pedido aparece na lista de pedidos de acesso da unidade',
  format($q$SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar('sem pedido') END FROM public.meus_pedidos_acesso(%L) x$q$,
         'e1100000-0000-4000-8000-000000000001'));
SELECT e2e.passo('11.gestor_prescreve', 5, 'gestor', '/plantao', 'Gestor tenta prescrever (deve ser negado)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('pac5'),
         jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.med('Paracetamol'), 'dose', '750 mg', 'via', 'oral', 'posologia', 'dose única')), 'erro');
SELECT e2e.passo('11.gestor_altera_prescricao', 4, 'gestor', '/plantao', 'Gestor tenta alterar item de prescrição (deve ser negado)',
  format('SELECT public.alterar_item_prescricao(%L::uuid, %L::jsonb, %L)::text', e2e.item(4, 'Ceftriaxona'), '{"dose":"1 g"}', 'teste de permissão'), 'erro');

-- ── auditoria / LGPD ────────────────────────────────────────────────────────
SELECT e2e.passo('A.impressao', 14, 'plantonista', '/plantao/porta', 'Impressão registra protocolo e acesso',
  format('SELECT protocolo FROM public.registrar_impressao(%L::uuid, %L)', e2e.u('pac14'), 'receita'));
SELECT e2e.ajuste('A.trilha', 'Conferência: ações críticas do teste na auditoria (contagem por ação)',
  $q$INSERT INTO e2e.vars SELECT 'auditoria_acoes', string_agg(acao || ':' || n, ' ' ORDER BY acao) FROM (SELECT acao, count(*) n FROM public.log_auditoria WHERE unidade_id IN (SELECT id FROM public.unidades WHERE organizacao_id = 'e1000000-0000-4000-8000-000000000001') GROUP BY acao) x ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor$q$);
SELECT e2e.ajuste('A.acessos', 'Conferência: registros de acesso ao prontuário por tipo',
  $q$INSERT INTO e2e.vars SELECT 'acessos_tipos', string_agg(tipo_acesso || ':' || n, ' ') FROM (SELECT tipo_acesso, count(*) n FROM public.log_acesso_prontuario WHERE organizacao_id = 'e1000000-0000-4000-8000-000000000001' GROUP BY 1) x ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor$q$);

-- ── concorrência ────────────────────────────────────────────────────────────
SELECT e2e.passo('K.reserva_1', NULL, 'enfermeiro', '/unidade', 'Enfermeira reserva o leito OA-05', format('SELECT public.reservar_leito(%L::uuid, 2, NULL, %L)::text', e2e.leito('OA-05'), 'Paciente da sala vermelha'));
SELECT e2e.passo('K.reserva_dupla', NULL, 'plantonista2', '/unidade', 'Médico tenta reservar o mesmo leito (deve ser recusado)', format('SELECT public.reservar_leito(%L::uuid, 2, NULL, %L)::text', e2e.leito('OA-05'), 'Outro paciente'), 'erro');
SELECT e2e.passo('K.alterar_1', 10, 'plantonista2', '/internacao', 'Médico 1 altera a ceftriaxona', format('SELECT public.alterar_item_prescricao(%L::uuid, %L::jsonb, %L)::text', e2e.item(10, 'Ceftriaxona'), '{"dose":"1 g"}', 'Ajuste renal'), 'ok', 'item10_antigo');
SELECT e2e.passo('K.alterar_versao_antiga', 10, 'plantonista2', '/internacao', 'Segunda alteração sobre a versão já substituída (deve ser recusada)',
  format('SELECT public.alterar_item_prescricao((SELECT substitui_item_id FROM public.prescricao_itens WHERE id = %L::uuid), %L::jsonb, %L)::text', e2e.v('item10_antigo'), '{"dose":"3 g"}', 'Edição concorrente'), 'erro');

-- ── evasão depois do atendimento, alta a pedido com termo, recusa ───────────
SELECT e2e.passo('E.ficha16', 16, 'recepcao', '/recepcao', 'Ficha #16 (evadirá depois do atendimento)',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Dor no tornozelo', '{"nome":"E2E Evasão Depois","data_nascimento":"1992-02-02","sexo":"M"}'), 'ok', 'ep16');
SELECT e2e.passo('E.ficha17', 17, 'recepcao', '/recepcao', 'Ficha #17 (alta a pedido)',
  format('SELECT (public.registrar_ficha(%L, %L, NULL, %L::jsonb) ->> ''episodio_id'')', 'e1200000-0000-4000-8000-000000000001', 'Dor torácica atípica', '{"nome":"E2E Alta a Pedido","data_nascimento":"1975-04-04","sexo":"F"}'), 'ok', 'ep17');
DO $$
DECLARE n int; v_flux uuid := (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Dor torácica' AND publico = 'adulto');
BEGIN
  FOREACH n IN ARRAY ARRAY[16, 17] LOOP
    PERFORM e2e.guardar('pac' || n, (SELECT paciente_id::text FROM public.episodios WHERE id = e2e.u('ep' || n)));
    PERFORM e2e.passo('E.classificar', n, 'enfermeiro', '/triagem', 'Classifica verde',
      format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text', e2e.u('ep' || n), 'verde',
             '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.5,"saturacao-o2":98,"escala-dor":3,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
             v_flux, e2e.disc('e1100000-0000-4000-8000-000000000001', v_flux, 'verde')));
    PERFORM e2e.passo('E.iniciar', n, 'plantonista', '/plantao/porta', 'Inicia atendimento', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('ep' || n)));
    PERFORM e2e.passo('E.soap', n, 'plantonista', '/plantao/porta', 'SOAP', format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', e2e.u('ep' || n),
      'Queixa de teste E2E.', 'Exame de teste E2E.', 'Hipótese de teste E2E.', 'Plano de teste E2E.', CASE n WHEN 16 THEN 'S93.4' ELSE 'R07.4' END));
  END LOOP;
END $$;
SELECT e2e.passo('E.evasao_atendimento', 16, 'plantonista', '/plantao/porta', 'Evasão depois de iniciado o atendimento',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L)::text', e2e.u('ep16'), 'evasao', 'Saiu sem avisar enquanto aguardava o raio-X (teste E2E).'));
SELECT e2e.passo('E.termo_recusa', 17, 'plantonista', '/plantao/porta', 'Termo de recusa de tratamento / alta a pedido',
  format('SELECT public.emitir_termo_consentimento(%L::uuid, %L::jsonb, %L::uuid)::text', e2e.u('pac17'),
         '{"procedimento":"Permanência em observação para curva de troponina","texto":"A paciente foi informada dos riscos de sair antes do fim da investigação e decidiu sair (teste E2E).","assinante":"paciente"}', e2e.u('ep17')));
SELECT e2e.passo('E.alta_a_pedido', 17, 'plantonista', '/plantao/porta', 'Alta a pedido',
  format('SELECT public.registrar_desfecho(%L::uuid, %L, %L, %L::jsonb)::text', e2e.u('ep17'), 'alta_a_pedido', 'Paciente decide sair contra orientação médica (teste E2E).', '{"cid_alta":"R07.4"}'));

-- ── notificações (sem e-mail para paciente) ─────────────────────────────────
SELECT e2e.ajuste('N.avisos', 'Conferência: avisos gerados no teste, por tipo',
  $q$INSERT INTO e2e.vars SELECT 'avisos_tipos', string_agg(t || ':' || n, ' ' ORDER BY t) FROM (SELECT regexp_replace(tipo, '_[0-9a-f-]+$', '') t, count(*) n FROM public.notificacoes_plantonista WHERE perfil_id::text LIKE 'e2000000%' GROUP BY 1) x ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor$q$);
SELECT e2e.passo('N.aviso_negativa', 9, 'plantonista2', '/notificacoes', 'Origem recebe aviso da regulação negada',
  $q$SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar('sem aviso') END FROM public.notificacoes_plantonista WHERE perfil_id = private.meu_perfil_id() AND tipo LIKE 'reg_negada%'$q$);
SELECT e2e.passo('N.aviso_farmacia_devolveu', 13, 'plantonista', '/notificacoes', 'Médico que prescreveu recebe aviso do item devolvido pela farmácia (correção da tarefa 7)',
  $q$SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar('sem aviso ao médico do item devolvido') END FROM public.notificacoes_plantonista WHERE perfil_id = private.meu_perfil_id() AND tipo NOT LIKE 'reg_%'$q$);
SELECT e2e.passo('N.aviso_leito_liberado', 7, 'nir', '/notificacoes', 'Aviso de leito liberado (higienização concluída)',
  $q$SELECT CASE WHEN count(*) > 0 THEN count(*)::text ELSE e2e.falhar('sem aviso de leito liberado') END FROM public.notificacoes_plantonista WHERE perfil_id = private.meu_perfil_id() AND tipo ILIKE '%leito%'$q$);

SELECT 'gestor e transversais' AS etapa, situacao, count(*) FROM e2e.resultados WHERE passo ~ '^(11|A|K|E|N)\.' GROUP BY situacao ORDER BY situacao;
