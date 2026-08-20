-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — Camada de terminologias de referência (schema `terminologia`)
--
-- Tabelas públicas de terminologia (CID-10, SIGTAP, CBO, CMED, LOINC).
-- Dados públicos: NÃO são replicados por tenant e NÃO têm RLS por tenant.
-- Leitura: qualquer usuário autenticado. Escrita: somente service_role.
-- Busca: coluna `busca` tsvector GERADA (to_tsvector 'portuguese' + unaccent)
-- com índice GIN; rankeamento via ts_rank + casamento por prefixo de código.
--
-- Reversível: bloco DOWN no final (aplicar manualmente, se necessário).
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensão unaccent (busca sem sensibilidade a acento) — schema extensions
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS terminologia;

-- Wrapper imutável do unaccent (necessário para coluna gerada + índice GIN)
CREATE OR REPLACE FUNCTION terminologia.unaccent_text(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT extensions.unaccent('extensions.unaccent', p)
$$;

-- ===========================================================================
-- 1. CID-10
-- ===========================================================================
CREATE TABLE IF NOT EXISTS terminologia.cid10 (
  codigo     text PRIMARY KEY,
  descricao  text NOT NULL,
  capitulo   text,
  grupo      text,
  busca      tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', terminologia.unaccent_text(coalesce(descricao, '')))
  ) STORED
);

CREATE INDEX IF NOT EXISTS cid10_busca_idx ON terminologia.cid10 USING GIN (busca);

-- ===========================================================================
-- 2. SIGTAP — procedimentos
-- ===========================================================================
CREATE TABLE IF NOT EXISTS terminologia.sigtap_procedimento (
  codigo       text PRIMARY KEY,
  nome         text NOT NULL,
  complexidade text,
  sexo         text,
  idade_min    integer,
  idade_max    integer,
  valor_sa     numeric(12,2),
  valor_sh     numeric(12,2),
  valor_sp     numeric(12,2),
  competencia  text,
  busca        tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', terminologia.unaccent_text(coalesce(nome, '')))
  ) STORED
);

CREATE INDEX IF NOT EXISTS sigtap_busca_idx ON terminologia.sigtap_procedimento USING GIN (busca);

-- ===========================================================================
-- 3. CBO — ocupações
-- ===========================================================================
CREATE TABLE IF NOT EXISTS terminologia.cbo (
  codigo text PRIMARY KEY,
  titulo text NOT NULL,
  busca  tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', terminologia.unaccent_text(coalesce(titulo, '')))
  ) STORED
);

CREATE INDEX IF NOT EXISTS cbo_busca_idx ON terminologia.cbo USING GIN (busca);

-- ===========================================================================
-- 4. CMED — medicamentos (lista de preços ANVISA)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS terminologia.medicamento_cmed (
  id                text PRIMARY KEY,
  principio_ativo   text NOT NULL,
  produto           text NOT NULL,
  apresentacao      text,
  laboratorio       text,
  registro_anvisa   text,
  classe_terapeutica text,
  tarja             text,
  pf_sem_impostos   numeric(12,2),
  competencia       text,
  busca             tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      terminologia.unaccent_text(
        coalesce(produto, '') || ' ' || coalesce(principio_ativo, '') || ' ' || coalesce(apresentacao, '')
      )
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS cmed_busca_idx ON terminologia.medicamento_cmed USING GIN (busca);
CREATE INDEX IF NOT EXISTS cmed_principio_idx ON terminologia.medicamento_cmed (principio_ativo);

-- ===========================================================================
-- 5. LOINC — exames laboratoriais
-- ===========================================================================
CREATE TABLE IF NOT EXISTS terminologia.loinc (
  codigo          text PRIMARY KEY,
  componente      text,
  propriedade     text,
  unidade_exemplo text,
  nome_longo      text,
  nome_curto      text,
  classe          text,
  busca           tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      terminologia.unaccent_text(
        coalesce(componente, '') || ' ' || coalesce(nome_longo, '') || ' ' || coalesce(nome_curto, '')
      )
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS loinc_busca_idx ON terminologia.loinc USING GIN (busca);

-- ===========================================================================
-- 6. RLS — leitura para autenticados; escrita só service_role
-- Regra: NUNCA `using (true)` sem qualificar o papel (aqui o papel é
-- `authenticated`, e a escrita é documental para `service_role` — que
-- bypassa RLS de qualquer forma, mas as policies deixam a intenção explícita).
-- ===========================================================================
ALTER TABLE terminologia.cid10              ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminologia.sigtap_procedimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminologia.cbo                ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminologia.medicamento_cmed   ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminologia.loinc              ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cid10_select" ON terminologia.cid10;
CREATE POLICY "cid10_select" ON terminologia.cid10
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cid10_write" ON terminologia.cid10;
CREATE POLICY "cid10_write" ON terminologia.cid10
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sigtap_select" ON terminologia.sigtap_procedimento;
CREATE POLICY "sigtap_select" ON terminologia.sigtap_procedimento
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sigtap_write" ON terminologia.sigtap_procedimento;
CREATE POLICY "sigtap_write" ON terminologia.sigtap_procedimento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cbo_select" ON terminologia.cbo;
CREATE POLICY "cbo_select" ON terminologia.cbo
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cbo_write" ON terminologia.cbo;
CREATE POLICY "cbo_write" ON terminologia.cbo
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cmed_select" ON terminologia.medicamento_cmed;
CREATE POLICY "cmed_select" ON terminologia.medicamento_cmed
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cmed_write" ON terminologia.medicamento_cmed;
CREATE POLICY "cmed_write" ON terminologia.medicamento_cmed
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loinc_select" ON terminologia.loinc;
CREATE POLICY "loinc_select" ON terminologia.loinc
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loinc_write" ON terminologia.loinc;
CREATE POLICY "loinc_write" ON terminologia.loinc
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grants explícitos: SELECT p/ authenticated; ALL p/ service_role; nada p/ anon
REVOKE ALL ON ALL TABLES IN SCHEMA terminologia FROM anon, authenticated;
GRANT USAGE ON SCHEMA terminologia TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA terminologia TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA terminologia TO service_role;

-- ===========================================================================
-- 7. Função de busca única `terminologia.buscar`
--
-- Decisão: UMA função com whitelist (em vez de 5 RPCs) — as 5 tabelas
-- compartilham exatamente o mesmo contrato (codigo, descricao, extra, rank),
-- a whitelist valida o nome da tabela e o SQL usa somente nomes da whitelist
-- via %I (sem concatenar input do usuário), eliminando risco de injeção.
-- Ranqueia por ts_rank(busca, query) e dá prioridade a prefixo de código.
-- ===========================================================================
CREATE OR REPLACE FUNCTION terminologia.buscar(
  p_tabela text,
  p_termo  text,
  p_limite integer DEFAULT 10
)
RETURNS TABLE (tabela text, codigo text, descricao text, extra jsonb, rank real)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_termo text;
  v_query tsquery;
  v_tabela text;      -- nome da tabela (whitelist)
  v_coluna text;      -- coluna de descrição da tabela
  v_extra  text;      -- expressão jsonb de metadados
  v_prefixo text;     -- termo cru (unaccent) p/ prefixo de código
BEGIN
  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 50 THEN
    p_limite := 10;
  END IF;
  IF p_termo IS NULL OR length(trim(p_termo)) = 0 THEN
    RETURN;
  END IF;

  -- Prefixo de código: mantém pontuação (ex.: "J06" acha "J06.9")
  v_prefixo := terminologia.unaccent_text(trim(p_termo));

  -- Whitelist de tabelas: nome + coluna de descrição + extras por tabela
  v_tabela := CASE p_tabela
    WHEN 'cid10'               THEN 'cid10'
    WHEN 'sigtap_procedimento' THEN 'sigtap_procedimento'
    WHEN 'cbo'                 THEN 'cbo'
    WHEN 'medicamento_cmed'    THEN 'medicamento_cmed'
    WHEN 'loinc'               THEN 'loinc'
    ELSE NULL
  END;
  IF v_tabela IS NULL THEN
    RAISE EXCEPTION 'Tabela de terminologia inválida: %', p_tabela;
  END IF;

  v_coluna := CASE p_tabela
    WHEN 'cid10'               THEN 'descricao'
    WHEN 'sigtap_procedimento' THEN 'nome'
    WHEN 'cbo'                 THEN 'titulo'
    WHEN 'medicamento_cmed'    THEN 'produto'
    WHEN 'loinc'               THEN 'nome_longo'
  END;

  v_extra := CASE p_tabela
    WHEN 'cid10' THEN
      'jsonb_build_object(''capitulo'', capitulo, ''grupo'', grupo)'
    WHEN 'sigtap_procedimento' THEN
      'jsonb_build_object(''complexidade'', complexidade, ''sexo'', sexo, ''idade_min'', idade_min, ''idade_max'', idade_max, ''valor_sa'', valor_sa, ''valor_sh'', valor_sh, ''valor_sp'', valor_sp, ''competencia'', competencia)'
    WHEN 'cbo' THEN
      'NULL::jsonb'
    WHEN 'medicamento_cmed' THEN
      'jsonb_build_object(''principio_ativo'', principio_ativo, ''apresentacao'', apresentacao, ''laboratorio'', laboratorio, ''registro_anvisa'', registro_anvisa, ''classe_terapeutica'', classe_terapeutica, ''tarja'', tarja, ''pf_sem_impostos'', pf_sem_impostos, ''competencia'', competencia)'
    WHEN 'loinc' THEN
      'jsonb_build_object(''componente'', componente, ''propriedade'', propriedade, ''unidade_exemplo'', unidade_exemplo, ''nome_curto'', nome_curto, ''classe'', classe)'
  END;

  -- Normaliza: sem acento, sem pontuação; cada token vira prefixo 'token:*'
  v_termo := terminologia.unaccent_text(trim(p_termo));
  v_termo := regexp_replace(v_termo, '[^a-zA-Z0-9 ]', ' ', 'g');
  IF v_termo = '' THEN
    RETURN;
  END IF;

  BEGIN
    SELECT to_tsquery('portuguese',
      (SELECT string_agg(prefixo, ' & ' ORDER BY ord)
       FROM (
         SELECT word || ':*' AS prefixo, ord
         FROM unnest(string_to_array(v_termo, ' ')) WITH ORDINALITY AS t(word, ord)
         WHERE word <> ''
       ) s)
    ) INTO v_query;
  EXCEPTION WHEN OTHERS THEN
    RETURN; -- termo sem tokens válidos
  END;

  -- SQL dinâmico com nome 100% vindo da whitelist (protegido por %I/%L)
  RETURN QUERY EXECUTE format(
    $q$
      SELECT %L::text AS tabela,
             codigo,
             %s AS descricao,
             %s AS extra,
             rank
      FROM (
        SELECT codigo,
               %s AS descricao,
               %s AS extra,
               ts_rank(busca, %L) AS rank,
               (codigo ILIKE %L) AS prefixo_codigo
        FROM terminologia.%I
        WHERE busca @@ %L OR codigo ILIKE %L
      ) r
      ORDER BY prefixo_codigo DESC, rank DESC, codigo
      LIMIT %s
    $q$,
    v_tabela,        -- %L: nome da tabela (coluna tabela)
    v_coluna,        -- %s: coluna de descrição
    v_extra,         -- %s: expressão jsonb
    v_coluna,        -- %s: coluna de descrição (subquery)
    v_extra,         -- %s: expressão jsonb (subquery)
    v_query,         -- %L: tsquery
    v_prefixo || '%', -- %L: prefixo p/ código (termo cru, sem acento)
    v_tabela,        -- %I: nome da tabela (whitelist)
    v_query,         -- %L: tsquery
    v_prefixo || '%', -- %L: prefixo p/ código
    p_limite         -- %s: limite (inteiro validado)
  );
END;
$$;

-- ===========================================================================
-- 8. Wrapper público p/ o cliente (PostgREST só expõe schema public)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.terminologia_buscar(
  p_tabela text,
  p_termo  text,
  p_limite integer DEFAULT 10
)
RETURNS TABLE (tabela text, codigo text, descricao text, extra jsonb, rank real)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT * FROM terminologia.buscar(p_tabela, p_termo, p_limite);
$$;

GRANT EXECUTE ON FUNCTION public.terminologia_buscar(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION terminologia.buscar(text, text, integer) TO authenticated;

-- ===========================================================================
-- DOWN — aplicar manualmente se precisar reverter esta migration:
--
--   DROP FUNCTION IF EXISTS public.terminologia_buscar(text, text, integer);
--   DROP FUNCTION IF EXISTS terminologia.buscar(text, text, integer);
--   DROP TABLE IF EXISTS terminologia.cid10;
--   DROP TABLE IF EXISTS terminologia.sigtap_procedimento;
--   DROP TABLE IF EXISTS terminologia.cbo;
--   DROP TABLE IF EXISTS terminologia.medicamento_cmed;
--   DROP TABLE IF EXISTS terminologia.loinc;
--   DROP FUNCTION IF EXISTS terminologia.unaccent_text(text);
--   DROP SCHEMA IF EXISTS terminologia;
--   -- (a extensão unaccent é compartilhada — só remova se nada mais a usar:
--   --  DROP EXTENSION IF EXISTS unaccent;)
-- ===========================================================================
