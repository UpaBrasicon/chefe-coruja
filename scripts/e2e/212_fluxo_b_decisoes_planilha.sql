-- Teste de fluxo B, decisão do RT de 25/11 (B-09): na planilha, só médico e NIR lançam.
-- Roda em transação desfeita (ver 205 para _r, e2e.fb_ler e e2e.fb_seq). Exame: ureia do B09 (sem resultado).
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.22.planilha_' || x.papel, x.papel, 'B-09: ' || x.papel || ' lança valor na planilha: ' || CASE WHEN x.pode THEN 'aceita, autor = login' ELSE 'deve recusar' END,
  format($q$SELECT e2e.fb_seq($x$SELECT public.registrar_resultado_estruturado(%1$L::uuid, now() - interval '5 minutes', '[{"analito":"Ureia","valor":"40"}]'::jsonb)$x$,
      $x$SELECT e2e.fb_confere(r.registrado_por = e2e.fb_login() AND r.origem = 'manual', 'gravado: ' || r.texto) FROM public.exame_resultados r WHERE r.exame_id = %1$L AND r.vigente$x$)$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010694')),
  CASE WHEN x.pode THEN 'ok' ELSE 'erro:Lançam valores na planilha o médico' END, NULL, true)
  FROM (VALUES ('med', true), ('nir', true), ('enf', false), ('tec', false), ('ges', false), ('rec', false)) x(papel, pode);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.22.planilha_fora_do_plantao_' || x.papel, x.papel, 'B-09: ' || x.papel || ' fora do plantão não lança',
  format($q$SELECT public.registrar_resultado_estruturado(%L::uuid, now() - interval '5 minutes', '[{"analito":"Ureia","valor":"40"}]'::jsonb)::text$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010694')),
  'erro:Lançam valores na planilha o médico', NULL, true, NULL,
  format($q$UPDATE public.presenca_plantonista SET checkout_em = now() - interval '1 minute', checkout_automatico = false WHERE perfil_id = e2e.fb_login() AND unidade_id = %L AND data = DATE '2026-11-25'$q$, e2e.fb_upa()))
  FROM (VALUES ('med'), ('nir')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.22.posso_lancar_' || x.papel, x.papel, 'B-09: a tela pergunta posso_lancar_planilha: ' || x.papel || ' = ' || x.pode,
  format('SELECT e2e.fb_confere(public.posso_lancar_planilha(%L::uuid) = %L::boolean, %L)', e2e.fbu(9, 'int'), x.pode, x.papel || ' ' || x.pode), 'ok', NULL, true)
  FROM (VALUES ('med', true), ('nir', true), ('enf', false), ('ges', false)) x(papel, pode);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.22.nir_le_planilha', 'nir', 'B-09: o NIR lê a planilha da internação (registro do que o servidor devolve)',
  format($q$SELECT jsonb_array_length(x) || ' resultados; ' || left(x::text, 160) FROM (SELECT public.resultados_da_internacao(%L::uuid) x) z$q$, e2e.fbu(9, 'int')), 'registrar', NULL, true);
