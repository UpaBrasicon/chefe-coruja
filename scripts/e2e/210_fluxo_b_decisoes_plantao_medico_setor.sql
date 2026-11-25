-- Teste de fluxo B, decisões do RT de 25/11 (B-05 e B-07): repete os passos que
-- mostraram o problema. Tudo desfeito, menos o resultado em e2e.resultados.
-- Roda dentro de scripts que criam _r, e2e.fb_ler e e2e.fb_seq (ver 205).
CREATE TEMP TABLE _outro9 ON COMMIT DROP AS
SELECT format('UPDATE public.regulacao_solicitacoes SET solicitante_id = (SELECT id FROM public.perfis WHERE id <> e2e.fb_login() ORDER BY id LIMIT 1), medico_assistente_id = NULL WHERE id = %L', e2e.fbu(9, 'reg')) AS sql;
CREATE TEMP TABLE _fora ON COMMIT DROP AS
SELECT format($q$UPDATE public.presenca_plantonista SET checkout_em = now() - interval '1 minute', checkout_automatico = false WHERE perfil_id = e2e.fb_login() AND unidade_id = %L AND data = DATE '2026-11-25'$q$, e2e.fb_upa()) AS sql;

-- B-05: outro médico, de plantão no setor do paciente (B09, pedido de outro médico, pendência aberta)
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.20.medico_do_setor_' || x.passo, 'med', 'B-05: médico de plantão no setor (não pediu) ' || x.descricao, format(x.sql, e2e.fbu(9, 'reg')), 'ok', NULL, true, NULL, (SELECT sql FROM _outro9))
  FROM (VALUES
    (1, 'evolucao', 'atualiza a evolução, autor = ele, papel médico',
      $q$SELECT e2e.fb_seq($x$SELECT public.regulacao_atualizar_evolucao(%1$L::uuid, 'Médico do plantão seguinte: mantém quadro (teste B-05)', NULL)$x$,
         $x$SELECT e2e.fb_confere(ev.autor_id = e2e.fb_login() AND ev.autor_papel = 'medico', 'autor = login, papel ' || ev.autor_papel) FROM public.regulacao_evolucoes ev WHERE ev.solicitacao_id = %1$L ORDER BY ev.em DESC LIMIT 1$x$)$q$),
    (2, 'responde', 'responde à pergunta da central', $q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta do médico do plantão seguinte (teste B-05)')::text || 'respondida'$q$),
    (3, 'cancela', 'cancela o pedido, com autor = ele',
      $q$SELECT e2e.fb_seq($x$SELECT public.regulacao_cancelar(%1$L::uuid, 'Cancelado pelo médico do plantão seguinte (teste B-05)')$x$,
         $x$SELECT e2e.fb_confere(s.status = 'cancelada' AND s.cancelada_por = e2e.fb_login(), s.status) FROM public.regulacao_solicitacoes s WHERE s.id = %1$L$x$)$q$)
  ) x(o, passo, descricao, sql) ORDER BY x.o;
-- negativo do B-05: médico da unidade que NÃO está com o paciente no plantão (check-out feito) segue recusado
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.20.medico_fora_do_setor_' || x.passo, 'med', 'B-05/B-07: médico sem plantão no setor do paciente (pedido de outro médico) ' || x.descricao, format(x.sql, e2e.fbu(9, 'reg')), 'erro:Fora do plantão', NULL, true, NULL,
    (SELECT sql FROM _outro9) || '; ' || (SELECT sql FROM _fora))
  FROM (VALUES
    (1, 'evolucao', 'tenta atualizar a evolução', $q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução de quem não está de plantão (teste)', NULL)::text$q$),
    (2, 'responde', 'tenta responder à central', $q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta de quem não está de plantão')::text$q$),
    (3, 'cancela', 'tenta cancelar', $q$SELECT public.regulacao_cancelar(%L::uuid, 'Cancelamento de quem não está de plantão (teste)')::text$q$)
  ) x(o, passo, descricao, sql) ORDER BY x.o;
-- outros perfis seguem sem poder (pedido de outro médico)
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.20.outro_perfil_' || x.papel, x.papel, 'B-05: ' || x.papel || ' tenta cancelar pedido de outro médico: deve recusar',
  format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Cancelamento por outro perfil (teste)')::text$q$, e2e.fbu(9, 'reg')), 'erro:Cancela quem solicitou', NULL, true, NULL, (SELECT sql FROM _outro9))
  FROM (VALUES ('nir'), ('enf'), ('regupa')) x(papel);

-- B-07: fora do plantão (check-out feito), o próprio solicitante e o NIR são recusados
INSERT INTO _r (txt)
SELECT e2e.fb(x.n, 'FB.20.fora_do_plantao_' || x.passo, x.papel, 'B-07: fora do plantão, ' || x.descricao, x.sql, 'erro:Fora do plantão', NULL, true, NULL, (SELECT sql FROM _fora))
  FROM (VALUES
    (1, 9, 'nir_pendencia', 'nir', 'NIR cria pendência da unidade', format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'outro', 'Pendência criada fora do plantão (teste)', 'normal', NULL, 'nir')::text$q$, e2e.fbu(9, 'reg'))),
    (2, 9, 'nir_evolucao', 'nir', 'NIR atualiza a evolução', format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução escrita fora do plantão (teste)', NULL)::text$q$, e2e.fbu(9, 'reg'))),
    (3, 9, 'nir_responde', 'nir', 'NIR responde à central', format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta fora do plantão (teste)')::text$q$, e2e.fbu(9, 'reg'))),
    (4, 9, 'nir_conversa', 'nir', 'NIR escreve na conversa', format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Mensagem fora do plantão (teste)', 'mensagem')::text$q$, e2e.fbu(9, 'reg'))),
    (5, 9, 'nir_resolve', 'nir', 'NIR resolve pendência da unidade', format($q$SELECT public.regulacao_pendencia_unidade_resolver(%L::uuid, 'fora do plantão')::text$q$, e2e.fbu(9, 'pend_nir'))),
    (6, 9, 'medico_evolucao', 'med', 'médico solicitante atualiza a evolução', format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução escrita fora do plantão (teste)', NULL)::text$q$, e2e.fbu(9, 'reg'))),
    (7, 9, 'medico_responde', 'med', 'médico solicitante responde à central', format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resposta fora do plantão (teste)')::text$q$, e2e.fbu(9, 'reg'))),
    (8, 9, 'medico_cancela', 'med', 'médico solicitante cancela', format($q$SELECT public.regulacao_cancelar(%L::uuid, 'Cancelamento fora do plantão (teste)')::text$q$, e2e.fbu(9, 'reg'))),
    (9, 9, 'medico_isolamento', 'med', 'médico muda o isolamento do pedido', format($q$SELECT public.regulacao_definir_isolamento(%L::uuid, 'goticula', 'confirmado', 'teste')::text$q$, e2e.fbu(9, 'reg'))),
    (10, 10, 'medico_pede_vaga', 'med', 'médico abre pedido de regulação', format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303010037","cid":"A41.9","carater":"urgencia","prioridade":"urgencia","destino_tipo":"a_definir","quadro_clinico":"Pedido aberto fora do plantão (teste de fluxo)."}'::jsonb)::text$q$, e2e.fb_upa(), e2e.fbu(10, 'pac'))),
    (11, 10, 'nir_pede_vaga', 'nir', 'NIR abre pedido de regulação', format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303010037","cid":"A41.9","carater":"urgencia","prioridade":"urgencia","destino_tipo":"a_definir","quadro_clinico":"Pedido aberto fora do plantão (teste de fluxo)."}'::jsonb)::text$q$, e2e.fb_upa(), e2e.fbu(10, 'pac')))
  ) x(o, n, passo, papel, descricao, sql) ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.20.por_que_nao_ajo_' || x.papel, x.papel, 'B-07: a tela pergunta antes (regulacao_por_que_nao_ajo) fora do plantão: devolve o motivo',
  format($q$SELECT e2e.fb_confere(m LIKE 'Fora do plantão%%', m) FROM (SELECT public.regulacao_por_que_nao_ajo(%L::uuid, %L::uuid) m) z$q$, e2e.fb_upa(), e2e.fbu(9, 'pac')), 'ok', NULL, true, NULL, (SELECT sql FROM _fora))
  FROM (VALUES ('med'), ('nir')) x(papel);
-- de plantão, tudo segue como antes; gestor e regulador não dependem do plantão
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.20.de_plantao_' || x.papel, x.papel, 'B-07: de plantão, ' || x.papel || ' pode agir (regulacao_por_que_nao_ajo devolve nulo) e atualiza a evolução',
  format($q$SELECT e2e.fb_confere(public.regulacao_por_que_nao_ajo(%L::uuid, %L::uuid) IS NULL, 'pode agir') || ' / ' || public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução de plantão (teste B-07)', NULL)::text$q$, e2e.fb_upa(), e2e.fbu(9, 'pac'), e2e.fbu(9, 'reg')), 'ok', NULL, true)
  FROM (VALUES ('med'), ('nir')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.20.fora_do_plantao_' || x.papel, x.papel, 'B-07: ' || x.descricao, format(x.sql, e2e.fbu(9, 'reg')), 'ok', NULL, true, NULL, (SELECT sql FROM _fora))
  FROM (VALUES
    ('ges', 'gestor da UPA fora do plantão atualiza a evolução (não depende do plantão)', $q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução pelo gestor (teste B-07)', NULL)::text$q$),
    ('reg', 'regulador da central escreve na conversa (não depende do plantão da origem)', $q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Mensagem do regulador (teste B-07)', 'mensagem')::text$q$)
  ) x(papel, descricao, sql);
