-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270414000074_cid_termos_colisoes.sql: as 5 colisões
-- da varredura G3 trazem primeiro o código escolhido pelo RT (16/11/2026).
-- Tudo em transação com ROLLBACK. No banco vazio (CI) a CID-10 não está
-- carregada: o teste planta os códigos com a descrição oficial do DATASUS,
-- inclusive os que colidiam, e reaplica os termos da migration.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.primeiro(p text) RETURNS text LANGUAGE sql AS $$
  SELECT public.cid_sugerir_do_texto(p) -> 0 ->> 'codigo'
$$;

INSERT INTO terminologia.cid10 (codigo, descricao) VALUES
  ('F41.0', 'Transtorno de pânico [ansiedade paroxística episódica]'),
  ('R06.0', 'Dispnéia'),
  ('I46.9', 'Parada cardíaca não especificada'),
  ('R11',   'Náusea e vômitos'),
  ('I10',   'Hipertensão essencial (primária)'),
  ('G40.7', 'Pequeno mal não especificado, sem crises de grande mal'),
  ('X54.9', 'Falta de água - local não especificado'),
  ('O21.9', 'Vômitos da gravidez, não especificados')
ON CONFLICT DO NOTHING;

-- no CI a migration rodou com a CID-10 vazia (o JOIN não inseriu nada): reaplica
INSERT INTO public.cid_termo (termo, termo_norm, cid, tipo, fonte)
SELECT s.termo, private.norm_cid_termo(s.termo), s.cid, s.tipo, 'RT 16/11/2026, colisões G3'
  FROM (VALUES ('crise de pânico', 'F41.0', 'popular'),
               ('falta de ar', 'R06.0', 'popular'),
               ('parada cardiorrespiratória', 'I46.9', 'preferido'),
               ('PCR', 'I46.9', 'sigla'),
               ('vômitos', 'R11', 'preferido'),
               ('crise hipertensiva', 'I10', 'preferido')) AS s(termo, cid, tipo)
  JOIN terminologia.cid10 c ON c.codigo = s.cid
ON CONFLICT ON CONSTRAINT cid_termo_unico DO NOTHING;

SELECT pg_temp.ok(pg_temp.primeiro('crise de pânico') = 'F41.0', 'crise de pânico → F41.0');
SELECT pg_temp.ok(pg_temp.primeiro('falta de ar') = 'R06.0', 'falta de ar → R06.0');
SELECT pg_temp.ok(pg_temp.primeiro('parada cardiorrespiratória') = 'I46.9', 'parada cardiorrespiratória → I46.9');
SELECT pg_temp.ok(pg_temp.primeiro('PCR') = 'I46.9', 'PCR → I46.9');
SELECT pg_temp.ok(pg_temp.primeiro('vômitos') = 'R11', 'vômitos → R11');
SELECT pg_temp.ok(pg_temp.primeiro('crise hipertensiva') = 'I10', 'crise hipertensiva → I10');
SELECT pg_temp.ok(
  (SELECT count(*) FROM public.cid_termo WHERE fonte = 'RT 16/11/2026, colisões G3') = 6,
  'os 6 termos da migration estão na lista');

ROLLBACK;
