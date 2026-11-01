-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000019_papel_mais_forte.sql (bug baixo B5 do
-- teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md; decisão
-- do RT em 31/10/2026: "Completar a lista", com teste de cada par afetado)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/papel_mais_forte.sql
--
-- private.papel_na_unidade devolve o papel mais forte de quem tem vários na
-- unidade. A ordem antiga (admin, gestor, plantonista, telemedicina,
-- enfermeiro, técnico, farmacêutico, recepção) não muda; depois da recepção
-- entram regulador, NIR, faturamento e os papéis de rede (secretaria,
-- regulação regional, faturamento da rede), nessa ordem.
--  * os 15 pares entre os papéis novos (antes, ordem indefinida) passam a ter
--    resultado certo — o vínculo do mais fraco é gravado primeiro, para o
--    teste falhar sem a migration;
--  * papel da lista antiga com papel novo: a lista antiga continua ganhando;
--  * os pares da lista antiga e o papel único não mudam.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-00000000d501'),
  ('uni', '00000000-0000-4000-8000-00000000d50a'),
  ('eu',  '00000000-0000-4000-8000-00000000d511');
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
-- grava os vínculos na ordem dada (o primeiro é o mais fraco) e devolve o papel mais forte
CREATE FUNCTION pg_temp.forte(p_papeis text[]) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p text;
BEGIN
  DELETE FROM public.vinculos WHERE perfil_id = pg_temp.id('eu') AND unidade_id = pg_temp.id('uni');
  FOREACH p IN ARRAY p_papeis LOOP
    INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('eu'), pg_temp.id('uni'), p::public.papel);
  END LOOP;
  RETURN private.papel_na_unidade(pg_temp.id('uni'));
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('eu'), 'eu@papel-forte.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('eu'), 'Muitos papéis')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org dos papéis');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA dos papéis', 'hospital');
-- papel de rede só na unidade Secretaria da organização: esta unidade faz esse papel no teste
INSERT INTO public.rede_modulo (organizacao_id, ativo, secretaria_unidade_id, alterado_por)
VALUES (pg_temp.id('org'), true, pg_temp.id('uni'), pg_temp.id('eu'));
SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('eu'), 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', pg_temp.id('eu')::text, true);

-- B5: cada par entre os papéis novos, o mais fraco gravado primeiro
DO $$
DECLARE
  ordem text[] := ARRAY['regulador', 'nir', 'faturamento', 'secretaria', 'regulacao_regional', 'faturamento_rede'];
  i int; j int; r text;
BEGIN
  FOR i IN 1 .. array_length(ordem, 1) LOOP
    FOR j IN i + 1 .. array_length(ordem, 1) LOOP
      r := pg_temp.forte(ARRAY[ordem[j], ordem[i]]);
      PERFORM pg_temp.ok(r = ordem[i], format('B5: %s com %s → %s (veio %s)', ordem[i], ordem[j], ordem[i], r));
    END LOOP;
  END LOOP;
END $$;

-- papel da lista antiga com papel novo: a lista antiga ganha, como antes
DO $$
DECLARE
  antigos text[] := ARRAY['admin', 'gestor', 'plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico', 'recepcao'];
  novos text[] := ARRAY['regulador', 'nir', 'faturamento', 'secretaria', 'regulacao_regional', 'faturamento_rede'];
  a text; n text;
BEGIN
  FOREACH a IN ARRAY antigos LOOP
    FOREACH n IN ARRAY novos LOOP
      PERFORM pg_temp.ok(pg_temp.forte(ARRAY[n, a]) = a, format('%s com %s → %s, como antes', a, n, a));
    END LOOP;
  END LOOP;
END $$;

-- a lista antiga e o papel único não mudam
SELECT pg_temp.ok(pg_temp.forte(ARRAY['recepcao', 'admin']) = 'admin', 'admin com recepção → admin');
SELECT pg_temp.ok(pg_temp.forte(ARRAY['plantonista', 'gestor']) = 'gestor', 'gestor com plantonista → gestor');
SELECT pg_temp.ok(pg_temp.forte(ARRAY['farmaceutico', 'enfermeiro']) = 'enfermeiro', 'enfermeiro com farmacêutico → enfermeiro');
SELECT pg_temp.ok(pg_temp.forte(ARRAY['nir']) = 'nir', 'papel único → ele mesmo');
SELECT pg_temp.ok(pg_temp.forte(ARRAY[]::text[]) = '', 'sem vínculo → vazio');

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
