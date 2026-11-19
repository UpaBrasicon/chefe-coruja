-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000025_ubs_u15_vacina_referencias.sql (Percurso
-- da UBS, U15, vacina, PR 1). Tudo em transação com ROLLBACK.
--
-- 1. as tabelas do LEDI APS 8.7.0 com as contagens da fonte;
-- 2. as vacinas dos indicadores (C2, C3, C6 e C7) e as regras conferidas;
-- 3. o local aceito em cada via;
-- 4. a estratégia no código do e-SUS APS, com o código RNDS ao lado;
-- 5. acesso: authenticated lê, não grava; anon não lê.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;

-- ── 1. contagens ────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_imunobiologico) = 100, '100 imunobiológicos');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_estrategia) = 14, '14 estratégias');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_dose) = 82, '82 doses');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_grupo_atendimento) = 108, '108 grupos de atendimento');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_fabricante) = 98, '98 fabricantes');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_via) = 6, '6 vias');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_local) = 22, '22 locais de aplicação');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_regra) = 871, '871 regras de imunobiológico x estratégia x dose');
SELECT pg_temp.ok((SELECT count(DISTINCT imunobiologico) FROM terminologia.vacina_regra) = 60, '60 imunobiológicos com regra no atendimento do dia');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_cbo) = 90, '90 CBOs na Tabela 12');

-- ── 2. vacinas dos indicadores ──────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_imunobiologico
                   WHERE codigo IN (9, 17, 22, 24, 26, 29, 39, 42, 43, 46, 47, 56, 57, 58, 59, 33, 77, 106, 107, 60, 67, 93)) = 22,
  'os imunobiológicos das notas C2, C3, C6 e C7 estão na tabela');
SELECT pg_temp.ok((SELECT sigla FROM terminologia.vacina_imunobiologico WHERE codigo = 42) = 'PENTA', '42 = penta');
SELECT pg_temp.ok((SELECT sigla FROM terminologia.vacina_imunobiologico WHERE codigo = 57) = 'dTpa', '57 = dTpa adulto');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = 42 AND estrategia = 1 AND dose = 3),
  'penta de rotina, 3ª dose');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = 57 AND estrategia = 1 AND dose = 8),
  'dTpa de rotina, dose');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = 33 AND estrategia = 5 AND dose = 9),
  'influenza trivalente em campanha indiscriminada, dose única');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = 67 AND estrategia = 1 AND dose = 9),
  'HPV quadrivalente de rotina, dose única');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico IN (77, 93)),
  'influenza tetravalente e HPV nonavalente sem regra: só registro anterior');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = 42 AND estrategia = 1 AND dose = 4),
  'penta de rotina não tem 4ª dose');

-- ── 3. via x local ──────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT array_agg(local ORDER BY local) FROM terminologia.vacina_via_local WHERE via = 1) = '{17}',
  'intravenosa: só rede venosa');
SELECT pg_temp.ok((SELECT array_agg(local ORDER BY local) FROM terminologia.vacina_via_local WHERE via = 5) = '{1}',
  'oral: só boca');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM terminologia.vacina_via_local WHERE via = 3 AND local = 2)
                  AND NOT EXISTS (SELECT 1 FROM terminologia.vacina_via_local WHERE via = 3 AND local = 14),
  'intramuscular aceita deltóide e não a face externa superior do braço');
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_via_local WHERE via = 2)
                  = (SELECT count(*) FROM terminologia.vacina_via_local WHERE via = 6),
  'intradérmica e subcutânea têm os mesmos locais');
SELECT pg_temp.ok(NOT EXISTS (SELECT l.codigo FROM terminologia.vacina_local l
                              WHERE NOT EXISTS (SELECT 1 FROM terminologia.vacina_via_local vl WHERE vl.local = l.codigo)),
  'todo local tem pelo menos uma via');

-- ── 4. estratégia ───────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT codigo_rnds FROM terminologia.vacina_estrategia WHERE codigo = 11) = 10,
  'Pesquisa: 11 no e-SUS APS, 10 na RNDS');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE estrategia = 10),
  'nenhuma regra com estratégia 10 (código que não existe no e-SUS APS)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE estrategia = 15),
  'vacinação escolar entra pelo código do e-SUS APS (15)');

-- ── 5. acesso ───────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.vacina_regra) = 871, 'authenticated lê as regras');
SELECT pg_temp.falha($$INSERT INTO terminologia.vacina_dose VALUES (999, 'x', 'x')$$, 'permission denied',
  'authenticated não grava');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT count(*) FROM terminologia.vacina_imunobiologico$$, 'permission denied',
  'anon não lê');
RESET ROLE;

ROLLBACK;
