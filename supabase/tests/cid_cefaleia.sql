-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270414000065_cid_cefaleia.sql (CID de referência:
-- "Cefaleia" sugeria O80.0; decisões do RT em 16/11/2026, G1 e G2 = A).
-- Tudo em transação com ROLLBACK. No banco vazio (CI) a CID-10 não está
-- carregada: o teste planta os códigos com a descrição oficial do DATASUS e
-- os termos curados correspondentes.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.cods(p text) RETURNS text[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(e ->> 'codigo' ORDER BY n), '{}')
    FROM jsonb_array_elements(public.cid_sugerir_do_texto(p)) WITH ORDINALITY AS x(e, n)
$$;

INSERT INTO terminologia.cid10 (codigo, descricao) VALUES
  ('R51',   'Cefaléia'),
  ('G44.0', 'Síndrome de cluster-headache'),
  ('G44.2', 'Cefaléia tensional'),
  ('G44.3', 'Cefaléia crônica pós-traumática'),
  ('O80.0', 'Parto espontâneo cefálico'),
  ('F98.3', 'Pica do lactente ou da criança'),
  ('T63.2', 'Efeito tóxico do veneno de escorpião'),
  ('T78.4', 'Alergia não especificada'),
  ('R07.4', 'Dor torácica, não especificada'),
  ('S09.9', 'Traumatismo não especificado da cabeça')
ON CONFLICT DO NOTHING;
INSERT INTO public.cid_termo (termo, termo_norm, cid, tipo, fonte) VALUES
  ('cefaleia', private.norm_cid_termo('cefaleia'), 'R51', 'preferido', 'teste'),
  ('dor de cabeça', private.norm_cid_termo('dor de cabeça'), 'R51', 'popular', 'teste'),
  ('cefaleia em salvas', private.norm_cid_termo('cefaleia em salvas'), 'G44.0', 'preferido', 'teste'),
  ('cefaleia tensional', private.norm_cid_termo('cefaleia tensional'), 'G44.2', 'preferido', 'teste')
ON CONFLICT ON CONSTRAINT cid_termo_unico DO NOTHING;

-- ── G1: palavra da descrição começa com a digitada ──────────────────────────
SELECT pg_temp.ok(private.cid_palavra_casa('Cefaléia tensional', 'cefaleia'), 'cefaleia casa com Cefaléia');
SELECT pg_temp.ok(NOT private.cid_palavra_casa('Parto espontâneo cefálico', 'cefaleia'), 'cefaleia NÃO casa com cefálico');
SELECT pg_temp.ok(NOT private.cid_palavra_casa('Pica do lactente ou da criança', 'picada'), 'picada NÃO casa com Pica');
SELECT pg_temp.ok(private.cid_palavra_casa('Alergia não especificada', 'alergica'), 'alérgica casa com Alergia');
SELECT pg_temp.ok(private.cid_palavra_casa('Pneumonia não especificada', 'pneumonias'), 'pneumonias casa com Pneumonia');

-- ── sugestões ───────────────────────────────────────────────────────────────
SELECT pg_temp.ok((pg_temp.cods('Cefaleia'))[1] = 'R51', 'Cefaleia → R51 primeiro');
SELECT pg_temp.ok(NOT ('O80.0' = ANY (pg_temp.cods('Cefaleia'))), 'Cefaleia não sugere O80.0 (parto cefálico)');
SELECT pg_temp.ok(NOT ('O80.0' = ANY (pg_temp.cods('cefaleia em salvas'))), 'cefaleia em salvas não sugere O80.0');
SELECT pg_temp.ok((pg_temp.cods('cefaleia em salvas'))[1] = 'G44.0', 'cefaleia em salvas → G44.0 primeiro');
SELECT pg_temp.ok((pg_temp.cods('cefaleia tensional'))[1] = 'G44.2', 'cefaleia tensional → G44.2 primeiro');
SELECT pg_temp.ok((pg_temp.cods('dor de cabeça'))[1] = 'R51', 'dor de cabeça → R51 primeiro');
SELECT pg_temp.ok(NOT ('R07.4' = ANY (pg_temp.cods('dor de cabeça'))), 'dor de cabeça não sugere dor torácica');
SELECT pg_temp.ok(NOT ('F98.3' = ANY (pg_temp.cods('picada de escorpião'))), 'picada de escorpião não sugere Pica do lactente');
SELECT pg_temp.ok('T78.4' = ANY (pg_temp.cods('reação alérgica')), 'reação alérgica segue sugerindo Alergia não especificada');

ROLLBACK;
