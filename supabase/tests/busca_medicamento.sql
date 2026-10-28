-- Testes da migration 20270203000001_busca_medicamento.sql (ponto 11 do
-- plantonista): busca com sinônimo, várias palavras e apresentação; sinônimo
-- preso à concentração; filtro da unidade; sinônimo não se grava pela API; e
-- o que falta para prescrever, igual à trava do servidor. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000005';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005',
        private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.perfil_id = '10000000-0000-4000-8000-000000000005' AND e.ativo
ON CONFLICT DO NOTHING;

-- itens com nomes que o seed não tem: a busca só pode achar estes
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte, unidades_locais) VALUES
  ('Cloreto de testio', 'cloreto de testio', 'solução injetável, bolsa 500 mL', '0,9%', 'teste-busca', NULL),
  ('Cloreto de testio', 'cloreto de testio', 'solução injetável, ampola 10 mL', '20%', 'teste-busca', NULL),
  ('Amoxitestina + clavutestato', 'amoxitestina clavutestato', 'comprimido', '875 mg + 125 mg', 'teste-busca', NULL),
  ('Dipitestona', 'dipitestona', 'solução oral gotas', '500 mg/mL', 'teste-busca', NULL),
  ('Dipitestona', 'dipitestona', 'comprimido', '500 mg', 'teste-busca', NULL),
  ('Testinol', 'testinol', 'comprimido', '5 mg', 'teste-busca', NULL),
  ('Noratestina', 'noratestina', 'ampola 4 mL', '1 mg/mL', 'teste-busca', NULL),
  ('Localtestina', 'localtestina', 'comprimido', '10 mg', 'teste-busca', ARRAY['00000000-0000-4000-8000-0000000b0b01']::uuid[]);
INSERT INTO public.medicamento_sinonimo (principio_ativo_norm, concentracao, termo, termo_norm, tipo, fonte) VALUES
  ('cloreto de testio', '0,9 %', 'SFT 0,9%', 'sft 0 9', 'sigla', 'teste-busca'),
  ('dipitestona', NULL, 'Metatestol', 'metatestol', 'sinonimo', 'teste-busca'),
  -- como norepinefrina/epinefrina: o sinônimo de um contém o do outro
  ('noratestina', NULL, 'Normetatestol', 'normetatestol', 'sinonimo', 'teste-busca');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.pesar(p_pac uuid, p_kg numeric, p_quando timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  SELECT private.inserir_observacao_sincronizada(gen_random_uuid(), '21000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004', p_quando, false, NULL,
    jsonb_build_object('paciente_id', p_pac, 'conceito_id', (SELECT id FROM public.conceito WHERE nome = 'peso' AND unidade_id IS NULL),
                       'valor_num', p_kg, 'metodo', 'aferido')) $$;
GRANT EXECUTE ON FUNCTION pg_temp.pesar(uuid, numeric, timestamptz) TO authenticated;
-- resultado da busca como texto: "principio [concentracao] casou" separados por " | "
CREATE FUNCTION pg_temp.b(p_unidade uuid, p_q text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg((e ->> 'principio_ativo') || ' [' || coalesce(e ->> 'concentracao', '') || ']'
                             || coalesce(' ' || (e ->> 'casou_por'), ''), ' | '), '')
    FROM jsonb_array_elements(public.buscar_medicamento(p_unidade, p_q)) e $$;
GRANT EXECUTE ON FUNCTION pg_temp.b(uuid, text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t VALUES ('u1', '21000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Paciente Da Busca","data_nascimento":"1980-02-02"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
UPDATE public.episodios SET chegada_em = now() - interval '3 hours' WHERE id = pg_temp.u('ep');
-- peso de um atendimento anterior: não vale para prescrever
SELECT pg_temp.pesar(pg_temp.u('pac'), 70, now() - interval '5 days');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE v text; f jsonb;
BEGIN
  -- sinônimo preso à concentração: só a bolsa a 0,9 %, nunca a ampola a 20 %
  v := pg_temp.b(pg_temp.u('u1'), 'sft');
  IF v <> 'Cloreto de testio [0,9%] SFT 0,9%' THEN RAISE EXCEPTION 'FALHOU: sigla presa à concentração — %', v; END IF;
  RAISE NOTICE 'OK  sigla acha só a concentração dela, com o termo em casou_por';
  -- sinônimo do princípio ativo: as duas apresentações
  v := pg_temp.b(pg_temp.u('u1'), 'metatestol');
  IF v <> 'Dipitestona [500 mg] Metatestol | Dipitestona [500 mg/mL] Metatestol' THEN RAISE EXCEPTION 'FALHOU: sinônimo do princípio ativo — %', v; END IF;
  RAISE NOTICE 'OK  sinônimo vale para todas as apresentações, e só pelo começo da palavra (Normetatestol fica de fora)';
  v := pg_temp.b(pg_temp.u('u1'), 'normetatestol');
  IF v <> 'Noratestina [1 mg/mL] Normetatestol' THEN RAISE EXCEPTION 'FALHOU: sinônimo inteiro — %', v; END IF;
  -- várias palavras, em qualquer ordem
  v := pg_temp.b(pg_temp.u('u1'), 'clavutest amoxites');
  IF v <> 'Amoxitestina + clavutestato [875 mg + 125 mg]' THEN RAISE EXCEPTION 'FALHOU: palavras fora de ordem — %', v; END IF;
  RAISE NOTICE 'OK  duas palavras fora de ordem';
  -- a apresentação também conta
  v := pg_temp.b(pg_temp.u('u1'), 'dipitestona gotas');
  IF v <> 'Dipitestona [500 mg/mL]' THEN RAISE EXCEPTION 'FALHOU: apresentação — %', v; END IF;
  RAISE NOTICE 'OK  nome com apresentação';
  -- o que começa com o texto vem antes do que só o contém
  v := pg_temp.b(pg_temp.u('u1'), 'testi');
  IF v NOT LIKE 'Testinol [5 mg] | %' OR v NOT LIKE '%Cloreto de testio%' THEN RAISE EXCEPTION 'FALHOU: ordem por relevância — %', v; END IF;
  RAISE NOTICE 'OK  o que começa com o texto vem primeiro';
  -- item local de outra unidade não aparece; na unidade dele, aparece
  IF pg_temp.b(pg_temp.u('u1'), 'localtestina') <> '' THEN RAISE EXCEPTION 'FALHOU: item local de outra unidade apareceu'; END IF;
  IF pg_temp.b('00000000-0000-4000-8000-0000000b0b01', 'localtestina') <> 'Localtestina [10 mg]' THEN RAISE EXCEPTION 'FALHOU: item local sumiu na própria unidade'; END IF;
  IF pg_temp.b(NULL, 'localtestina') <> '' THEN RAISE EXCEPTION 'FALHOU: item local apareceu sem unidade'; END IF;
  RAISE NOTICE 'OK  filtro da unidade';
  -- texto curto demais não busca
  IF public.buscar_medicamento(pg_temp.u('u1'), 'x') <> '[]'::jsonb THEN RAISE EXCEPTION 'FALHOU: uma letra buscou'; END IF;
  RAISE NOTICE 'OK  uma letra não busca';

  -- o que falta: só peso de outro atendimento = falta peso, e ele vem como anterior
  f := public.o_que_falta_para_prescrever(pg_temp.u('pac'));
  IF f -> 'falta' <> '["peso"]'::jsonb OR f -> 'peso' <> 'null'::jsonb OR (f -> 'peso_anterior' ->> 'valor')::numeric <> 70 THEN
    RAISE EXCEPTION 'FALHOU: falta peso com peso antigo — %', f;
  END IF;
  RAISE NOTICE 'OK  peso de outro atendimento não conta e volta como anterior';
END $$;
RESET ROLE;

-- igual à trava do servidor, antes e depois do peso de hoje
DO $$
BEGIN
  IF private.falta_para_prescrever(pg_temp.u('pac')) IS NULL THEN RAISE EXCEPTION 'FALHOU: a trava devia pedir peso'; END IF;
END $$;
SELECT pg_temp.pesar(pg_temp.u('pac'), 72, now() - interval '1 hour');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE f jsonb := public.o_que_falta_para_prescrever(pg_temp.u('pac'));
BEGIN
  IF f -> 'falta' <> '[]'::jsonb OR (f -> 'peso' ->> 'valor')::numeric <> 72 OR f -> 'peso_anterior' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: com peso de hoje nada falta — %', f;
  END IF;
  RAISE NOTICE 'OK  com peso de hoje nada falta';
END $$;
RESET ROLE;
DO $$
BEGIN
  IF private.falta_para_prescrever(pg_temp.u('pac')) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: a trava ainda pede algo'; END IF;
  RAISE NOTICE 'OK  o que falta bate com a trava do servidor';
END $$;

-- quem não cuida do paciente não pergunta; ninguém grava sinônimo pela API
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('00000000-0000-4000-8000-00000000dead');
SELECT pg_temp.falha(format('SELECT public.o_que_falta_para_prescrever(%L)', pg_temp.u('pac')), 'Acesso negado', 'estranho ao paciente não pergunta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($q$INSERT INTO public.medicamento_sinonimo (principio_ativo_norm, termo, termo_norm, tipo, fonte)
  VALUES ('dipitestona', 'X', 'xx', 'sigla', 'api')$q$, 'permission denied', 'sinônimo não se grava pela API');
RESET ROLE;
ROLLBACK;
