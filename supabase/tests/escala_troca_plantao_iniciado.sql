-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270208000014_escala_troca_plantao_iniciado.sql (bug
-- baixo B12 do teste ponta a ponta da escala, docs/escala/TESTE-E2E-2026-10-29.md;
-- decisão do RT em 31/10/2026: "Passa sim, troca não")
-- Banco local apenas. Tudo em transação com ROLLBACK.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_troca_plantao_iniciado.sql
--
-- Plantão que já começou não entra em troca: nem no pedido, nem no aceite do
-- colega, nem na aprovação. A passagem do plantão em curso continua valendo,
-- e o colega ainda recusa a troca.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-00000000cf01'),
  ('uni',    '00000000-0000-4000-8000-00000000cf0a'),
  ('setor',  '00000000-0000-4000-8000-00000000cfa1'),
  ('med',    '00000000-0000-4000-8000-00000000cf12'),
  ('med2',   '00000000-0000-4000-8000-00000000cf13'),
  ('med3',   '00000000-0000-4000-8000-00000000cf14'),
  ('aVelho', '00000000-0000-4000-8000-00000000cf20'),
  ('aCurso', '00000000-0000-4000-8000-00000000cf21'),
  ('aNovo',  '00000000-0000-4000-8000-00000000cf22'),
  ('aNovo2', '00000000-0000-4000-8000-00000000cf23'),
  ('aNovo3', '00000000-0000-4000-8000-00000000cf24'),
  ('bCurso', '00000000-0000-4000-8000-00000000cf31'),
  ('bNovo',  '00000000-0000-4000-8000-00000000cf32'),
  ('bNovo2', '00000000-0000-4000-8000-00000000cf33'),
  ('bNovo3', '00000000-0000-4000-8000-00000000cf34');
GRANT SELECT, INSERT ON ids TO authenticated;
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
-- põe o plantão em curso (começou há p_min minutos); o gatilho da janela recalcularia o início pelo turno
CREATE FUNCTION pg_temp.em_curso(p text, p_min int) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
  UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => p_min), duracao_min = 360 WHERE id = pg_temp.id(p);
  ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@troca-iniciado.local' FROM ids WHERE nome IN ('med', 'med2', 'med3');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('med', 'med2', 'med3')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org da troca iniciada');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA da troca iniciada', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('uni'), 'Pronto Socorro', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'),  pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'), 'plantonista'),
  (pg_temp.id('med3'), pg_temp.id('uni'), 'plantonista');
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('aVelho'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() - 3, 'manha'),
  (pg_temp.id('aCurso'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual(),     'manha'),
  (pg_temp.id('aNovo'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 3, 'manha'),
  (pg_temp.id('aNovo2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 5, 'manha'),
  (pg_temp.id('aNovo3'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med'),  private.data_atual() + 7, 'manha'),
  (pg_temp.id('bCurso'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual(),     'tarde'),
  (pg_temp.id('bNovo'),  pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 4, 'tarde'),
  (pg_temp.id('bNovo2'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 6, 'tarde'),
  (pg_temp.id('bNovo3'), pg_temp.id('uni'), pg_temp.id('setor'), pg_temp.id('med2'), private.data_atual() + 8, 'tarde');
SELECT pg_temp.em_curso('aCurso', 60);
SELECT pg_temp.em_curso('bCurso', 30);

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('aCurso'), pg_temp.id('bNovo')),
  'Um dos plantões da troca já começou', 'B12: meu plantão em curso não entra em troca');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('aNovo'), pg_temp.id('bCurso')),
  'Um dos plantões da troca já começou', 'B12: plantão do colega em curso não entra em troca');
SELECT pg_temp.falha(format('SELECT public.solicitar_troca(%L, %L, NULL)', pg_temp.id('aVelho'), pg_temp.id('bNovo')),
  'Um dos plantões da troca já terminou', 'B10 continua: plantão que já terminou não entra em troca');
INSERT INTO ids SELECT 't1', public.solicitar_troca(pg_temp.id('aNovo2'), pg_temp.id('bNovo2'), NULL);
INSERT INTO ids SELECT 't2', public.solicitar_troca(pg_temp.id('aNovo3'), pg_temp.id('bNovo3'), NULL);
SELECT pg_temp.ok((SELECT count(*) FROM ids WHERE nome IN ('t1', 't2')) = 2, 'troca de dois plantões futuros continua valendo');

-- o plantão começa depois do pedido: o colega não aceita mais, mas ainda recusa
RESET ROLE;
SELECT pg_temp.em_curso('aNovo2', 10);
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med2');
SELECT pg_temp.falha(format('SELECT public.aceitar_troca(%L)', pg_temp.id('t1')),
  'Um dos plantões da troca já começou', 'B12: o colega não aceita a troca de plantão que já começou');
SELECT public.recusar_troca(pg_temp.id('t1'), NULL);
SELECT pg_temp.ok((SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id('t1')) = 'recusado',
  'o colega ainda recusa a troca de plantão que já começou');
SELECT public.aceitar_troca(pg_temp.id('t2'));
SELECT pg_temp.ok((SELECT aceito_em IS NOT NULL FROM public.trocas_plantao WHERE id = pg_temp.id('t2')),
  'o colega aceita a troca de plantões futuros');

-- aceita, mas o plantão começa antes da coordenação aprovar: a aprovação não troca
RESET ROLE;
SELECT pg_temp.em_curso('bNovo3', 5);
SELECT pg_temp.falha(format('SELECT private.efetivar_troca(%L, %L)', pg_temp.id('t2'), pg_temp.id('med3')),
  'Um dos plantões da troca já começou', 'B12: a aprovação não troca plantão que já começou');
SELECT pg_temp.ok((SELECT perfil_id FROM public.escala_plantao WHERE id = pg_temp.id('bNovo3')) = pg_temp.id('med2')
  AND (SELECT status FROM public.trocas_plantao WHERE id = pg_temp.id('t2')) = 'pendente',
  'a aprovação recusada não mexe na escala');

-- passa sim: o plantão em curso continua podendo ser passado
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(public.passar_plantao(pg_temp.id('aCurso'), pg_temp.id('med3'), NULL) IS NOT NULL,
  'B12: o plantão em curso continua podendo ser passado');

RESET ROLE;
SELECT count(*) AS testes FROM resultado;
ROLLBACK;
