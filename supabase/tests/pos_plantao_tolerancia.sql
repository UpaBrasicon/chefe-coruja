-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20261022000018_pos_plantao_20min_liberacao_gestor.sql
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/pos_plantao_tolerancia.sql
--
-- Decisão do RT (03/10/2026): 20 min de tolerância depois do fim do plantão
-- (só com check-in feito); passados os 20 min, a porta do servidor fecha; o
-- gestor libera a continuidade com liberar_pos_plantao.
-- O portão é private.setores_na_escala_agora() (todas as portas de escrita).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000d001'),
  ('uni',    '00000000-0000-4000-8000-00000000d00a'),
  ('setor',  '00000000-0000-4000-8000-00000000d0a1'),
  ('gestor', '00000000-0000-4000-8000-00000000d101'),
  ('med',    '00000000-0000-4000-8000-00000000d102');  -- plantonista cujo turno acabou
GRANT SELECT ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
-- escrevo no setor? é o portão real das escritas (cuido_da_internacao, medico_na_porta)
CREATE FUNCTION pg_temp.no_setor() RETURNS boolean LANGUAGE sql AS $$
  SELECT pg_temp.id('setor') IN (SELECT private.setores_na_escala_agora())
$$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.ok(boolean, text),
  pg_temp.falha(text, text, text), pg_temp.no_setor() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@pos.local' FROM ids WHERE nome IN ('gestor', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, nome FROM ids WHERE nome IN ('gestor', 'med') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org pós-plantão');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA pós-plantão', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'PS adulto', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gestor'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),    pg_temp.id('uni'), 'plantonista');
-- segundo fator confirmado para as RPCs que o exigem
INSERT INTO auth.sessions (id, user_id, aal) VALUES
  (gen_random_uuid(), pg_temp.id('gestor'), 'aal2'), (gen_random_uuid(), pg_temp.id('med'), 'aal2');

-- plantão do 'med' que terminou há 10 min (turno de 6 h que começou há 6h10)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES (pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'), (now() - interval '6 hours')::date, 'manha',
        now() - interval '6 hours' - interval '10 minutes', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio + interval '2 minutes'
  FROM public.escala_plantao e WHERE e.perfil_id = pg_temp.id('med');

SET LOCAL ROLE authenticated;
-- 1. 10 min depois do fim, com check-in: dentro dos 20 min, porta aberta
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.no_setor(), '10 min depois do fim, com check-in: a porta segue aberta (tolerância de 20 min)');
SELECT pg_temp.ok((SELECT (s ->> 'liberado')::boolean FROM public.situacao_checkin(pg_temp.id('uni')) s),
  'situacao_checkin: liberado durante a tolerância de 20 min');
RESET ROLE;

-- 2. empurra o fim para 30 min atrás: passou dos 20 min, porta fechada
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
UPDATE public.escala_plantao SET inicio = now() - interval '6 hours' - interval '30 minutes'
 WHERE perfil_id = pg_temp.id('med');
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(NOT pg_temp.no_setor(), '30 min depois do fim: passada a tolerância de 20 min, a porta fecha mesmo com check-in');
RESET ROLE;

-- 3. gestor libera: a porta reabre; só o gestor pode
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.liberar_pos_plantao(%L, %L, 30, %L)', pg_temp.id('uni'), pg_temp.id('med'), 'médico ainda prescrevendo'),
  'Acesso negado: a liberação é do gestor', 'o próprio plantonista não se libera');
SELECT pg_temp.como('gestor');
SELECT pg_temp.falha(format('SELECT public.liberar_pos_plantao(%L, %L, 3, %L)', pg_temp.id('uni'), pg_temp.id('med'), 'curto demais'),
  'A liberação vale de 5 a 120 minutos', 'minutos fora de 5 a 120 recusado');
SELECT pg_temp.falha(format('SELECT public.liberar_pos_plantao(%L, %L, 30, %L)', pg_temp.id('uni'), pg_temp.id('med'), 'curto'),
  'Informe o motivo da liberação', 'motivo curto recusado');
SELECT public.liberar_pos_plantao(pg_temp.id('uni'), pg_temp.id('med'), 30, 'Médico terminando a evolução da UTI');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.no_setor(), 'depois da liberação do gestor, a porta reabre');
RESET ROLE;

-- 4. o gestor vê a liberação ativa na lista de presenças
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gestor');
SELECT pg_temp.ok((SELECT liberado_pos_ate > now() FROM public.presencas_do_dia_gestor(pg_temp.id('uni')) WHERE perfil_id = pg_temp.id('med')),
  'presencas_do_dia_gestor mostra a liberação ativa');
RESET ROLE;

-- 5. liberação vencida não abre a porta
UPDATE public.liberacao_pos_plantao SET concedido_em = now() - interval '2 minutes', expira_em = now() - interval '1 minute' WHERE perfil_id = pg_temp.id('med');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(NOT pg_temp.no_setor(), 'liberação vencida não mantém a porta aberta');
RESET ROLE;

ROLLBACK;
