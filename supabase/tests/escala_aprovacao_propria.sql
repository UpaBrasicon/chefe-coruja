-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000018_escala_aprovacao_propria.sql (médio M9 do
-- teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md; decisão
-- do RT em 31/10/2026: "Pode, com 2º fator")
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_aprovacao_propria.sql
--
-- O gestor que também está escalado aprova a própria passagem ou troca só com
-- o 2º fator, e o histórico e a auditoria dizem "aprovou o próprio pedido". O
-- pedido dos outros continua como antes.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
-- a plataforma exige o 2º fator (como em fase1_segundo_fator.sql)
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000d401'),
  ('uni',    '00000000-0000-4000-8000-00000000d40a'),
  ('setor',  '00000000-0000-4000-8000-00000000d4a1'),
  ('gestor', '00000000-0000-4000-8000-00000000d411'),  -- gestor e plantonista
  ('med',    '00000000-0000-4000-8000-00000000d412'),
  ('med2',   '00000000-0000-4000-8000-00000000d413'),
  ('pG',     '00000000-0000-4000-8000-00000000d421'),
  ('pG2',    '00000000-0000-4000-8000-00000000d422'),
  ('pM',     '00000000-0000-4000-8000-00000000d423'),
  ('pM2',    '00000000-0000-4000-8000-00000000d424');
GRANT SELECT, INSERT ON ids TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
-- sessão de quem: aal1 sem TOTP, ou aal2 com TOTP há p_min minutos
CREATE FUNCTION pg_temp.como(quem text, aal text DEFAULT 'aal1', p_min int DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', pg_temp.id(quem), 'role', 'authenticated', 'aal', aal,
    'amr', CASE WHEN p_min IS NULL
                THEN json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint))
                ELSE json_build_array(
                  json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint),
                  json_build_object('method', 'totp', 'timestamp', extract(epoch FROM now() - make_interval(mins => p_min))::bigint))
           END)::text, true);
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
CREATE FUNCTION pg_temp.hist(p_plantao text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.historico_escala WHERE plantao_id = pg_temp.id(p_plantao) AND acao = 'aprovou_proprio_pedido' $$;
CREATE FUNCTION pg_temp.audit(p_entidade text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.log_auditoria WHERE unidade_id = pg_temp.id('uni') AND entidade = p_entidade AND acao = 'aprovou_proprio_pedido' $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text, text, int), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text), pg_temp.hist(text), pg_temp.audit(text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@aprovacao-propria.local' FROM ids WHERE nome IN ('gestor', 'med', 'med2');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gestor', 'med', 'med2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da aprovação própria');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da aprovação própria', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gestor'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('gestor'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med'),    pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'),   pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, papel) VALUES
  (pg_temp.id('pG'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('gestor'), private.data_atual() + 3, 'manha', 'plantonista'),
  (pg_temp.id('pG2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('gestor'), private.data_atual() + 5, 'manha', 'plantonista'),
  (pg_temp.id('pM'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),    private.data_atual() + 4, 'tarde', 'plantonista'),
  (pg_temp.id('pM2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),    private.data_atual() + 6, 'tarde', 'plantonista');

SET LOCAL ROLE authenticated;
-- os pedidos: o gestor passa o pG para med e pede a troca pG2 × pM2; med passa o pM para med2
SELECT pg_temp.como('gestor', 'aal2', 5);
INSERT INTO ids SELECT 'sG', public.passar_plantao(pg_temp.id('pG'), pg_temp.id('med'), NULL);
INSERT INTO ids SELECT 'tG', public.solicitar_troca(pg_temp.id('pG2'), pg_temp.id('pM2'), NULL);
SELECT pg_temp.como('med');
INSERT INTO ids SELECT 'sM', public.passar_plantao(pg_temp.id('pM'), pg_temp.id('med2'), NULL);
SELECT public.aceitar_passagem(pg_temp.id('sG'));
SELECT public.aceitar_troca(pg_temp.id('tG'));
SELECT pg_temp.como('med2');
SELECT public.aceitar_passagem(pg_temp.id('sM'));

-- a própria passagem: sem o 2º fator não aprova; com ele aprova e registra
SELECT pg_temp.como('gestor', 'aal1');
SELECT pg_temp.falha(format($q$UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = %L WHERE id = %L$q$,
  pg_temp.id('gestor'), pg_temp.id('sG')), 'SEGUNDO_FATOR', 'M9: o gestor não aprova a própria passagem sem o 2º fator');
SELECT pg_temp.ok((SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id('pG')) = pg_temp.id('gestor'),
  'sem o 2º fator, o plantão continua com o gestor');
-- o pedido dos outros continua sem 2º fator
UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = pg_temp.id('gestor') WHERE id = pg_temp.id('sM');
SELECT pg_temp.ok((SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id('pM')) = pg_temp.id('med2') AND pg_temp.hist('pM') = 0,
  'o gestor aprova a passagem dos outros como antes, sem o registro de próprio pedido');

SELECT pg_temp.como('gestor', 'aal2', 5);
UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = pg_temp.id('gestor') WHERE id = pg_temp.id('sG');
SELECT pg_temp.ok((SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id('pG')) = pg_temp.id('med'),
  'M9: com o 2º fator, o gestor aprova a própria passagem');
SELECT pg_temp.ok(pg_temp.hist('pG') = 1 AND pg_temp.audit('solicitacoes_escala') = 1,
  'M9: o histórico e a auditoria dizem que ele aprovou o próprio pedido');

-- a própria troca: o mesmo
SELECT pg_temp.como('gestor', 'aal1');
SELECT pg_temp.falha(format('SELECT public.aprovar_troca(%L)', pg_temp.id('tG')), 'SEGUNDO_FATOR',
  'M9: o gestor não aprova a própria troca sem o 2º fator');
SELECT pg_temp.como('gestor', 'aal2', 5);
SELECT public.aprovar_troca(pg_temp.id('tG'));
SELECT pg_temp.ok((SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id('pG2')) = pg_temp.id('med')
  AND pg_temp.hist('pG2') = 1 AND pg_temp.audit('trocas_plantao') = 1,
  'M9: com o 2º fator, o gestor aprova a própria troca, com o registro');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
