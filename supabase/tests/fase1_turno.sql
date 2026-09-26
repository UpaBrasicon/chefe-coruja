-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20260926000003_fase1_turno_como_janela.sql
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase1_turno.sql
--
-- O teste não depende da hora em que roda: as janelas são montadas em volta
-- de now(), com o gatilho desligado só dentro desta transação.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-000000000001'),
  ('uni',   '00000000-0000-4000-8000-00000000000a'),
  ('setor', '00000000-0000-4000-8000-0000000000a1'),
  ('noite', '00000000-0000-4000-8000-000000000102'),
  ('prox',  '00000000-0000-4000-8000-000000000103');
GRANT SELECT ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@turno.local' FROM ids WHERE nome IN ('noite', 'prox');
INSERT INTO public.perfis (id, nome_completo) SELECT id, nome FROM ids WHERE nome IN ('noite', 'prox') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'U', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Clínica', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('noite'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('prox'),  pg_temp.id('uni'), 'plantonista');

-- 1. O gatilho monta a janela a partir de (data, turno).
DO $$
DECLARE r public.escala_plantao%ROWTYPE;
BEGIN
  INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
  VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('prox'), '2026-01-10', 'noite') RETURNING * INTO r;
  IF r.inicio <> '2026-01-10 19:00:00-03' OR r.duracao_min <> 720 THEN
    RAISE EXCEPTION 'FALHOU: noite legada deveria ser 19:00 por 12 h (veio % / %)', r.inicio, r.duracao_min;
  END IF;
  RAISE NOTICE 'OK  noite legada = 19h, 12 h';

  BEGIN
    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, duracao_min)
    VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('prox'), '2026-01-11', 'manha', 720);
    RAISE EXCEPTION 'FALHOU: manhã de 12 h deveria ser recusada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  manhã só tem 6 h';
  END;
  DELETE FROM public.escala_plantao WHERE perfil_id = pg_temp.id('prox');
END $$;

-- 2. O caso da meia-noite, independente do relógio: com o gatilho desligado
--    NESTA transação, a janela é posta em volta de now().
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
-- a) começou ontem, ainda em curso (a data NÃO é a de hoje)
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('noite'), private.data_atual() - 1, 'noite', now() - interval '5 hours', 720);
-- b) começa daqui a 3 horas, com a data de HOJE
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('prox'), private.data_atual(), 'noite', now() + interval '3 hours', 720);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

SET LOCAL ROLE authenticated;

SELECT pg_temp.como('noite');
DO $$ BEGIN
  IF private.na_escala_agora(pg_temp.id('uni')) IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: quem está na noite que começou ontem perdeu o acesso (defeito da meia-noite)';
  END IF;
  IF private.tem_plantao_agora(pg_temp.id('setor')) IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: tem_plantao_agora deveria ser verdadeiro no setor';
  END IF;
  IF (SELECT count(*) FROM public.meu_plantao_agora()) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: meu_plantao_agora deveria devolver o plantão em curso';
  END IF;
  RAISE NOTICE 'OK  plantão que atravessa a meia-noite mantém o acesso';
END $$;

SELECT pg_temp.como('prox');
DO $$ BEGIN
  IF private.na_escala_agora(pg_temp.id('uni')) IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: plantão que ainda não começou deu acesso (o outro lado do defeito)';
  END IF;
  IF private.tem_plantao_agora(pg_temp.id('setor')) IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: tem_plantao_agora deveria ser falso antes da janela';
  END IF;
  RAISE NOTICE 'OK  plantão que ainda não começou não dá acesso';
END $$;

-- 3. Check-in dentro da janela grava com a data e o rótulo DO PLANTÃO.
SELECT pg_temp.como('noite');
DO $$
DECLARE v uuid; r public.presenca_plantonista%ROWTYPE;
BEGIN
  v := public.registrar_checkin(pg_temp.id('uni'), NULL, NULL, NULL);
  SELECT * INTO r FROM public.presenca_plantonista WHERE id = v;
  IF r.data <> private.data_atual() - 1 OR r.turno <> 'noite' THEN
    RAISE EXCEPTION 'FALHOU: check-in deveria ficar em (ontem, noite), veio (%, %)', r.data, r.turno;
  END IF;
  RAISE NOTICE 'OK  check-in da noite fica no plantão que começou ontem';
END $$;

SELECT pg_temp.como('prox');
DO $$ BEGIN
  PERFORM public.registrar_checkin(pg_temp.id('uni'), NULL, NULL, NULL);
  RAISE EXCEPTION 'FALHOU: check-in antes da janela deveria ser recusado';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  check-in fora da janela é recusado';
END $$;

RESET ROLE;
ROLLBACK;
