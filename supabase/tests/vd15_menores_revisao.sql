-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000011_menores_revisao.sql (VD15 do lote "Virada
-- de data", BACKLOG.md). Tudo em transação com ROLLBACK. O cenário é criado
-- aqui, sem depender do seed; roda também na homologação. O dia de Brasília é
-- trocado mexendo em private.data_atual() dentro da transação.
--
-- 1. implantacao_verificar e painel_organizacao: conferência da definição
--    (o cenário de cada um depende do seed).
-- 2. hermes_minhas_notificacoes: a janela de 7 dias é em dias de Brasília.
-- 3. gerar_notificacoes_turno: o aviso de 6 h de observação não se repete
--    quando a janela passa da meia-noite, e segue na lista.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-00000000d151'),
  ('upa', '00000000-0000-4000-8000-00000000d152'),
  ('obs', '00000000-0000-4000-8000-00000000d153'),
  ('enf', '00000000-0000-4000-8000-00000000d154'),
  ('pac', '00000000-0000-4000-8000-00000000d155');
GRANT SELECT ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('enf'), 'enf@vd15.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('enf'), 'Enfermeira do VD15')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org do VD15');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do VD15', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação adulto', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro');

-- ── 1. definição ────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  SELECT prosrc INTO f FROM pg_proc WHERE oid = 'private.implantacao_verificar(text, public.implantacoes)'::regprocedure;
  IF f LIKE '%i.d0::timestamptz%' OR f NOT LIKE '%(i.d0::timestamp AT TIME ZONE ''America/Sao_Paulo'')%' THEN
    RAISE EXCEPTION 'FALHOU: implantacao_verificar deveria contar as chegadas da meia-noite de Brasília do D0';
  END IF;
  SELECT prosrc INTO f FROM pg_proc WHERE oid = 'public.painel_organizacao(integer)'::regprocedure;
  IF f LIKE '%(now() - make_interval(days => v_dias))::date%' OR f NOT LIKE '%co.data > private.data_atual() - v_dias%' THEN
    RAISE EXCEPTION 'FALHOU: painel_organizacao deveria contar o censo em dias de Brasília';
  END IF;
  RAISE NOTICE 'OK  implantação e painel pelo dia de Brasília';
END $$;

-- ── 2. notificações do Hermes ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.data_atual() RETURNS date LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT date '2031-05-10' $$;
INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem) VALUES
  (pg_temp.id('enf'), pg_temp.id('upa'), '2031-05-02', 'vd15_fora', 'oito dias antes'),
  (pg_temp.id('enf'), pg_temp.id('upa'), '2031-05-03', 'vd15_dentro', 'sete dias antes');
DO $$
DECLARE
  tipos text;
BEGIN
  SELECT string_agg(tipo, ',' ORDER BY tipo) INTO tipos
    FROM public.hermes_minhas_notificacoes(pg_temp.id('enf'), pg_temp.id('upa'), 7);
  IF tipos IS DISTINCT FROM 'vd15_dentro' THEN
    RAISE EXCEPTION 'FALHOU: hermes_minhas_notificacoes de 7 dias em 10/05/2031 deveria ir até 03/05; veio %', tipos;
  END IF;
  RAISE NOTICE 'OK  notificações do Hermes em dias de Brasília';
END $$;
DELETE FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('enf');
CREATE OR REPLACE FUNCTION private.data_atual() RETURNS date LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- ── 3. aviso de 6 h de observação na virada do dia ──────────────────────────
-- de plantão na observação agora, também na escala de ontem e de amanhã (a
-- troca de private.data_atual() abaixo não tira a enfermeira da escala)
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT pg_temp.id('upa'), pg_temp.id('obs'), pg_temp.id('enf'), d, private.turno_atual()
  FROM generate_series(((now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 hours')::date - 1,
                       ((now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 hours')::date + 1, interval '1 day') d;
-- check-in feito no plantão de agora
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, criado_por)
SELECT unidade_id, id, perfil_id, data, turno, now(), perfil_id FROM public.escala_plantao
 WHERE perfil_id = pg_temp.id('enf') AND data = ((now() AT TIME ZONE 'America/Sao_Paulo') - interval '7 hours')::date;
-- paciente há 5h35 em observação: janela do aviso de 30 min
INSERT INTO public.pacientes (id, unidade_id, nome, setor_id, created_at)
VALUES (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente do VD15', pg_temp.id('obs'), now() - interval '5 hours 35 minutes');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('enf'), 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', pg_temp.id('enf')::text, true);
SELECT count(*) FROM public.gerar_notificacoes_turno(pg_temp.id('upa'));
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('enf') AND tipo LIKE 'obs\_30min\_%') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: o aviso de 30 min deveria ser gravado uma vez';
  END IF;
  RAISE NOTICE 'OK  aviso de 30 min gravado';
END $$;

-- passou da meia-noite: o dia de Brasília é o seguinte
CREATE OR REPLACE FUNCTION private.data_atual() RETURNS date LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1 $$;
CREATE TEMP TABLE lista (id uuid, tipo text, mensagem text, created_at timestamptz) ON COMMIT DROP;
GRANT ALL ON lista TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO lista SELECT * FROM public.gerar_notificacoes_turno(pg_temp.id('upa'));
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('enf') AND tipo LIKE 'obs\_30min\_%') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: depois da meia-noite o aviso de 30 min foi gravado de novo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lista WHERE tipo LIKE 'obs\_30min\_%') THEN
    RAISE EXCEPTION 'FALHOU: depois da meia-noite o aviso de 30 min sumiu da lista';
  END IF;
  RAISE NOTICE 'OK  aviso de 6 h de observação não se repete na virada do dia';
END $$;

SELECT 'vd15 ok' AS resultado;
ROLLBACK;
