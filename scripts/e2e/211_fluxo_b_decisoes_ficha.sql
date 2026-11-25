-- Teste de fluxo B, decisão do RT de 25/11 (B-08): só recepção e médico abrem ficha.
-- Roda em transação desfeita (ver 205 para _r, e2e.fb_ler e e2e.fb_seq).
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.21.ficha_por_' || x.papel, x.papel, 'B-08: ' || x.papel || ' escalado no Pronto Socorro abre ficha: ' || CASE WHEN x.pode THEN 'aceita' ELSE 'deve recusar' END,
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça', NULL, %L::jsonb) ->> 'etapa')$q$, '32000000-0000-4000-8000-000000000001',
    jsonb_build_object('nome', 'Teste Fluxo B ficha por ' || x.papel, 'data_nascimento', '1990-01-01', 'sexo', 'F')),
  CASE WHEN x.pode THEN 'ok' ELSE 'erro:A ficha é aberta pela recepção ou, na emergência, pelo médico' END, NULL, true)
  FROM (VALUES ('rec', true), ('med', true), ('tec', false), ('enf', false), ('far', false), ('nir', false), ('ges', false), ('regupa', false)) x(papel, pode);
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.21.ficha_fora_do_plantao_' || x.papel, x.papel, 'B-08: ' || x.papel || ' fora do plantão segue recusado pela escala',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça', NULL, '{"nome":"Teste Fluxo B fora do plantão","data_nascimento":"1990-01-01","sexo":"F"}'::jsonb) ->> 'etapa')$q$, '32000000-0000-4000-8000-000000000001'),
  'erro:não está de plantão', NULL, true, NULL,
  format($q$UPDATE public.presenca_plantonista SET checkout_em = now() - interval '1 minute', checkout_automatico = false WHERE perfil_id = e2e.fb_login() AND unidade_id = %L AND data = DATE '2026-11-25'$q$, e2e.fb_upa()))
  FROM (VALUES ('rec'), ('med')) x(papel);
