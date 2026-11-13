-- ════════════════════════════════════════════════════════════════════════════
-- Trilha Hermes / Evidências, E6 (decisão do RT de 12/11/2026,
-- docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md): saber quanto a busca clínica
-- ("Pergunte à IA") custa por mês.
--
-- 1. clinical_search_logs ganha o modelo e os tokens de cada pergunta ao modelo
--    (a Edge clinical-search grava o que a biblioteca devolve no fim do stream).
-- 2. private.ia_preco_modelo: preço por 1 milhão de tokens, com a data em que
--    passou a valer e a fonte. O preço é o do horário de pico; fora do pico a
--    DeepSeek cobra metade (desconto_fora_pico).
-- 3. public.ia_custo_busca_mes(date): perguntas, tokens e custo estimado do mês,
--    só para o super admin.
--
-- Expand puro: colunas novas, que podem ficar vazias, e tabela e função novas.
--
-- Rollback (na ordem):
--   DROP FUNCTION IF EXISTS public.ia_custo_busca_mes(date);
--   DROP FUNCTION IF EXISTS private.ia_hora_de_pico(timestamptz);
--   DROP TABLE IF EXISTS private.ia_preco_modelo;
--   ALTER TABLE public.clinical_search_logs
--     DROP COLUMN IF EXISTS modelo, DROP COLUMN IF EXISTS tokens_entrada_cache,
--     DROP COLUMN IF EXISTS tokens_entrada, DROP COLUMN IF EXISTS tokens_saida;
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clinical_search_logs
  ADD COLUMN IF NOT EXISTS modelo               text CHECK (modelo IS NULL OR length(modelo) <= 80),
  ADD COLUMN IF NOT EXISTS tokens_entrada_cache int  CHECK (tokens_entrada_cache IS NULL OR tokens_entrada_cache >= 0),
  ADD COLUMN IF NOT EXISTS tokens_entrada       int  CHECK (tokens_entrada IS NULL OR tokens_entrada >= 0),
  ADD COLUMN IF NOT EXISTS tokens_saida         int  CHECK (tokens_saida IS NULL OR tokens_saida >= 0);
COMMENT ON COLUMN public.clinical_search_logs.tokens_entrada_cache IS
  'E6: tokens de entrada que a DeepSeek achou no cache dela (cobrados mais barato).';
COMMENT ON COLUMN public.clinical_search_logs.tokens_entrada IS
  'E6: tokens de entrada fora do cache. Pergunta + reescrita.';

CREATE TABLE IF NOT EXISTS private.ia_preco_modelo (
  modelo                text    NOT NULL,
  vigente_desde         date    NOT NULL,
  usd_entrada_cache     numeric NOT NULL CHECK (usd_entrada_cache >= 0),
  usd_entrada           numeric NOT NULL CHECK (usd_entrada >= 0),
  usd_saida             numeric NOT NULL CHECK (usd_saida >= 0),
  desconto_fora_pico    boolean NOT NULL DEFAULT false,
  fonte                 text    NOT NULL,
  PRIMARY KEY (modelo, vigente_desde)
);
COMMENT ON TABLE private.ia_preco_modelo IS
  'E6: preço por 1 milhão de tokens (USD), no horário de pico. Uma linha nova a cada mudança de preço.';
ALTER TABLE private.ia_preco_modelo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_preco_modelo FROM PUBLIC, anon, authenticated;

-- Preço da página oficial, conferido em 13/11/2026. Os nomes antigos
-- (deepseek-v4-flash) seguem aceitos e são cobrados pelo preço do Flash.
INSERT INTO private.ia_preco_modelo (modelo, vigente_desde, usd_entrada_cache, usd_entrada, usd_saida, desconto_fora_pico, fonte) VALUES
  ('deepseek-flash',    '2026-11-13', 0.006, 0.30, 1.20, true, 'https://api-docs.deepseek.com/quick_start/pricing (13/11/2026)'),
  ('deepseek-v4-flash', '2026-11-13', 0.006, 0.30, 1.20, true, 'https://api-docs.deepseek.com/quick_start/pricing (13/11/2026): nome antigo, cobrado como deepseek-flash'),
  ('deepseek-v4-pro',   '2026-11-13', 0.044, 1.32, 3.96, true, 'https://api-docs.deepseek.com/quick_start/pricing (13/11/2026)')
ON CONFLICT (modelo, vigente_desde) DO NOTHING;

-- Pico da DeepSeek: 01:00–04:00 e 06:00–10:00 UTC, de segunda a sexta. Os
-- feriados chineses, também fora do pico, não entram: o custo sai um pouco
-- acima nesses dias, nunca abaixo.
CREATE OR REPLACE FUNCTION private.ia_hora_de_pico(p_em timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT extract(isodow FROM p_em AT TIME ZONE 'UTC') BETWEEN 1 AND 5
     AND (extract(hour FROM p_em AT TIME ZONE 'UTC') BETWEEN 1 AND 3
       OR extract(hour FROM p_em AT TIME ZONE 'UTC') BETWEEN 6 AND 9)
$$;

-- Perguntas ao modelo, tokens e custo estimado do mês (o mês de p_mes; sem
-- argumento, o mês atual em Brasília). Só o super admin. A pergunta que não tem
-- tokens (antes do E6, bloqueada ou de resposta guardada) conta em
-- perguntas_sem_tokens e fica fora do custo.
CREATE OR REPLACE FUNCTION public.ia_custo_busca_mes(p_mes date DEFAULT NULL)
RETURNS TABLE (
  mes date, perguntas bigint, perguntas_sem_tokens bigint,
  tokens_entrada_cache bigint, tokens_entrada bigint, tokens_saida bigint,
  usd_estimado numeric, modelos text[]
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ini date := date_trunc('month', coalesce(p_mes, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date;
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só o administrador geral vê o custo da IA.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH l AS (
    SELECT c.created_at, c.modelo, c.tokens_entrada_cache, c.tokens_entrada, c.tokens_saida
      FROM public.clinical_search_logs c
     WHERE c.mode = 'ask'
       AND c.created_at >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND c.created_at <  ((v_ini + interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ), custo AS (
    SELECT l.*,
           (SELECT p FROM private.ia_preco_modelo p
             WHERE p.modelo = l.modelo AND p.vigente_desde <= (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date
             ORDER BY p.vigente_desde DESC LIMIT 1) AS preco
      FROM l
  )
  SELECT v_ini,
         count(*),
         count(*) FILTER (WHERE custo.tokens_saida IS NULL),
         coalesce(sum(custo.tokens_entrada_cache), 0)::bigint,
         coalesce(sum(custo.tokens_entrada), 0)::bigint,
         coalesce(sum(custo.tokens_saida), 0)::bigint,
         round(coalesce(sum(
           (coalesce(custo.tokens_entrada_cache, 0) * (custo.preco).usd_entrada_cache
            + coalesce(custo.tokens_entrada, 0) * (custo.preco).usd_entrada
            + coalesce(custo.tokens_saida, 0) * (custo.preco).usd_saida) / 1000000.0
           * CASE WHEN (custo.preco).desconto_fora_pico AND NOT private.ia_hora_de_pico(custo.created_at) THEN 0.5 ELSE 1 END
         ), 0), 4),
         coalesce(array_agg(DISTINCT custo.modelo) FILTER (WHERE custo.modelo IS NOT NULL), '{}')
    FROM custo;
END; $$;
REVOKE ALL ON FUNCTION public.ia_custo_busca_mes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_custo_busca_mes(date) TO authenticated;
REVOKE ALL ON FUNCTION private.ia_hora_de_pico(timestamptz) FROM PUBLIC, anon, authenticated;
