-- Teste de fluxo B, decisão do RT de 25/11 (B-11): a leitura direta de exames_pedidos fica
-- para médico, enfermagem e NIR (o gestor segue lendo; pergunta ao RT).
-- Roda em transação desfeita (ver 205 para _r, e2e.fb_ler e e2e.fb_seq). Paciente: B09 (CM-8).
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.28.leitura_direta_' || x.papel, x.papel, 'B-11: ' || x.papel || ' escalado no setor lê exames_pedidos direto: ' || CASE WHEN x.ve THEN 'lê' ELSE 'não lê nada' END,
  format($q$SELECT e2e.fb_confere((count(*) > 0) = %L::boolean, count(*) || ' linhas') FROM public.exames_pedidos ep WHERE ep.paciente_id = %L$q$, x.ve, e2e.fbu(9, 'pac')), 'ok', NULL, true)
  FROM (VALUES ('med', true), ('enf', true), ('tec', true), ('nir', true), ('ges', true), ('rec', false), ('far', false), ('fat', false), ('regupa', false)) x(papel, ve);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.28.leitura_direta_resultados_' || x.papel, x.papel, 'B-11: ' || x.papel || ' não lê exame_resultados direto (nem antes): só por RPC',
  $q$SELECT count(*)::text FROM public.exame_resultados$q$, 'erro:permission denied', NULL, true)
  FROM (VALUES ('rec'), ('far'), ('med')) x(papel);
-- vizinhos que leem por RPC seguem funcionando
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.28.vizinho_' || x.passo, x.papel, 'B-11, tela vizinha segue: ' || x.descricao, x.sql, 'ok', NULL, true)
  FROM (VALUES
    ('faturamento_contas', 'fat', 'faturamento lista as contas da unidade (RPC)', format($q$SELECT e2e.fb_confere(jsonb_array_length(c -> 'contas') > 0, jsonb_array_length(c -> 'contas') || ' contas') FROM (SELECT public.contas_da_unidade(%L::uuid, NULL, NULL) c) z$q$, e2e.fb_upa())),
    ('farmacia_fila', 'far', 'farmácia lê a fila de validação (RPC)', format($q$SELECT count(*)::text || ' itens na fila' FROM public.fila_validacao(%L::uuid)$q$, e2e.fb_upa())),
    ('recepcao_busca', 'rec', 'recepção busca paciente (RPC)', format($q$SELECT e2e.fb_confere(count(*) >= 1, count(*) || ' achados') FROM public.buscar_pacientes(%L::uuid, 'Teste Fluxo B09')$q$, e2e.fb_upa())),
    ('medico_planilha', 'med', 'médico lê a planilha (RPC resultados_da_internacao)', format($q$SELECT e2e.fb_confere(jsonb_array_length(x) >= 2, jsonb_array_length(x) || ' resultados') FROM (SELECT public.resultados_da_internacao(%L::uuid) x) z$q$, e2e.fbu(9, 'int'))),
    ('medico_detalhe', 'med', 'médico abre o detalhe do exame (RPC)', format($q$SELECT left(public.exame_detalhe(%L::uuid)::text, 60)$q$, (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010317'))),
    ('enfermeiro_detalhe', 'enf', 'enfermeiro abre o detalhe do exame (RPC)', format($q$SELECT left(public.exame_detalhe(%L::uuid)::text, 60)$q$, (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010317'))),
    ('nir_planilha', 'nir', 'NIR lê a planilha (RPC)', format($q$SELECT e2e.fb_confere(jsonb_array_length(x) >= 2, jsonb_array_length(x) || ' resultados') FROM (SELECT public.resultados_da_internacao(%L::uuid) x) z$q$, e2e.fbu(9, 'int'))),
    ('regulador_fila', 'reg', 'regulador lê a fila da central (RPC)', format($q$SELECT left(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text, 40)$q$, e2e.fb_central())),
    ('gestor_lista_regulacao', 'ges', 'gestor lê a regulação da unidade (RPC)', format($q$SELECT left(public.regulacao_lista(%L::uuid)::text, 40)$q$, e2e.fb_upa()))
  ) x(passo, papel, descricao, sql);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.28.rpc_exame_' || x.papel, x.papel, 'B-11: ' || x.papel || ' tenta abrir o detalhe do exame pela RPC: deve recusar',
  format($q$SELECT left(public.exame_detalhe(%L::uuid)::text, 60)$q$, (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010317')), 'erro', NULL, true)
  FROM (VALUES ('rec'), ('far'), ('fat')) x(papel);
