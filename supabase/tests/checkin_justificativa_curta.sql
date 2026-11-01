-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000012_checkin_justificativa_curta.sql (bug
-- baixo B4 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/checkin_justificativa_curta.sql
--
-- Regra do RT: a localização registra mas não exige; a justificativa (mín. 10
-- letras) só é pedida quando o GPS falha ou está fora do raio. Antes, a
-- justificativa curta era recusada mesmo quando não era necessária (unidade sem
-- coordenadas, ou dentro do raio), pior que não escrever nada.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000cd01'),
  ('semgps','00000000-0000-4000-8000-00000000cd0a'),
  ('comgps','00000000-0000-4000-8000-00000000cd0b'),
  ('s1',    '00000000-0000-4000-8000-00000000cda1'),
  ('s2',    '00000000-0000-4000-8000-00000000cda2'),
  ('enf',   '00000000-0000-4000-8000-00000000cd12'),
  ('tec',   '00000000-0000-4000-8000-00000000cd13'),
  ('tec2',  '00000000-0000-4000-8000-00000000cd14');
GRANT SELECT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok); RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@checkin-curta.local' FROM ids WHERE nome IN ('enf', 'tec', 'tec2');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('enf', 'tec', 'tec2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do check-in');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('semgps'), pg_temp.id('org'), 'UPA sem coordenadas', 'hospital');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, latitude, longitude, raio_metros)
VALUES (pg_temp.id('comgps'), pg_temp.id('org'), 'UPA com coordenadas', 'hospital', -16.6869, -49.2648, 500);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('s1'), pg_temp.id('semgps'), 'Pronto Socorro', 'outro'),
  (pg_temp.id('s2'), pg_temp.id('comgps'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enf'),  pg_temp.id('semgps'), 'enfermeiro'),
  (pg_temp.id('tec'),  pg_temp.id('comgps'), 'tecnico_enfermagem'),
  (pg_temp.id('tec2'), pg_temp.id('comgps'), 'tecnico_enfermagem');
-- os três de plantão agora. A data é a do plantão em curso: das 00h às 07h de
-- Brasília a noite começou ONTEM (data_atual() + 'noite' daria 19h de hoje,
-- no futuro). Menos 7 h dá a data certa nos três turnos.
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT u, s, p, ((now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 hours')::date, private.turno_atual()
  FROM (VALUES (pg_temp.id('semgps'), pg_temp.id('s1'), pg_temp.id('enf')),
               (pg_temp.id('comgps'), pg_temp.id('s2'), pg_temp.id('tec')),
               (pg_temp.id('comgps'), pg_temp.id('s2'), pg_temp.id('tec2'))) x(u, s, p);

SET LOCAL ROLE authenticated;

SELECT pg_temp.como('enf');
SELECT pg_temp.ok(public.registrar_checkin(pg_temp.id('semgps'), NULL, NULL, NULL, 'Trânsito') IS NOT NULL,
  'B4: unidade sem coordenadas: justificativa curta é aceita (antes CHECKIN_JUSTIFICATIVA_CURTA)');
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(public.registrar_checkin(pg_temp.id('comgps'), -16.6870, -49.2649, NULL, 'curta') IS NOT NULL,
  'B4: dentro do raio a justificativa não é pedida; a curta não barra');
SELECT pg_temp.como('tec2');
SELECT pg_temp.falha(format('SELECT public.registrar_checkin(%L, -16.70, -49.30, NULL, %L)', pg_temp.id('comgps'), 'gps'),
  'CHECKIN_JUSTIFICATIVA_CURTA', 'fora do raio, a justificativa continua com 10 letras no mínimo');
SELECT pg_temp.falha(format('SELECT public.registrar_checkin(%L, NULL, NULL)', pg_temp.id('comgps')),
  'CHECKIN_SEM_LOCALIZACAO', 'sem localização e sem justificativa continua recusado');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
