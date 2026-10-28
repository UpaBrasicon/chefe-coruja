-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270202000003_escala_gestor_categorias.sql (aba Escala, E2)
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_gestor_categorias.sql
--
-- O gestor escala todas as categorias e a cobertura é por categoria:
--  * profissionais_da_unidade lista um por papel (dois papéis, duas linhas) e
--    só para o gestor;
--  * adicionar_plantao_escala grava a categoria escolhida e recusa a que a
--    pessoa não tem;
--  * marcar_vaga_escala marca vaga de uma categoria mesmo com outra escalada, e
--    recusa quando já há alguém da mesma;
--  * escala_mes_gestor: a vaga do técnico fica aberta com enfermeiro escalado e
--    fecha quando um técnico é escalado; a vaga sem categoria segue como antes;
--  * vagas_abertas: a vaga do técnico aparece para o técnico, não para o médico;
--  * o envio ao ERP leva só o plantão de plantonista.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-00000000a001'),
  ('uni',   '00000000-0000-4000-8000-00000000a00a'),
  ('setor', '00000000-0000-4000-8000-00000000a0a1'),
  ('gest',  '00000000-0000-4000-8000-00000000a101'),  -- gestor
  ('med',   '00000000-0000-4000-8000-00000000a102'),  -- plantonista
  ('enf',   '00000000-0000-4000-8000-00000000a103'),  -- enfermeiro
  ('tec',   '00000000-0000-4000-8000-00000000a104'),  -- técnico de enfermagem
  ('duplo', '00000000-0000-4000-8000-00000000a105');  -- plantonista e enfermeiro
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
CREATE FUNCTION pg_temp.dia() RETURNS date LANGUAGE sql AS $$ SELECT private.data_atual() + 3 $$;
-- a faixa da manhã do dia de teste, como a tela do gestor recebe
CREATE FUNCTION pg_temp.faixa() RETURNS jsonb LANGUAGE sql AS $$
  SELECT f FROM jsonb_array_elements(public.escala_mes_gestor(pg_temp.id('uni'),
           extract(year FROM pg_temp.dia())::int, extract(month FROM pg_temp.dia())::int) -> 'faixas') f
   WHERE f ->> 'data' = pg_temp.dia()::text AND f ->> 'turno' = 'manha' AND f ->> 'setor_id' = pg_temp.id('setor')::text
$$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text), pg_temp.dia(), pg_temp.faixa() TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@escala-gestor.local' FROM ids WHERE nome IN ('gest', 'med', 'enf', 'tec', 'duplo');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'enf', 'tec', 'duplo')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da escala do gestor');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do gestor', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'),  pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('med'),   pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('enf'),   pg_temp.id('uni'), 'enfermeiro'),
  (pg_temp.id('tec'),   pg_temp.id('uni'), 'tecnico_enfermagem'),
  (pg_temp.id('duplo'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('duplo'), pg_temp.id('uni'), 'enfermeiro');

SET LOCAL ROLE authenticated;

-- ── 1. quem o gestor pode escalar ──────────────────────────────────────────
SELECT pg_temp.como('gest');
SELECT pg_temp.ok((SELECT count(*) FROM public.profissionais_da_unidade(pg_temp.id('uni')) WHERE perfil_id = pg_temp.id('duplo')) = 2
                  AND NOT EXISTS (SELECT 1 FROM public.profissionais_da_unidade(pg_temp.id('uni')) WHERE perfil_id = pg_temp.id('gest')),
  'profissionais_da_unidade: quem tem dois papéis aparece duas vezes, o gestor não aparece');
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT * FROM public.profissionais_da_unidade(%L)', pg_temp.id('uni')),
  'Acesso negado', 'profissionais_da_unidade é só do gestor');

-- ── 2. escalar com categoria ───────────────────────────────────────────────
SELECT pg_temp.como('gest');
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('duplo'), pg_temp.dia() + 1, 'manha', NULL, false, 'enfermeiro');
SELECT pg_temp.ok((SELECT papel = 'enfermeiro' FROM public.escala_plantao WHERE perfil_id = pg_temp.id('duplo') AND data = pg_temp.dia() + 1),
  'quem tem dois papéis é escalado na categoria escolhida');
SELECT pg_temp.falha(format($q$SELECT public.adicionar_plantao_escala(%L, %L, %L, %L, 'tarde', NULL, false, 'tecnico_enfermagem')$q$,
                            pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'), pg_temp.dia() + 1),
  'Este profissional não tem o papel', 'categoria que a pessoa não tem é recusada');

-- ── 3. vaga por categoria ──────────────────────────────────────────────────
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('enf'), pg_temp.dia(), 'manha', NULL, false, 'enfermeiro');
SELECT pg_temp.ok(public.marcar_vaga_escala(pg_temp.id('setor'), pg_temp.dia(), 'manha', NULL, 'tecnico_enfermagem') IS NOT NULL,
  'vaga de técnico marcada na faixa que já tem enfermeiro');
SELECT pg_temp.falha(format($q$SELECT public.marcar_vaga_escala(%L, %L, 'manha', NULL, 'enfermeiro')$q$, pg_temp.id('setor'), pg_temp.dia()),
  'Esta faixa já tem enfermeiro escalado', 'vaga de enfermeiro recusada com enfermeiro escalado');

-- ── 4. cobertura por categoria no mês do gestor ────────────────────────────
SELECT pg_temp.ok(pg_temp.faixa() ->> 'situacao' = 'vaga'
                  AND pg_temp.faixa() -> 'abertas' -> 0 ->> 'papel' = 'tecnico_enfermagem'
                  AND jsonb_array_length(pg_temp.faixa() -> 'abertas') = 1
                  AND pg_temp.faixa() -> 'escalados' -> 0 ->> 'papel' = 'enfermeiro',
  'mês do gestor: com enfermeiro escalado, a vaga de técnico continua aberta');
SELECT pg_temp.ok((SELECT r -> 'categorias' @> '["plantonista", "enfermeiro", "tecnico_enfermagem"]'::jsonb
                     FROM public.escala_mes_gestor(pg_temp.id('uni'), extract(year FROM pg_temp.dia())::int, extract(month FROM pg_temp.dia())::int) r),
  'mês do gestor: devolve as categorias da unidade');

-- ── 5. vagas abertas por categoria ─────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.vagas_abertas() WHERE setor_id = pg_temp.id('setor') AND data = pg_temp.dia()),
  'vagas_abertas: o técnico vê a vaga de técnico');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.vagas_abertas() WHERE setor_id = pg_temp.id('setor') AND data = pg_temp.dia()),
  'vagas_abertas: o médico não vê a vaga de técnico');

-- ── 6. a vaga fecha quando um técnico é escalado ──────────────────────────
SELECT pg_temp.como('gest');
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('tec'), pg_temp.dia(), 'manha', NULL, false, 'tecnico_enfermagem');
SELECT pg_temp.ok(pg_temp.faixa() ->> 'situacao' = 'coberto' AND jsonb_array_length(pg_temp.faixa() -> 'abertas') = 0,
  'mês do gestor: com técnico escalado, a faixa fica coberta');
SELECT pg_temp.como('tec');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.vagas_abertas() WHERE setor_id = pg_temp.id('setor') AND data = pg_temp.dia()),
  'vagas_abertas: a vaga de técnico some quando um técnico é escalado');

-- ── 7. ERP só com plantão de plantonista ───────────────────────────────────
SELECT pg_temp.como('gest');
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'), pg_temp.dia(), 'tarde', NULL, false, 'plantonista');
RESET ROLE;
-- (lido sem a RLS: os avisos só são visíveis ao próprio destinatário)
SELECT pg_temp.ok((SELECT count(*) FROM public.notificacoes_plantonista WHERE unidade_id = pg_temp.id('uni') AND tipo LIKE 'vaga_%') = 1
                  AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('tec') AND tipo LIKE 'vaga_%'),
  'o aviso da vaga de técnico vai só para o técnico');
SELECT pg_temp.ok((SELECT array_agg(DISTINCT l -> 'profissional' ->> 'id')
                     FROM jsonb_array_elements(private.plantoes_erp_linhas(pg_temp.id('uni'), to_char(pg_temp.dia(), 'YYYYMM'))) l)
                  = ARRAY[pg_temp.id('med')::text],
  'ERP: só o plantão de plantonista entra no envio');

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
