-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000010_escala_candidatura_faixa.sql (bug médio
-- M8 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_candidatura_faixa.sql
--
-- "Candidatar-se" na Escala geral do plantonista (faixa livre, sem vaga
-- marcada) passa pela RPC candidatar_faixa, com as conferências de
-- candidatar_vaga:
--  * o plantonista se candidata, também quem é gestor e plantonista (antes a
--    RLS barrava calada);
--  * barra dia que já passou, conflito de horário, faixa com plantonista,
--    candidatura repetida e quem não é plantonista.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000cb01'),
  ('uni',   '00000000-0000-4000-8000-00000000cb0a'),
  ('ps',    '00000000-0000-4000-8000-00000000cba1'),
  ('sv',    '00000000-0000-4000-8000-00000000cba2'),
  ('med',   '00000000-0000-4000-8000-00000000cb12'),
  ('gm',    '00000000-0000-4000-8000-00000000cb13'),
  ('enf',   '00000000-0000-4000-8000-00000000cb14'),
  ('med2',  '00000000-0000-4000-8000-00000000cb15');
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
CREATE FUNCTION pg_temp.cand(p_setor text, p_dias int, p_turno text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.candidatar_faixa(%L, private.data_atual() + %s, %L)', pg_temp.id(p_setor), p_dias, p_turno) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text), pg_temp.cand(text, int, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@candidatura-faixa.local' FROM ids WHERE nome IN ('med', 'gm', 'enf', 'med2');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('med', 'gm', 'enf', 'med2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da faixa');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da faixa', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('ps'), pg_temp.id('uni'), 'Pronto Socorro', 'outro'),
  (pg_temp.id('sv'), pg_temp.id('uni'), 'Sala Vermelha', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('gm'),   pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('gm'),   pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('enf'),  pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista');
-- med2 no PS de manhã em D+3 (faixa ocupada); med na Sala Vermelha de tarde em D+4 (conflito)
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med2'), private.data_atual() + 3, 'manha'),
  (pg_temp.id('uni'), pg_temp.id('sv'), pg_temp.id('med'),  private.data_atual() + 4, 'tarde');

SET LOCAL ROLE authenticated;

SELECT pg_temp.como('med');
SELECT pg_temp.ok(public.candidatar_faixa(pg_temp.id('ps'), private.data_atual() + 5, 'noite') IS NOT NULL, 'M8: o plantonista se candidata à faixa livre pela RPC');
SELECT pg_temp.falha(pg_temp.cand('ps', 5, 'noite'), 'Você já se candidatou a esta faixa', 'M8: candidatura repetida é barrada');
SELECT pg_temp.falha(pg_temp.cand('ps', -1, 'manha'), 'Este plantão já passou', 'M8: dia que já passou é barrado');
SELECT pg_temp.falha(pg_temp.cand('ps', 4, 'tarde'), 'Você já tem plantão nesse horário', 'M8: conflito com plantão em outro setor é barrado');
SELECT pg_temp.falha(pg_temp.cand('ps', 3, 'manha'), 'Esta faixa já tem plantonista escalado', 'M8: faixa com plantonista não é livre');
SELECT pg_temp.como('gm');
SELECT pg_temp.ok(public.candidatar_faixa(pg_temp.id('ps'), private.data_atual() + 6, 'tarde') IS NOT NULL,
  'M8: quem é gestor e plantonista se candidata (antes a RLS barrava calada)');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(pg_temp.cand('ps', 6, 'manha'), 'A candidatura pela Escala geral é do plantonista', 'M8: quem não é plantonista não se candidata à faixa');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
