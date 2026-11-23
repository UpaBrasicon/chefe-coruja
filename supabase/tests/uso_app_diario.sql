-- Testes da migration 20270415000038 (Fase 1, item 14: uso do app no próprio
-- banco, sem pessoa e sem paciente; PH1 a PH3 = A do RT em 23/11/2026). ROLLBACK no fim.
-- Cada evento soma 1 no dia, por unidade, papel, evento e detalhe; papel sem
-- vínculo ativo e evento fora da lista não gravam nada (e não dão erro); a
-- tabela não se lê nem se escreve direto; só o super admin lê o painel, que
-- traz as entradas do LG9 sem dizer quem entrou e a soma das ferramentas sem a pessoa.
BEGIN;
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;

DELETE FROM public.uso_app_diario WHERE unidade_id = '21000000-0000-4000-8000-000000000001';

-- ── o médico e a enfermeira usam o app ──────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'censo');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'censo');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'ferramenta', 'escores/heart');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'central_aba', 'escores');
-- papel que ele não tem, evento fora da lista, detalhe fora do formato: nada grava, nada quebra
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'gestor', 'censo');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'paciente_aberto', 'x');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'ferramenta', 'Maria da Silva');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'papel-que-nao-existe', 'censo');
SELECT public.registrar_uso_app(NULL, 'plantonista', 'censo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'enfermeiro', 'censo');
SELECT pg_temp.falha($$SELECT * FROM public.uso_app_diario$$, 'permission denied', 'a tabela não se lê direto');
SELECT pg_temp.falha($$INSERT INTO public.uso_app_diario (dia, unidade_id, papel, evento, total) VALUES (current_date, '21000000-0000-4000-8000-000000000001', 'enfermeiro', 'censo', 99)$$,
  'permission denied', 'não se escreve direto na tabela');
SELECT pg_temp.falha($$SELECT public.uso_app_painel(30)$$, 'Acesso negado', 'a enfermeira não lê o painel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.uso_app_painel(30)$$, 'Acesso negado', 'a gestora não lê o painel');
RESET ROLE;

SELECT pg_temp.igual((SELECT string_agg(papel || ':' || evento || ':' || detalhe || ':' || total, ' ' ORDER BY papel::text, evento, detalhe)
                        FROM public.uso_app_diario WHERE unidade_id = '21000000-0000-4000-8000-000000000001'),
  'enfermeiro:censo::1 plantonista:censo::2 plantonista:central_aba:escores:1 plantonista:ferramenta:escores/heart:1',
  'conta por dia, papel, evento e detalhe; o que não confere não grava');
SELECT pg_temp.igual((SELECT count(*)::text FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'uso_app_diario' AND column_name ~ 'perfil|paciente|usuario'),
  '0', 'a tabela não tem coluna de pessoa nem de paciente');

-- ── o painel do super admin ─────────────────────────────────────────────────
INSERT INTO private.registros_acesso_aplicacao (usuario_id, acao, ip, em) VALUES
  ('10000000-0000-4000-8000-000000000002', 'entrada', '203.0.113.10', now()),
  ('10000000-0000-4000-8000-000000000002', 'entrada', '203.0.113.10', now()),
  ('10000000-0000-4000-8000-000000000004', 'entrada', '203.0.113.12', now()),
  ('10000000-0000-4000-8000-000000000004', 'renovacao', '203.0.113.12', now());
-- o esperado conta o que já havia no dia (a homologação tem entradas reais)
SELECT set_config('teste.entradas_hoje',
  (SELECT (count(*) FILTER (WHERE acao = 'entrada'))::text || ':' || (count(DISTINCT usuario_id) FILTER (WHERE acao = 'entrada'))::text
     FROM private.registros_acesso_aplicacao WHERE (em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date),
  true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.igual((SELECT (e->>'entradas') || ':' || (e->>'pessoas')
                        FROM jsonb_array_elements(public.uso_app_painel(7)->'entradas') e
                       WHERE (e->>'dia')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date),
  current_setting('teste.entradas_hoje'),
  'o painel conta entradas e pessoas do dia, sem renovação');
SELECT pg_temp.igual((SELECT count(*)::text FROM jsonb_array_elements(public.uso_app_painel(7)->'eventos') e
                       WHERE e->>'unidade_id' = '21000000-0000-4000-8000-000000000001'),
  '4', 'o painel traz os eventos da unidade');
SELECT pg_temp.igual((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_array_elements(public.uso_app_painel(7)->'entradas') e,
                       jsonb_object_keys(e) k WHERE (e->>'dia')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date),
  'dia,entradas,pessoas', 'as entradas não dizem quem entrou');
SELECT pg_temp.igual((SELECT count(*)::text FROM jsonb_array_elements(public.uso_app_painel(7)->'ferramentas_desde_inicio') e
                       WHERE e ? 'perfil_id'), '0', 'a soma das ferramentas não traz a pessoa');
RESET ROLE;

-- ── anônimo não chama ───────────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.registrar_uso_app('21000000-0000-4000-8000-000000000001', 'plantonista', 'censo')$$, 'permission denied', 'anônimo não registra uso');
SELECT pg_temp.falha($$SELECT public.uso_app_painel(30)$$, 'permission denied', 'anônimo não lê o painel');
RESET ROLE;

ROLLBACK;
