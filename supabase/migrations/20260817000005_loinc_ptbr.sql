-- ─────────────────────────────────────────────────────────────────────────────
-- LOINC pt-BR — tradução oficial (Linguistic Variant)
--
-- Adiciona colunas com a tradução pt-BR (variante oficial do LOINC,
-- AccessoryFiles/LinguisticVariants/ptBR11LinguisticVariant.csv) e regenera
-- a coluna `busca` para indexar também os termos traduzidos — assim
-- "glicose" (pt) e "glucose" (en) encontram o mesmo exame.
--
-- A variante oficial não traduz LONG_COMMON_NAME (vem vazio); a tradução
-- fica em COMPONENT / SYSTEM / SHORTNAME. Guardamos COMPONENT em
-- `componente_pt` e SHORTNAME em `nome_curto_pt`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Novas colunas
ALTER TABLE terminologia.loinc
  ADD COLUMN IF NOT EXISTS componente_pt text,
  ADD COLUMN IF NOT EXISTS nome_curto_pt text;

-- 2. Regenera a coluna gerada `busca` incluindo os termos pt-BR
--    (drop do índice GIN + coluna; recria com expressão ampliada)
DROP INDEX IF EXISTS loinc_busca_idx;
ALTER TABLE terminologia.loinc DROP COLUMN IF EXISTS busca;

ALTER TABLE terminologia.loinc
  ADD COLUMN busca tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      terminologia.unaccent_text(
        coalesce(componente_pt, '') || ' ' || coalesce(nome_curto_pt, '') || ' ' ||
        coalesce(componente, '') || ' ' || coalesce(nome_longo, '') || ' ' || coalesce(nome_curto, '')
      )
    )
  ) STORED;

CREATE INDEX loinc_busca_idx ON terminologia.loinc USING GIN (busca);

-- ===========================================================================
-- DOWN — reverter (volta a busca só com os campos en):
--   DROP INDEX IF EXISTS loinc_busca_idx;
--   ALTER TABLE terminologia.loinc DROP COLUMN IF EXISTS busca;
--   ALTER TABLE terminologia.loinc
--     ADD COLUMN busca tsvector GENERATED ALWAYS AS (
--       to_tsvector('portuguese',
--         terminologia.unaccent_text(
--           coalesce(componente, '') || ' ' || coalesce(nome_longo, '') || ' ' || coalesce(nome_curto, '')
--         )
--       )
--     ) STORED;
--   CREATE INDEX loinc_busca_idx ON terminologia.loinc USING GIN (busca);
--   ALTER TABLE terminologia.loinc DROP COLUMN IF EXISTS componente_pt,
--     DROP COLUMN IF EXISTS nome_curto_pt;
-- ===========================================================================
