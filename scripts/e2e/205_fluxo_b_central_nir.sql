-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 5: a central vê os pedidos, pergunta pela evolução e
-- pede exames pela conversa; o NIR da UPA vê o aviso, avisa o médico (pendência
-- nova do NIR) e atualiza a evolução do pedido; o médico responde e atualiza;
-- o regulador decide (autoriza, devolve, nega) com motivo.
-- "outro": passo desfeito em que o pedido passa a ser de OUTRA pessoa, para
-- provar o que o papel pode quando não é o solicitante (o login de teste pediu tudo).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;
-- apoio só desta transação (some no fim): roda um SQL como o papel do passo e
-- devolve a leitura de um segundo SQL feita como dono (o que a tela não mostra).
-- Dois comandos, porque função STABLE não enxerga o que o mesmo comando gravou.
CREATE FUNCTION e2e.fb_ler(p_sql text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE r text; BEGIN EXECUTE p_sql INTO r; RETURN r; END $$;
CREATE FUNCTION e2e.fb_seq(p_sql text, p_ler text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE p_sql; RETURN e2e.fb_ler(p_ler); END $$;
GRANT EXECUTE ON FUNCTION e2e.fb_ler(text), e2e.fb_seq(text, text) TO authenticated;
CREATE TEMP TABLE _outro ON COMMIT DROP AS
SELECT c.n, format('UPDATE public.regulacao_solicitacoes SET solicitante_id = (SELECT id FROM public.perfis WHERE id <> e2e.fb_login() ORDER BY id LIMIT 1), medico_assistente_id = NULL WHERE id = %L', e2e.fbu(c.n, 'reg')) AS sql
  FROM e2e.fb_coorte c;

-- ── central: fila e leitura ─────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.8.fila', 'reg', 'Regulador vê os 10 pedidos na fila da central',
  format($q$SELECT e2e.fb_confere(count(*) = 10, count(*) || ' dos 10 pedidos B na fila') FROM unnest(%L::text[]) i, (SELECT public.regulacao_fila(%L::uuid, '{}'::jsonb)::text l) z WHERE z.l LIKE '%%' || i || '%%'$q$,
    (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c), e2e.fb_central()));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.8.fila_isolamento', 'reg', 'Filtro "com isolamento": só os 5 pedidos com isolamento (B02, B03, B04, B08, B09)',
  format($q$SELECT e2e.fb_confere(count(*) FILTER (WHERE z.l LIKE '%%' || i.id || '%%') = 5 AND bool_and((z.l LIKE '%%' || i.id || '%%') = i.iso),
      count(*) FILTER (WHERE z.l LIKE '%%' || i.id || '%%') || ' pedidos B no filtro')
    FROM jsonb_to_recordset(%L::jsonb) i(id text, iso boolean), (SELECT public.regulacao_fila(%L::uuid, '{"isolamento":true}'::jsonb)::text l) z$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', e2e.fbv(c.n, 'reg'), 'iso', c.iso_tipo IS NOT NULL)) FROM e2e.fb_coorte c), e2e.fb_central()));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.8.fila_extras', 'reg', 'Extras da fila (situação e agente do isolamento, município da origem, nº de evoluções)',
  format($q$SELECT e2e.fb_confere(x::text LIKE '%%SARS-CoV-2%%' AND x::text LIKE '%%Neutropenia febril%%', left(x::text, 300)) FROM (SELECT public.regulacao_fila_extras(%L::uuid) x) z$q$, e2e.fb_central()));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.8.fila_por_quem_nao_e_da_central', x.papel, 'Perfil da UPA (' || x.papel || ') tenta ler a fila da central: deve recusar',
  format($q$SELECT left(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text, 80)$q$, e2e.fb_central()), 'erro:Acesso negado')
  FROM (VALUES ('med'), ('nir'), ('ges'), ('enf')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.8.vagas_compativeis', 'reg', 'Vagas compatíveis: o Hospital de Referência com isolamento livre e pressão negativa livre',
  format($q$SELECT e2e.fb_confere(x::text LIKE '%%Hospital de Referência%%', left(x::text, 500)) FROM (SELECT public.regulacao_vagas_compativeis(%L::uuid) x) z$q$, e2e.fb_central()));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.8.mapa_vagas', 'reg', 'Mapa de vagas da central (registro)',
  format($q$SELECT left(public.regulacao_mapa_vagas(%L::uuid)::text, 500)$q$, e2e.fb_central()), 'registrar');

-- ── quem decide é só o regulador da central ─────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.8.' || x.passo, x.papel, x.descricao, format(x.sql, e2e.fbu(1, 'reg')), 'erro:Quem decide é o médico regulador da central', NULL, true, 'reg')
  FROM (VALUES
    (1, 'medico_nao_autoriza', 'med', 'Médico da origem tenta autorizar o próprio pedido: deve recusar', $q$SELECT public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital de fora', NULL, NULL, NULL)::text$q$),
    (2, 'nir_nao_nega', 'nir', 'NIR tenta negar o pedido: deve recusar', $q$SELECT public.regulacao_negar(%L::uuid, 'sem_oferta', 'Teste de permissão do NIR')::text$q$),
    (3, 'gestor_upa_nao_devolve', 'ges', 'Gestor da UPA tenta devolver o pedido: deve recusar', $q$SELECT public.regulacao_devolver(%L::uuid, 'Teste de permissão do gestor')::text$q$),
    (4, 'medico_nao_pergunta', 'med', 'Médico da origem tenta abrir pendência da central: deve recusar', $q$SELECT public.regulacao_pendencia(%L::uuid, 'Teste de permissão do médico')::text$q$),
    (5, 'destino_nao_decide', 'dmed', 'Médico do hospital destino tenta autorizar: deve recusar', $q$SELECT public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital de fora', NULL, NULL, NULL)::text$q$)
  ) x(o, passo, papel, descricao, sql) ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.8.medico_nao_assume', 'med', 'Médico da origem tenta assumir o pedido na central: deve recusar',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 100)', e2e.fbu(1, 'reg')), 'erro', NULL, true, 'reg');

-- ── central: assume, prioriza, conversa e pendência ─────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.8.assumir', 'reg', 'Regulador assume o pedido',
  format($q$SELECT (public.regulacao_assumir(%L::uuid) ->> 'status')$q$, e2e.fbu(c.n, 'reg')), 'ok', 'assumido', false, 'reg')
  FROM e2e.fb_coorte c WHERE c.n <> 10 ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.8.priorizar', 'reg', 'Regulador dá prioridade de emergência com motivo (janela terapêutica do AVC)',
  format($q$SELECT left(public.regulacao_priorizar(%L::uuid, 'emergencia', 'AVC dentro da janela: prioridade máxima (teste de fluxo)')::text, 120)$q$, e2e.fbu(7, 'reg')), 'ok', NULL, false, 'assumido');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.8.priorizar_sem_motivo', 'reg', 'Prioridade do regulador sem motivo: deve recusar',
  format($q$SELECT left(public.regulacao_priorizar(%L::uuid, 'eletiva', '')::text, 120)$q$, e2e.fbu(7, 'reg')), 'erro', NULL, false, 'assumido');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.8.conversa_pergunta', 'reg', 'Regulador pergunta pela evolução do quadro clínico na conversa',
  format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Como evoluiu o quadro clínico nas últimas horas? Sinais vitais atuais e resposta ao tratamento, por favor.', 'pergunta')::text$q$, e2e.fbu(c.n, 'reg')),
  'ok', 'msg_pergunta', false, 'assumido')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 6, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.8.conversa_pedido_exames', 'reg', 'Regulador pede exames pela conversa',
  format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, %L, 'pedido')::text$q$, e2e.fbu(c.n, 'reg'),
    CASE c.n WHEN 1 THEN 'Peço troponina seriada e o ECG de controle anexados ao pedido.' WHEN 6 THEN 'Peço proteinúria, plaquetas e TGO/TGP anexados ao pedido.'
             ELSE 'Peço gasometria arterial e RX de tórax de controle anexados ao pedido.' END),
  'ok', 'msg_exames', false, 'assumido')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 6, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.8.pendencia', 'reg', 'Regulador abre pendência formal: evolução do quadro e exames de controle',
  format($q$SELECT (public.regulacao_pendencia(%L::uuid, 'Qual a evolução do quadro clínico desde o pedido e o resultado dos exames de controle?') ->> 'status')$q$, e2e.fbu(c.n, 'reg')),
  'ok', 'pendencia', false, 'assumido')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 6, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.8.pendencia_repetida', 'reg', 'Ação repetida: segunda pendência com a primeira sem resposta: deve recusar',
  format($q$SELECT public.regulacao_pendencia(%L::uuid, 'Segunda pergunta enquanto a primeira espera')::text$q$, e2e.fbu(2, 'reg')), 'erro:Já há uma pergunta', NULL, false, 'pendencia');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.8.aviso_na_origem', 'banco', 'Aviso da pendência da central chegou ao login na UPA, com o nº do pedido (o da conversa não chega: quem escreveu é a mesma pessoa, e ninguém avisa a si mesmo)',
  format($q$SELECT e2e.fb_confere(count(*) FILTER (WHERE n.tipo = 'reg_pendencia_' || %1$L) = 1 AND count(*) FILTER (WHERE n.tipo = 'reg_conversa_' || %1$L) = 0,
      string_agg(n.tipo || ' data ' || n.data || ' lida ' || (n.lida_em IS NOT NULL), '; '))
    FROM public.notificacoes_plantonista n WHERE n.perfil_id = e2e.fb_login() AND n.unidade_id = e2e.fb_upa() AND n.tipo IN ('reg_pendencia_' || %1$L, 'reg_conversa_' || %1$L)$q$, e2e.fbv(c.n, 'num')),
  'ok', NULL, false, 'pendencia')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 6, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.8.aviso_conversa_outra_pessoa', 'reg', 'Pedido de OUTRO médico: a mensagem do regulador gera o aviso reg_conversa para ele na origem, sem o nome do paciente (desfeito)',
  format($q$SELECT e2e.fb_seq(%L, %L)$q$,
    format($x$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Favor informar a evolução do quadro (teste de fluxo).', 'pergunta')$x$, e2e.fbu(1, 'reg')),
    format($x$SELECT e2e.fb_confere(count(*) = 1 AND NOT bool_or(n.mensagem ILIKE '%%Teste Fluxo%%'), count(*) || ' aviso: ' || coalesce(min(n.mensagem), '-'))
      FROM public.notificacoes_plantonista n WHERE n.perfil_id <> e2e.fb_login() AND n.unidade_id = e2e.fb_upa() AND n.tipo = 'reg_conversa_' || %L$x$, e2e.fbv(1, 'num'))),
  'ok', NULL, true, 'assumido', (SELECT sql FROM _outro WHERE n = 1));
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.8.aviso_sem_nome', 'banco', 'Os avisos da regulação não levam o nome do paciente',
  format($q$SELECT e2e.fb_confere(NOT bool_or(n.mensagem ILIKE '%%Teste Fluxo%%'), count(*) || ' avisos reg_* de hoje, nenhum com nome')
    FROM public.notificacoes_plantonista n WHERE n.perfil_id = e2e.fb_login() AND n.tipo LIKE 'reg\_%%' AND n.created_at > now() - interval '3 hours'$q$));

-- ── NIR da UPA ──────────────────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.9.nir_painel', 'nir', 'NIR: itens parados do painel antigo (nir_pendencias só lista o que passou do prazo; registro)',
  format($q$SELECT 'resumo ' || (x -> 'resumo')::text || '; regulação: ' || coalesce(left((SELECT string_agg(i ->> 'titulo', ' | ') FROM jsonb_array_elements(x -> 'itens') i WHERE i ->> 'grupo' = 'regulacao'), 400), 'nada')
    FROM (SELECT public.nir_pendencias(%L::uuid) x) z$q$, e2e.fb_upa()), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.9.nir_lista', 'nir', 'NIR vê na lista da unidade os 3 pedidos com pergunta da central esperando resposta (B02, B06, B09)',
  format($q$SELECT e2e.fb_confere(count(*) = 3, count(*) || ' pedidos B em pendência para o NIR')
    FROM jsonb_array_elements(public.regulacao_lista(%L::uuid)) s WHERE s ->> 'status' = 'pendencia' AND s ->> 'id' = ANY (%L::text[])$q$, e2e.fb_upa(),
    (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c)));
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.9.nir_painel_outro_perfil', x.papel, 'Perfil que não é NIR nem gestor (' || x.papel || ') tenta abrir o painel do NIR: deve recusar',
  format('SELECT left(public.nir_pendencias(%L::uuid)::text, 80)', e2e.fb_upa()), 'erro:Acesso negado')
  FROM (VALUES ('med'), ('enf'), ('rec')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.9.nir_mapa_leitos', 'nir', 'NIR vê o mapa de leitos da unidade (só leitura), com os pacientes B e o isolamento',
  format($q$SELECT e2e.fb_confere(x::text LIKE '%%CM-2%%' AND x::text LIKE '%%SV-1%%', left(x::text, 300)) FROM (SELECT public.nir_mapa_leitos(%L::uuid) x) z$q$, e2e.fb_upa()));
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.9.nir_avisa_medico_mesma_pessoa', 'nir', 'NIR avisa o médico, mas o único médico da unidade é a própria pessoa: recusa (não avisa a si mesmo)',
  format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'evolucao', 'A central pede a evolução do quadro e a gasometria de controle', 'alta', NULL, 'medico')::text$q$, e2e.fbu(2, 'reg')),
  'erro:Não há médico da unidade para avisar', NULL, false, 'pendencia');
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.9.nir_avisa_medico', 'nir', 'NIR avisa o médico (outra pessoa médica na unidade; desfeito): pendência "médico avisado" e aviso sem o nome do paciente',
  format($q$SELECT e2e.fb_seq(%L, %L)$q$,
    format($x$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'evolucao', 'A central pede a evolução do quadro e a gasometria de controle', 'alta', NULL, 'medico')$x$, e2e.fbu(2, 'reg')),
    format($x$SELECT e2e.fb_confere(p.status = 'medico_avisado' AND p.avisos = 1 AND p.criada_por = e2e.fb_login() AND cardinality(p.responsaveis) = 1
        AND (SELECT count(*) = 1 AND NOT bool_or(n.mensagem ILIKE '%%Teste Fluxo%%') FROM public.notificacoes_plantonista n WHERE n.perfil_id = ANY (p.responsaveis) AND n.tipo = 'reg_nirmed_' || %L),
        p.status || '; aviso: ' || (SELECT min(n.mensagem) FROM public.notificacoes_plantonista n WHERE n.perfil_id = ANY (p.responsaveis) AND n.tipo = 'reg_nirmed_' || %L))
      FROM public.regulacao_pendencias_unidade p WHERE p.solicitacao_id = %L AND p.dono = 'medico'$x$, e2e.fbv(2, 'num'), e2e.fbv(2, 'num'), e2e.fbu(2, 'reg'))),
  'ok', NULL, true, 'pendencia',
  format($q$INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo) SELECT id, %L, 'plantonista', true FROM public.perfis WHERE id <> e2e.fb_login() ORDER BY id LIMIT 1$q$, e2e.fb_upa()));
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.9.nir_pendencia_propria', 'nir', 'NIR registra pendência da própria equipe (dono NIR, motivo evolução)',
  format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'evolucao', 'Cobrar do plantão a evolução pedida pela central (teste de fluxo)', %L, NULL, 'nir')::text$q$, e2e.fbu(c.n, 'reg'), CASE WHEN c.n = 2 THEN 'alta' ELSE 'normal' END),
  'ok', 'pend_nir', false, 'pendencia')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 6, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.9.nir_pendencia_exame', 'nir', 'NIR registra pendência de exame (dono NIR)',
  format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'exame', 'Gasometria e RX de controle pedidos pela central: conferir coleta', 'normal', NULL, 'nir')::text$q$, e2e.fbu(9, 'reg')),
  'ok', 'pend_nir_exame', false, 'pendencia');
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.9.pendencia_unidade_' || x.papel, x.papel, 'Perfil sem acesso (' || x.papel || ') tenta criar pendência da unidade: deve recusar',
  format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'outro', 'Teste de permissão', 'normal', NULL, 'nir')::text$q$, e2e.fbu(2, 'reg')), 'erro', NULL, true, 'pendencia')
  FROM (VALUES ('enf'), ('rec'), ('reg')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.9.nir_pendencia_curta', 'nir', 'Pendência com 3 letras: deve recusar',
  format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'outro', 'abc', 'normal', NULL, 'nir')::text$q$, e2e.fbu(2, 'reg')), 'erro:mínimo de 5 letras', NULL, false, 'pendencia');

-- o que o NIR pode e não pode quando o pedido é de outro médico (desfeito)
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.9.nir_outro_' || x.passo, 'nir', x.descricao, format(x.sql, e2e.fbu(2, 'reg')), x.esperado, NULL, true, 'pendencia', (SELECT sql FROM _outro WHERE n = 2))
  FROM (VALUES
    (1, 'evolucao', 'NIR atualiza a evolução do pedido de outro médico (decisão do RT): aceita, papel "nir"',
        $q$SELECT e2e.fb_seq($x$SELECT public.regulacao_atualizar_evolucao(%1$L::uuid, 'NIR: paciente estável no leito, aguardando gasometria (teste de fluxo)', 'SatO2 92%% com cateter')$x$,
             $x$SELECT e2e.fb_confere(ev.autor_papel = 'nir' AND ev.autor_id = e2e.fb_login(), 'papel ' || ev.autor_papel) FROM public.regulacao_evolucoes ev WHERE ev.solicitacao_id = %1$L ORDER BY ev.em DESC LIMIT 1$x$)$q$, 'ok'),
    (2, 'responde', 'NIR responde a pendência da central (permitido pela função)', $q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta do NIR: evolução atualizada no pedido')::text || 'respondida'$q$, 'ok'),
    (3, 'cancela', 'NIR tenta cancelar o pedido: deve recusar', $q$SELECT public.regulacao_cancelar(%L::uuid, 'Cancelamento pelo NIR (teste)')::text$q$, 'erro:Cancela quem solicitou ou o gestor'),
    (4, 'conversa', 'NIR escreve na conversa (permitido)', $q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'NIR: o plantão foi avisado e responde em seguida.', 'mensagem')::text$q$, 'ok')
  ) x(o, passo, descricao, sql, esperado) ORDER BY x.o;
-- o que OUTRO médico de plantão (não o solicitante) pode no pedido (desfeito)
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.9.outro_medico_' || x.passo, 'med', x.descricao, format(x.sql, e2e.fbu(2, 'reg')), 'registrar', NULL, true, 'pendencia', (SELECT sql FROM _outro WHERE n = 2))
  FROM (VALUES
    (1, 'evolucao', 'Outro médico de plantão (não pediu) atualiza a evolução (registro)', $q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Médico do plantão seguinte: mantém quadro (teste de fluxo)', NULL)::text$q$),
    (2, 'responde', 'Outro médico de plantão responde a pendência da central (registro)', $q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta do médico do plantão seguinte')::text || 'respondida'$q$),
    (3, 'conversa', 'Outro médico de plantão escreve na conversa (registro)', $q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Médico do plantão seguinte: respondo já.', 'mensagem')::text$q$),
    (4, 'cancela', 'Outro médico de plantão cancela o pedido (registro)', $q$SELECT public.regulacao_cancelar(%L::uuid, 'Cancelamento pelo médico do plantão seguinte (teste)')::text || 'cancelada'$q$)
  ) x(o, passo, descricao, sql) ORDER BY x.o;

-- NIR atualiza a evolução do pedido (B06 e B10); as pendências de evolução fecham sozinhas
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.9.nir_evolucao', 'nir', 'NIR atualiza a evolução do pedido de regulação (autor = login)',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, %L, %L)::text$q$, e2e.fbu(c.n, 'reg'),
    'NIR: ' || CASE c.n WHEN 6 THEN 'gestante segue com PA elevada, em sulfato conforme a prescrição do plantão, sem contrações' ELSE 'paciente segue hipotensa, em reposição conforme a prescrição do plantão' END || ' (teste de fluxo, informado pelo plantão).',
    CASE c.n WHEN 6 THEN 'PA 162x108, FC 90, SatO2 98%' ELSE 'PA 90x54, FC 118, SatO2 94%' END), 'ok', 'evol_nir', false, 'reg')
  FROM e2e.fb_coorte c WHERE c.n IN (6, 10) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(6, 'FB.9.nir_evolucao_banco', 'banco', 'Evolução gravada com autor = login; a pendência de evolução do NIR ficou resolvida sozinha, com evento no histórico',
  format($q$SELECT e2e.fb_confere((SELECT count(*) = 1 AND bool_and(ev.autor_id = e2e.fb_login()) FROM public.regulacao_evolucoes ev WHERE ev.solicitacao_id = %1$L)
      AND (SELECT p.status = 'resolvida' AND p.resolvida_por = e2e.fb_login() FROM public.regulacao_pendencias_unidade p WHERE p.id = %2$L)
      AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = %1$L AND e.evento = 'pendencia_unidade_resolvida'),
      'papel gravado na evolução: ' || (SELECT string_agg(ev.autor_papel, ',') FROM public.regulacao_evolucoes ev WHERE ev.solicitacao_id = %1$L))$q$, e2e.fbu(6, 'reg'), e2e.fbu(6, 'pend_nir')),
  'ok', NULL, false, 'evol_nir');
INSERT INTO _r (txt)
SELECT e2e.fb(6, 'FB.9.pendencia_ja_resolvida', 'nir', 'Ação repetida: resolver pendência já resolvida: deve recusar',
  format($q$SELECT public.regulacao_pendencia_unidade_resolver(%L::uuid, 'de novo')::text$q$, e2e.fbu(6, 'pend_nir')), 'erro:já foi resolvida', NULL, false, 'evol_nir');
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.9.nir_resolve_exame', 'nir', 'NIR resolve a pendência de exame com nota',
  format($q$SELECT public.regulacao_pendencia_unidade_resolver(%L::uuid, 'Gasometria colhida às ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '; RX pedido')::text || 'resolvida'$q$, e2e.fbu(9, 'pend_nir_exame')),
  'ok', NULL, false, 'pend_nir_exame');

-- ── médico da origem: responde, atualiza a evolução e conversa ───────────────
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.10.medico_responde', 'med', 'Médico responde a pendência da central',
  format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, %L)::text || 'respondida'$q$, e2e.fbu(c.n, 'reg'),
    'Evolução: ' || CASE c.n WHEN 2 THEN 'mantém SatO2 90% com cateter, sem nova hemoptise; gasometria colhida e lançada' ELSE 'PA 162x108 após a medicação da prescrição, sem iminência de eclâmpsia; exames colhidos' END || ' (teste de fluxo).'),
  'ok', 'respondida', false, 'pendencia')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.10.responder_de_novo', 'med', 'Ação repetida: responder de novo sem pergunta aberta: deve recusar',
  format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta repetida')::text$q$, e2e.fbu(2, 'reg')), 'erro:Não há pergunta da central', NULL, false, 'respondida');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.10.medico_evolucao', 'med', 'Médico atualiza a evolução do pedido com sinais vitais crus',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, %L, %L)::text$q$, e2e.fbu(c.n, 'reg'),
    'Evolução médica: ' || c.hipotese || ', segue no leito aguardando a vaga, sem piora desde o pedido (teste de fluxo).',
    (SELECT string_agg(k || ' ' || v, ', ') FROM jsonb_each_text(c.sinais) x(k, v))), 'ok', 'evol_med', false, 'reg')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.10.evolucao_curta', 'med', 'Evolução com 5 letras: deve recusar',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'igual', NULL)::text$q$, e2e.fbu(1, 'reg')), 'erro:mínimo de 10 letras', NULL, false, 'reg');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.10.medico_conversa', 'med', 'Médico responde na conversa',
  format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Evolução atualizada no pedido; os exames pedidos estão anexados ou lançados na planilha.', 'mensagem')::text$q$, e2e.fbu(c.n, 'reg')),
  'ok', NULL, false, 'msg_pergunta')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.10.conversa_' || x.papel, x.papel, 'Perfil fora da regulação (' || x.papel || ') tenta escrever na conversa: deve recusar',
  format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Mensagem de quem não devia escrever', 'mensagem')::text$q$, e2e.fbu(1, 'reg')), 'erro', NULL, true, 'reg')
  FROM (VALUES ('enf'), ('rec'), ('tec'), ('dmed')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.10.central_ve_resposta', 'reg', 'A central lê a conversa com a pergunta, o pedido de exames e a resposta do médico',
  format($q$SELECT e2e.fb_confere(jsonb_array_length(coalesce(x -> 'mensagens', x)) >= 3, left(x::text, 300)) FROM (SELECT public.regulacao_conversa(%L::uuid) x) z$q$, e2e.fbu(1, 'reg')), 'ok', NULL, false, 'msg_pergunta');
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.10.aviso_na_central', 'banco', 'Avisos na central para o regulador: resposta da pendência e evolução (o da conversa não chega à mesma pessoa)',
  format($q$SELECT e2e.fb_confere(count(*) = 2, string_agg(n.tipo, ', ')) FROM public.notificacoes_plantonista n
    WHERE n.perfil_id = e2e.fb_login() AND n.unidade_id = e2e.fb_central() AND n.tipo IN ('reg_resposta_' || %1$L, 'reg_evolucao_' || %1$L, 'reg_conversa_' || %1$L)$q$, e2e.fbv(2, 'num')),
  'ok', NULL, false, 'respondida');

-- ── decisão do regulador ────────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.11.' || x.passo, 'reg', x.descricao, format(x.sql, e2e.fbu(1, 'reg'), e2e.fb_upa(), e2e.fb_central()), x.esperado, NULL, true, 'assumido')
  FROM (VALUES
    (1, 'autorizar_sem_destino', 'Autorizar sem destino: deve recusar', $q$SELECT public.regulacao_autorizar(%1$L::uuid, 'a_definir', NULL, NULL, NULL, NULL, NULL)::text$q$, 'erro:defina o destino'),
    (2, 'autorizar_para_a_origem', 'Autorizar para a própria unidade de origem: deve recusar', $q$SELECT public.regulacao_autorizar(%1$L::uuid, 'rede', %2$L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'erro:O destino não pode ser a unidade de origem'),
    (3, 'autorizar_para_a_central', 'Autorizar para a própria central: deve recusar', $q$SELECT public.regulacao_autorizar(%1$L::uuid, 'rede', %3$L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'erro:O destino precisa ser uma unidade ativa da rede'),
    (4, 'negar_sem_motivo', 'Negar sem motivo da lista: deve recusar', $q$SELECT public.regulacao_negar(%1$L::uuid, 'porque sim', 'Texto da justificativa de teste')::text$q$, 'erro:Escolha o motivo da negação'),
    (5, 'negar_sem_texto', 'Negar sem justificativa escrita: deve recusar', $q$SELECT public.regulacao_negar(%1$L::uuid, 'sem_oferta', 'curto')::text$q$, 'erro:Escreva a justificativa'),
    (6, 'devolver_sem_motivo', 'Devolver sem dizer o que corrigir: deve recusar', $q$SELECT public.regulacao_devolver(%1$L::uuid, '')::text$q$, 'erro:Escreva o que a origem precisa corrigir')
  ) x(o, passo, descricao, sql, esperado) ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.11.autorizar_rede', 'reg', 'Regulador autoriza para o Hospital de Referência (rede), ambulância avançada',
  format($q$SELECT (public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '2 hours', %L) ->> 'status')$q$, e2e.fbu(c.n, 'reg'), e2e.fb_hosp(),
    'UTI adulto do Hospital de Referência (teste de fluxo B' || lpad(c.n::text, 2, '0') || ')'), 'ok', 'autorizada', false, 'assumido')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.11.autorizar_externo', 'reg', 'Regulador autoriza para serviço de fora da rede',
  format($q$SELECT (public.regulacao_autorizar(%L::uuid, 'externo', NULL, %L, %L, now() + interval '3 hours', 'Sem vaga do tipo na rede (teste de fluxo)') ->> 'status')$q$, e2e.fbu(c.n, 'reg'),
    CASE c.n WHEN 5 THEN 'Hospital Infantil de Referência (fora da rede)' ELSE 'Maternidade de Alto Risco (fora da rede)' END,
    CASE c.n WHEN 5 THEN 'ambulancia_basica' ELSE 'ambulancia_avancada' END), 'ok', 'autorizada', false, 'assumido')
  FROM e2e.fb_coorte c WHERE c.n IN (5, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.11.devolver', 'reg', 'Regulador devolve com o que a origem precisa corrigir',
  format($q$SELECT (public.regulacao_devolver(%L::uuid, %L) ->> 'status')$q$, e2e.fbu(c.n, 'reg'),
    CASE c.n WHEN 3 THEN 'Informar o resultado do teste para SARS-CoV-2 e a necessidade de oxigênio (litros/min) para definir o leito de isolamento.'
             ELSE 'Leito clínico com isolamento de contato: descrever a função renal e se há critério para tratar na própria unidade.' END), 'ok', 'devolvida', false, 'assumido')
  FROM e2e.fb_coorte c WHERE c.n IN (3, 8) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(4, 'FB.11.negar', 'reg', 'Regulador nega com motivo (sem oferta) e justificativa',
  format($q$SELECT (public.regulacao_negar(%L::uuid, 'sem_oferta', 'Sem leito de ambiente protetor (isolamento reverso) na rede nem nos serviços pactuados hoje; manter na origem e reavaliar (teste de fluxo).') ->> 'status')$q$, e2e.fbu(4, 'reg')),
  'ok', 'negada', false, 'assumido');
INSERT INTO _r (txt)
SELECT e2e.fb(4, 'FB.11.decidir_depois_de_negar', 'reg', 'Ação repetida: autorizar um pedido já negado: deve recusar',
  format($q$SELECT public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital de fora', NULL, NULL, NULL)::text$q$, e2e.fbu(4, 'reg')), 'erro:Este pedido não está na fila da central', NULL, false, 'negada');
INSERT INTO _r (txt)
SELECT e2e.fb(4, 'FB.11.evolucao_depois_de_negar', 'med', 'Atualizar a evolução de pedido negado: deve recusar',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução depois da negativa (teste)', NULL)::text$q$, e2e.fbu(4, 'reg')), 'erro:Só se atualiza a evolução', NULL, false, 'negada');

-- origem depois da devolução: B03 corrige e reenvia; B08 cancela
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.11.reenviar_nir_outro', 'nir', 'NIR tenta reenviar o pedido devolvido de outro médico: deve recusar (desfeito)',
  format($q$SELECT public.regulacao_reenviar(%L::uuid, '{}'::jsonb)::text$q$, e2e.fbu(3, 'reg')), 'erro:Reenvia o solicitante', NULL, true, 'devolvida', (SELECT sql FROM _outro WHERE n = 3));
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.11.reenviar_cid_incompativel', 'med', 'Reenviar trocando o CID por um incompatível com o procedimento: deve recusar',
  format($q$SELECT public.regulacao_reenviar(%L::uuid, %L::jsonb)::text$q$, e2e.fbu(3, 'reg'),
    jsonb_build_object('cid', 'I64', 'carater', 'urgencia', 'prioridade', c.prioridade, 'quadro_clinico', c.quadro)), 'erro:não é compatível com o procedimento', NULL, false, 'devolvida')
  FROM e2e.fb_coorte c WHERE c.n = 3;
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.11.reenviar', 'med', 'Médico corrige o que a central pediu e reenvia',
  format($q$SELECT left(public.regulacao_reenviar(%L::uuid, %L::jsonb)::text, 100) || 'reenviado'$q$, e2e.fbu(3, 'reg'),
    jsonb_build_object('cid', c.cid, 'carater', 'urgencia', 'prioridade', c.prioridade, 'hipotese', c.hipotese,
      'quadro_clinico', c.quadro || ' Teste rápido para SARS-CoV-2 positivo; oxigênio por cateter a 3 L/min.',
      'sinais_vitais', 'FC 96, PA 116x70, FR 24, SatO2 93% com cateter 3 L/min', 'exames', 'Teste rápido SARS-CoV-2 positivo; RX com infiltrado bilateral',
      'medicacoes', 'Conforme a prescrição do leito (dose: texto de teste)')), 'ok', 'reenviado', false, 'devolvida')
  FROM e2e.fb_coorte c WHERE c.n = 3;
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.11.isolamento_confirmado', 'med', 'Com o teste positivo, o médico passa o isolamento do pedido para "confirmado"',
  format($q$SELECT public.regulacao_definir_isolamento(%L::uuid, 'contato_aerossol', 'confirmado', 'SARS-CoV-2 (teste rápido positivo)')::text$q$, e2e.fbu(3, 'reg')), 'ok', NULL, false, 'reenviado');
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.11.autorizar_reenviado', 'reg', 'Regulador autoriza o pedido reenviado para serviço de fora (leito de isolamento)',
  format($q$SELECT (public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital de Doenças Tropicais (fora da rede)', 'ambulancia_avancada', now() + interval '4 hours', 'Leito de isolamento respiratório confirmado por telefone (teste de fluxo)') ->> 'status')$q$, e2e.fbu(3, 'reg')),
  'ok', 'autorizada', false, 'reenviado');
INSERT INTO _r (txt)
SELECT e2e.fb(8, 'FB.11.cancelar_sem_motivo', 'med', 'Cancelar sem motivo: deve recusar',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'não')::text$q$, e2e.fbu(8, 'reg')), 'erro:Escreva o motivo', NULL, false, 'devolvida');
INSERT INTO _r (txt)
SELECT e2e.fb(8, 'FB.11.cancelar', 'med', 'Médico cancela o pedido devolvido (vai tratar na unidade), com motivo',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Função renal normal e boa resposta ao tratamento: segue internada na UPA, sem necessidade de transferência (teste de fluxo).')::text || 'cancelada'$q$, e2e.fbu(8, 'reg')),
  'ok', 'cancelada', false, 'devolvida');
INSERT INTO _r (txt)
SELECT e2e.fb(8, 'FB.11.cancelar_de_novo', 'med', 'Ação repetida: cancelar de novo: deve recusar',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Cancelamento repetido de teste')::text$q$, e2e.fbu(8, 'reg')), 'erro:não pode mais ser cancelada', NULL, false, 'cancelada');

INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.11.situacao', 'banco', 'Situação do pedido no fim da fase',
  format($q$SELECT 'nº ' || s.numero || ': ' || s.status || coalesce(' → ' || coalesce((SELECT u.nome FROM public.unidades u WHERE u.id = s.destino_unidade_id), s.destino_externo), '')
      || '; eventos: ' || (SELECT string_agg(e.evento, ' → ' ORDER BY e.em, e.ctid) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.fbu(c.n, 'reg')),
  'registrar', NULL, false, 'reg')
  FROM e2e.fb_coorte c ORDER BY c.n;

DROP FUNCTION e2e.fb_seq(text, text);
DROP FUNCTION e2e.fb_ler(text);
SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
