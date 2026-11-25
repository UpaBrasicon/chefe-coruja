-- Teste de fluxo B, decisão do RT de 25/11 (B-09, complemento): o NIR de plantão lê os
-- pedidos de exame aguardando resultado (o que a gaveta "Lançar resultado" lista).
-- Roda em transação desfeita (ver 205 para _r, e2e.fb_ler e e2e.fb_seq).
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.26.pedidos_visiveis_' || x.papel, x.papel, 'B-09: ' || x.papel || ' lê os exames aguardando resultado do B09: ' || CASE WHEN x.ve THEN 'vê' ELSE 'não vê' END,
  format($q$SELECT e2e.fb_confere((count(*) > 0) = %L::boolean, count(*) || ' exames aguardando') FROM public.exames_pedidos ep WHERE ep.internacao_id = %L AND ep.situacao IN ('pedido', 'coletado', 'em_analise', 'realizado')$q$, x.ve, e2e.fbu(9, 'int')),
  'ok', NULL, true)
  FROM (VALUES ('nir', true), ('med', true)) x(papel, ve);
-- obs.: recepção, farmacêutico e outros papéis do MESMO login também leem, porque a política antiga (paciente_no_meu_plantao)
-- olha só a escala da pessoa no setor, não o papel; com o login de teste escalado em todos os setores não dá para separar.
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.26.pedidos_nir_fora_do_plantao', 'nir', 'B-09: NIR fora do plantão (check-out feito) não vê os pedidos',
  format($q$SELECT e2e.fb_confere(count(*) = 0, count(*) || ' exames visíveis') FROM public.exames_pedidos ep WHERE ep.internacao_id = %L$q$, e2e.fbu(9, 'int')), 'ok', NULL, true, NULL,
  format($q$UPDATE public.presenca_plantonista SET checkout_em = now() - interval '1 minute', checkout_automatico = false WHERE perfil_id = e2e.fb_login() AND unidade_id = %L AND data = DATE '2026-11-25'$q$, e2e.fb_upa()));
