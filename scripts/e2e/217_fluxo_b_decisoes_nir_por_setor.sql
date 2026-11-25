-- Teste de fluxo B, decisão do RT de 25/11: o NIR de plantão vale pelo SETOR da escala ativa.
-- Roda em transação desfeita (ver 205 para _r, e2e.fb_ler e e2e.fb_seq). Paciente: B09 (CM-8, Clínica Médica).
-- "só no PS": dentro do passo, a escala de hoje do login na UPA fica só no Pronto Socorro.
CREATE TEMP TABLE _so_ps ON COMMIT DROP AS
SELECT format($q$UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = e2e.fb_login() AND unidade_id = %L AND data = DATE '2026-11-25' AND setor_id <> '32000000-0000-4000-8000-000000000001'$q$, e2e.fb_upa()) AS sql;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.27.nir_outro_setor_' || x.passo, 'nir', 'NIR escalado só no Pronto Socorro, paciente na Clínica Médica: ' || x.descricao, x.sql, x.esperado, NULL, true, NULL, (SELECT sql FROM _so_ps))
  FROM (VALUES
    (1, 'pendencia', 'criar pendência: deve recusar', format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'outro', 'Pendência de outro setor (teste)', 'normal', NULL, 'nir')::text$q$, e2e.fbu(9, 'reg')), 'erro:Fora do plantão neste setor'),
    (2, 'evolucao', 'atualizar a evolução: deve recusar', format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução por NIR de outro setor (teste)', NULL)::text$q$, e2e.fbu(9, 'reg')), 'erro:Fora do plantão neste setor'),
    (3, 'conversa', 'escrever na conversa: deve recusar', format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Mensagem de NIR de outro setor (teste)', 'mensagem')::text$q$, e2e.fbu(9, 'reg')), 'erro:Fora do plantão neste setor'),
    (4, 'pede_vaga', 'abrir pedido para o paciente: deve recusar', format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303140046","cid":"J44.1","carater":"urgencia","prioridade":"urgencia","destino_tipo":"a_definir","quadro_clinico":"Pedido por NIR de outro setor (teste de fluxo)."}'::jsonb)::text$q$, e2e.fb_upa(), e2e.fbu(9, 'pac')), 'erro:Fora do plantão neste setor'),
    (5, 'planilha', 'lançar na planilha: deve recusar', format($q$SELECT public.registrar_resultado_estruturado(%L::uuid, now() - interval '5 minutes', '[{"analito":"Ureia","valor":"40"}]'::jsonb)::text$q$, (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010694')), 'erro:Lançam valores na planilha'),
    (6, 'posso_lancar', 'a tela pergunta posso_lancar_planilha: falso', format('SELECT e2e.fb_confere(NOT public.posso_lancar_planilha(%L::uuid), %L)', e2e.fbu(9, 'int'), 'não pode lançar'), 'ok'),
    (7, 'le_exames', 'ler os pedidos de exame do paciente: nenhum', format($q$SELECT e2e.fb_confere(count(*) = 0, count(*) || ' exames visíveis') FROM public.exames_pedidos ep WHERE ep.internacao_id = %L$q$, e2e.fbu(9, 'int')), 'ok'),
    (8, 'por_que_com_paciente', 'a tela pergunta regulacao_por_que_nao_ajo com o paciente: devolve o motivo do setor', format($q$SELECT e2e.fb_confere(m LIKE 'Fora do plantão neste setor%%', m) FROM (SELECT public.regulacao_por_que_nao_ajo(%L::uuid, %L::uuid) m) z$q$, e2e.fb_upa(), e2e.fbu(9, 'pac')), 'ok'),
    (9, 'por_que_sem_paciente', 'sem paciente na pergunta (antes de escolher): vale a escala na unidade, pode', format($q$SELECT e2e.fb_confere(public.regulacao_por_que_nao_ajo(%L::uuid, NULL) IS NULL, 'pode')$q$, e2e.fb_upa()), 'ok')
  ) x(o, passo, descricao, sql, esperado) ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.27.nir_no_setor_' || x.passo, 'nir', 'NIR escalado na Clínica Médica, paciente na Clínica Médica: ' || x.descricao, x.sql, 'ok', NULL, true)
  FROM (VALUES
    (1, 'evolucao', 'atualiza a evolução', format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução pelo NIR do setor (teste)', NULL)::text$q$, e2e.fbu(9, 'reg'))),
    (2, 'pendencia', 'cria pendência', format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'outro', 'Pendência do NIR do setor (teste)', 'normal', NULL, 'nir')::text$q$, e2e.fbu(9, 'reg'))),
    (3, 'planilha', 'lança na planilha', format($q$SELECT left(public.registrar_resultado_estruturado(%L::uuid, now() - interval '5 minutes', '[{"analito":"Ureia","valor":"40"}]'::jsonb)::text, 60)$q$, (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010694'))),
    (4, 'le_exames', 'lê os pedidos de exame', format($q$SELECT e2e.fb_confere(count(*) > 0, count(*) || ' exames visíveis') FROM public.exames_pedidos ep WHERE ep.internacao_id = %L$q$, e2e.fbu(9, 'int')))
  ) x(o, passo, descricao, sql) ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.27.medico_outro_setor', 'med', 'Médico escalado só no Pronto Socorro, paciente na Clínica Médica: atualizar a evolução segue recusado',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução por médico de outro setor (teste)', NULL)::text$q$, e2e.fbu(9, 'reg')), 'erro:Fora do plantão neste setor', NULL, true, NULL, (SELECT sql FROM _so_ps));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.27.gestor_outro_setor', 'ges', 'Gestor (não depende do plantão) segue podendo',
  format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução pelo gestor (teste)', NULL)::text$q$, e2e.fbu(9, 'reg')), 'ok', NULL, true, NULL, (SELECT sql FROM _so_ps));
