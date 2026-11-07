-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270302000001_cid_sugerido.sql (CID de referência a
-- partir da Avaliação; decisão do RT de 06/11/2026, A em C1 a C7).
-- Tudo em transação com ROLLBACK.
--
-- 1. sigla e termo levam ao código preferido (PAC e pneumonia → J18.9);
-- 2. dois diagnósticos no mesmo texto; o termo mais longo vence o curto;
-- 3. negação (C6) não gera sugestão;
-- 4. texto sem sentido devolve lista vazia; todo código devolvido existe na
--    CID-10; no máximo 5;
-- 5. acesso: anon não executa; a tabela é só leitura pela API.
--
-- No banco vazio (CI) a CID-10 não está carregada e a carga da migration não
-- grava nada: o teste planta só os códigos que usa, com a descrição oficial
-- do DATASUS, e os termos curados correspondentes. Na homologação valem os
-- dados reais (e o teste confere que a carga entrou inteira).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
-- os códigos devolvidos, na ordem
CREATE FUNCTION pg_temp.cods(p text) RETURNS text[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(e ->> 'codigo' ORDER BY n), '{}')
    FROM jsonb_array_elements(public.cid_sugerir_do_texto(p)) WITH ORDINALITY AS x(e, n)
$$;
GRANT EXECUTE ON FUNCTION pg_temp.cods(text) TO authenticated;

-- carga na homologação (CID-10 carregada): os 69 termos da lista entraram
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM terminologia.cid10 WHERE codigo = 'I64')
                  OR (SELECT count(*) FROM public.cid_termo WHERE fonte LIKE '%revisão do RT em 06/11/2026%') = 69,
  'a carga inicial entrou inteira (69 termos) onde a CID-10 está carregada');

-- banco vazio (CI): planta o que o teste usa
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES
  ('J18.9', 'Pneumonia não especificada'),
  ('J12.9', 'Pneumonia viral não especificada'),
  ('B01.2', 'Pneumopatia varicelosa'),
  ('B05.2', 'Sarampo complicado por pneumonia'),
  ('I21.9', 'Infarto agudo do miocárdio não especificado'),
  ('J44.1', 'Doença pulmonar obstrutiva crônica com exacerbação aguda não especificada'),
  ('J44.9', 'Doença pulmonar obstrutiva crônica não especificada'),
  ('I26.9', 'Embolia pulmonar sem menção de cor pulmonale agudo')
ON CONFLICT DO NOTHING;
INSERT INTO public.cid_termo (termo, termo_norm, cid, tipo, fonte) VALUES
  ('PAC', 'pac', 'J18.9', 'sigla', 'teste'),
  ('pneumonia', 'pneumonia', 'J18.9', 'preferido', 'teste'),
  ('IAM', 'iam', 'I21.9', 'sigla', 'teste'),
  ('DPOC', 'dpoc', 'J44.9', 'sigla', 'teste'),
  ('DPOC exacerbada', 'dpoc exacerbada', 'J44.1', 'sigla', 'teste'),
  ('TEP', 'tep', 'I26.9', 'sigla', 'teste')
ON CONFLICT ON CONSTRAINT cid_termo_unico DO NOTHING;

SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000065a1', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ── 1. sigla e termo ────────────────────────────────────────────────────────
SELECT pg_temp.ok((pg_temp.cods('PAC'))[1] = 'J18.9', 'PAC → J18.9 primeiro');
SELECT pg_temp.ok((public.cid_sugerir_do_texto('PAC') -> 0 ->> 'motivo') = 'sigla PAC', 'o motivo diz a sigla');
SELECT pg_temp.ok((pg_temp.cods('pneumonia'))[1] = 'J18.9', 'pneumonia → J18.9 primeiro (não B01.2)');
SELECT pg_temp.ok((pg_temp.cods('Pneumonia'))[1] = 'J18.9' AND (pg_temp.cods('pneumônia'))[1] = 'J18.9',
  'sem diferença de caixa nem acento');
SELECT pg_temp.ok('J12.9' = ANY (pg_temp.cods('pneumonia')), 'pneumonia traz alternativas da busca de texto');
SELECT pg_temp.ok((pg_temp.cods('PAC grave em idoso'))[1] = 'J18.9', 'sigla dentro da frase');

-- ── 2. dois diagnósticos; o termo mais longo vence ──────────────────────────
SELECT pg_temp.ok(pg_temp.cods('IAM + DPOC exacerbada') @> ARRAY['I21.9', 'J44.1'], 'IAM + DPOC exacerbada devolve os dois');
SELECT pg_temp.ok((pg_temp.cods('IAM + DPOC exacerbada'))[1:2] = ARRAY['I21.9', 'J44.1'], 'na ordem do texto');
SELECT pg_temp.ok(NOT ('J44.9' = ANY (pg_temp.cods('DPOC exacerbada'))), '"DPOC exacerbada" não traz o DPOC não especificado');
SELECT pg_temp.ok(pg_temp.cods('IAM e TEP') @> ARRAY['I21.9', 'I26.9'], '"e" separa os trechos');

-- ── 3. negação ──────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM unnest(pg_temp.cods('descartado IAM')) c WHERE c LIKE 'I21%'), 'descartado IAM não traz I21');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM unnest(pg_temp.cods('IAM descartado')) c WHERE c LIKE 'I21%'), 'IAM descartado não traz I21');
SELECT pg_temp.ok(NOT ('I26.9' = ANY (pg_temp.cods('PAC; TEP afastado'))) AND (pg_temp.cods('PAC; TEP afastado'))[1] = 'J18.9',
  'TEP afastado sai; PAC fica');
SELECT pg_temp.ok(pg_temp.cods('sem pneumonia') = '{}', 'sem pneumonia não sugere nada');
SELECT pg_temp.ok(pg_temp.cods('PAC sem DPOC') = ARRAY['J18.9'], 'sem apaga só o que vem depois');

-- ── 4. vazio, existência, limite ────────────────────────────────────────────
SELECT pg_temp.ok(public.cid_sugerir_do_texto('xqzw kkjjh') = '[]'::jsonb, 'texto sem sentido devolve []');
SELECT pg_temp.ok(public.cid_sugerir_do_texto('') = '[]'::jsonb AND public.cid_sugerir_do_texto(NULL) = '[]'::jsonb, 'vazio e nulo devolvem []');
SELECT pg_temp.ok(NOT EXISTS (
         SELECT 1 FROM unnest(ARRAY['PAC', 'pneumonia', 'IAM + DPOC exacerbada', 'dor torácica', 'febre e cefaleia', 'ITU']) t,
                       unnest(pg_temp.cods(t)) c
          WHERE NOT EXISTS (SELECT 1 FROM terminologia.cid10 x WHERE x.codigo = c)),
  'todo código devolvido existe na CID-10');
SELECT pg_temp.ok(jsonb_array_length(public.cid_sugerir_do_texto('pneumonia, IAM, DPOC, TEP, PAC, febre, dor abdominal')) <= 5, 'no máximo 5');

-- ── 5. acesso ───────────────────────────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.ok(has_function_privilege('anon', 'public.cid_sugerir_do_texto(text)', 'EXECUTE') IS FALSE, 'anon não executa');
SELECT pg_temp.ok(has_function_privilege('authenticated', 'public.cid_sugerir_do_texto(text)', 'EXECUTE'), 'authenticated executa');
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.cid_termo', 'SELECT')
                  AND NOT has_table_privilege('authenticated', 'public.cid_termo', 'INSERT')
                  AND NOT has_table_privilege('authenticated', 'public.cid_termo', 'UPDATE')
                  AND NOT has_table_privilege('authenticated', 'public.cid_termo', 'DELETE')
                  AND NOT has_table_privilege('anon', 'public.cid_termo', 'SELECT'),
  'cid_termo é só leitura pela API, e anon não lê');
SELECT pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cid_termo'::regclass), 'RLS ligada');

ROLLBACK;
