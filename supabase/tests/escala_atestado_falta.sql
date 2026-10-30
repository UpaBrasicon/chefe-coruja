-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000004_escala_atestado_falta.sql (bug alto A5 do
-- teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_atestado_falta.sql
--
-- Atestado anexado à justificativa de falta, no bucket privado atendimento:
--  * qualquer papel com vínculo ativo na unidade envia o próprio anexo para
--    <unidade>/justificativas/ (antes só gestor e plantonista);
--  * só na pasta das justificativas e só da própria unidade;
--  * o atestado é lido por quem enviou e pelo gestor da unidade; colega e
--    plantonista da unidade não leem;
--  * o resto do bucket continua como estava (plantonista envia e lê).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000c501'),
  ('uni',   '00000000-0000-4000-8000-00000000c50a'),
  ('uni2',  '00000000-0000-4000-8000-00000000c50b'),
  ('gest',  '00000000-0000-4000-8000-00000000c511'),
  ('enf',   '00000000-0000-4000-8000-00000000c512'),
  ('enf2',  '00000000-0000-4000-8000-00000000c513'),
  ('med',   '00000000-0000-4000-8000-00000000c514'),
  ('tec',   '00000000-0000-4000-8000-00000000c515');
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
-- envio como o Storage faz: o dono é quem está logado
CREATE FUNCTION pg_temp.envia(p_nome text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
  VALUES ('atendimento', p_nome, auth.uid(), auth.uid()::text) $$;
CREATE FUNCTION pg_temp.ve(p_nome text) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'atendimento' AND name = p_nome) $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text),
  pg_temp.envia(text), pg_temp.ve(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@atestado-falta.local' FROM ids WHERE nome IN ('gest', 'enf', 'enf2', 'med', 'tec');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'enf', 'enf2', 'med', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do atestado');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do atestado', 'hospital'),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA vizinha', 'hospital');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('enf'),  pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('enf2'), pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('tec'),  pg_temp.id('uni'), 'tecnico_enfermagem');
CREATE TEMP TABLE caminho (k text PRIMARY KEY, v text) ON COMMIT DROP;
GRANT SELECT ON caminho TO authenticated;
INSERT INTO caminho VALUES
  ('enf',   pg_temp.id('uni')  || '/justificativas/11111111-1111-4111-8111-111111111111-atestado.pdf'),
  ('tec',   pg_temp.id('uni')  || '/justificativas/22222222-2222-4222-8222-222222222222-atestado.pdf'),
  ('fora',  pg_temp.id('uni2') || '/justificativas/33333333-3333-4333-8333-333333333333-atestado.pdf'),
  ('outra', pg_temp.id('uni')  || '/prescricoes/44444444-4444-4444-8444-444444444444.pdf'),
  ('med',   pg_temp.id('uni')  || '/anexos/55555555-5555-4555-8555-555555555555.pdf');
CREATE FUNCTION pg_temp.c(p text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM caminho WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.c(text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. A5: outros papéis enviam o atestado ────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.envia(pg_temp.c('enf'));
SELECT pg_temp.ok(pg_temp.ve(pg_temp.c('enf')), 'A5: a enfermeira envia o atestado e vê o que enviou');
SELECT pg_temp.como('tec');
SELECT pg_temp.envia(pg_temp.c('tec'));
SELECT pg_temp.ok(pg_temp.ve(pg_temp.c('tec')), 'A5: o técnico envia o atestado');

-- ── 2. só na pasta das justificativas e só da própria unidade ─────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT pg_temp.envia(%L)', pg_temp.c('fora')),
  'new row violates row-level security policy', 'atestado na pasta de outra unidade: barrado');
SELECT pg_temp.falha(format('SELECT pg_temp.envia(%L)', pg_temp.c('outra')),
  'new row violates row-level security policy', 'a enfermeira não grava fora das justificativas');

-- ── 3. quem lê o atestado ─────────────────────────────────────────────────
SELECT pg_temp.como('enf2');
SELECT pg_temp.ok(NOT pg_temp.ve(pg_temp.c('enf')), 'a colega não lê o atestado da enfermeira');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(NOT pg_temp.ve(pg_temp.c('enf')), 'o plantonista da unidade não lê o atestado da enfermeira');
SELECT pg_temp.como('gest');
SELECT pg_temp.ok(pg_temp.ve(pg_temp.c('enf')) AND pg_temp.ve(pg_temp.c('tec')), 'o gestor da unidade lê os atestados');

-- ── 4. o resto do bucket como estava ──────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.envia(pg_temp.c('med'));
SELECT pg_temp.ok(pg_temp.ve(pg_temp.c('med')), 'o plantonista continua enviando e lendo fora das justificativas');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
