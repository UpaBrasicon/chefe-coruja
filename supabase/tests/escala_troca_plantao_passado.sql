-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000013_escala_troca_plantao_passado.sql (bug
-- baixo B10 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_troca_plantao_passado.sql
--
-- A troca não aceita plantão que já terminou, nem o meu nem o do colega; a
-- troca de dois plantões futuros continua valendo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000ce01'),
  ('uni',   '00000000-0000-4000-8000-00000000ce0a'),
  ('setor', '00000000-0000-4000-8000-00000000cea1'),
  ('med',   '00000000-0000-4000-8000-00000000ce12'),
  ('med2',  '00000000-0000-4000-8000-00000000ce13'),
  ('aVelho','00000000-0000-4000-8000-00000000ce21'),
  ('aNovo', '00000000-0000-4000-8000-00000000ce22'),
  ('bVelho','00000000-0000-4000-8000-00000000ce23'),
  ('bNovo', '00000000-0000-4000-8000-00000000ce24');
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
SELECT id, nome || '@troca-passado.local' FROM ids WHERE nome IN ('med', 'med2');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('med', 'med2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da troca passada');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da troca passada', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('aVelho'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() - 3, 'manha'),
  (pg_temp.id('aNovo'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 3, 'manha'),
  (pg_temp.id('bVelho'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() - 2, 'tarde'),
  (pg_temp.id('bNovo'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 4, 'tarde');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('aVelho'), pg_temp.id('bNovo')),
  'Um dos plantões da troca já terminou', 'B10: meu plantão que já terminou não entra em troca');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('aNovo'), pg_temp.id('bVelho')),
  'Um dos plantões da troca já terminou', 'B10: plantão do colega que já terminou não entra em troca');
SELECT pg_temp.ok(public.solicitar_troca(pg_temp.id('aNovo'), pg_temp.id('bNovo'), NULL) IS NOT NULL, 'troca de dois plantões futuros continua valendo');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
