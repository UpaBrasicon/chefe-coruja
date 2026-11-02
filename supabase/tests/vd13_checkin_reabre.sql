-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000009_checkin_reabre.sql (VD13 do lote "Virada
-- de data", BACKLOG.md). Tudo em transação com ROLLBACK.
--
-- Um segundo check-in no mesmo plantão cai na mesma linha de
-- presenca_plantonista (ON CONFLICT perfil, unidade, data, turno). O check-in
-- era trocado, mas o check-out antigo ficava: a presença reaberta já nascia
-- fechada e o novo check-out era recusado ("Check-out já realizado").
-- Aqui: check-in, check-out (marcado como automático, como o do fechamento das
-- presenças vencidas), check-in de novo e check-out de novo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-00000000d131'),
  ('upa', '00000000-0000-4000-8000-00000000d132'),
  ('set', '00000000-0000-4000-8000-00000000d133'),
  ('enf', '00000000-0000-4000-8000-00000000d134');
GRANT SELECT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE TEMP TABLE reg (n int PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON reg TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('enf'), 'enf@vd13.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('enf'), 'enf')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do VD13');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do VD13', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('set'), pg_temp.id('upa'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro');
-- de plantão agora; a data é a do plantão em curso (menos 7 h: a noite das
-- 00h às 07h começou ontem)
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
VALUES (pg_temp.id('upa'), pg_temp.id('set'), pg_temp.id('enf'),
        ((now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 hours')::date, private.turno_atual());

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');

INSERT INTO reg VALUES (1, public.registrar_checkin(pg_temp.id('upa'), NULL, NULL, NULL, 'sem GPS no teste'));
SELECT public.registrar_checkout((SELECT id FROM reg WHERE n = 1), -16.6870, -49.2649);

-- o fechamento das presenças vencidas marca o check-out como automático
RESET ROLE;
UPDATE public.presenca_plantonista SET checkout_automatico = true, checkout_dentro = true
 WHERE id = (SELECT id FROM reg WHERE n = 1);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');

INSERT INTO reg VALUES (2, public.registrar_checkin(pg_temp.id('upa'), NULL, NULL, NULL, 'sem GPS no teste'));
SELECT pg_temp.ok((SELECT id FROM reg WHERE n = 2) = (SELECT id FROM reg WHERE n = 1),
  'o segundo check-in no mesmo plantão reabre a mesma presença');
SELECT pg_temp.ok((SELECT checkout_em IS NULL AND checkout_lat IS NULL AND checkout_lng IS NULL
                          AND checkout_dentro IS NULL AND checkout_automatico = false
                     FROM public.presenca_plantonista WHERE id = (SELECT id FROM reg WHERE n = 2)),
  'VD13: a presença reaberta fica sem check-out (antes ficava o check-out antigo)');
SELECT public.registrar_checkout((SELECT id FROM reg WHERE n = 2), NULL, NULL);
SELECT pg_temp.ok((SELECT checkout_em IS NOT NULL AND checkout_automatico = false
                     FROM public.presenca_plantonista WHERE id = (SELECT id FROM reg WHERE n = 2)),
  'VD13: o novo check-out é aceito (antes: "Check-out já realizado")');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
