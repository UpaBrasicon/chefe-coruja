-- ════════════════════════════════════════════════════════════════════════════
-- CID de referência: "Cefaleia" sugeria O80.0 (parto espontâneo cefálico)
-- (docs/porta/CID-CEFALEIA-DIAGNOSTICO.md). Decisões do RT em 16/11/2026: todas A.
--
-- G1. A busca de texto na CID-10 reduz as palavras ao radical: "cefaleia" e
--     "cefálico" viram o mesmo. Agora, além do radical, a descrição precisa
--     ter uma palavra que comece com a digitada sem as 2 últimas letras (7
--     letras ou mais) ou sem a última (5 e 6), sem acento: "cefale" casa com
--     "cefaléia" e não com "cefálico"; "alergi" casa com "alergia"; "picad"
--     não casa com "pica". Palavra de até 4 letras precisa estar inteira.
-- G2. Termos curados novos (lista do RT, C7): "dor de cabeça" → R51,
--     "cefaleia em salvas" → G44.0, "cefaleia tensional" → G44.2.
--
-- Só muda a busca de texto e a lista de termos; a função continua só lendo.
-- Rollback: recriar public.cid_sugerir_do_texto com a versão de
-- 20270302000001_cid_sugerido.sql, apagar os termos novos
-- (fonte = 'RT 16/11/2026, CID da cefaleia') e private.cid_palavra_casa.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.cid_palavra_casa(p_descricao text, p_palavra text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(string_to_array(coalesce(private.norm_cid_termo(p_descricao), ''), ' ')) d(x)
     WHERE d.x LIKE left(p_palavra, CASE WHEN length(p_palavra) >= 7 THEN length(p_palavra) - 2 WHEN length(p_palavra) >= 5 THEN length(p_palavra) - 1 ELSE length(p_palavra) END) || '%')
$$;
REVOKE ALL ON FUNCTION private.cid_palavra_casa(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cid_palavra_casa(text, text) TO authenticated;

-- G2: termos novos, só se o código existe na CID-10 carregada (no CI vazio, nada entra)
INSERT INTO public.cid_termo (termo, termo_norm, cid, tipo, fonte)
SELECT s.termo, private.norm_cid_termo(s.termo), s.cid, s.tipo, 'RT 16/11/2026, CID da cefaleia'
  FROM (VALUES ('dor de cabeça', 'R51', 'popular'),
               ('cefaleia em salvas', 'G44.0', 'preferido'),
               ('cefaleia tensional', 'G44.2', 'preferido')) AS s(termo, cid, tipo)
  JOIN terminologia.cid10 c ON c.codigo = s.cid
ON CONFLICT ON CONSTRAINT cid_termo_unico DO NOTHING;

CREATE OR REPLACE FUNCTION public.cid_sugerir_do_texto(p_texto text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH trechos AS (
    SELECT x.i, private.norm_cid_termo(x.t) AS bruto
      FROM regexp_split_to_table(left(coalesce(p_texto, ''), 500), '[+,;/.\n\r]|\s+[eE]\s+') WITH ORDINALITY AS x(t, i)
  ),
  partes AS (
    SELECT t.i,
           nullif(btrim(regexp_replace(t.bruto, '\m(sem|nao|nega\w*|descart\w*|afast\w*|exclu\w*)\M.*$', '')), '') AS parte
      FROM trechos t
     WHERE t.bruto IS NOT NULL
       AND t.bruto !~ '\m(descartad\w*|afastad\w*|excluid\w*|improvave\w*|negativ\w*|negad\w*)\M'
  ),
  curados AS (
    SELECT p.i, ct.cid, ct.termo, ct.termo_norm, ct.tipo, ct.peso,
           position(' ' || ct.termo_norm || ' ' IN ' ' || p.parte || ' ') AS pos
      FROM partes p
      JOIN public.cid_termo ct ON ' ' || p.parte || ' ' LIKE '% ' || ct.termo_norm || ' %'
     WHERE p.parte IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.cid_termo o
          WHERE length(o.termo_norm) > length(ct.termo_norm)
            AND ' ' || o.termo_norm || ' ' LIKE '% ' || ct.termo_norm || ' %'
            AND ' ' || p.parte || ' ' LIKE '% ' || o.termo_norm || ' %')
  ),
  ciap AS (
    SELECT p.i, a.codigo AS ciap, a.cid10_relacionada AS cid
      FROM partes p
      JOIN terminologia.ciap2 a ON a.cid10_relacionada IS NOT NULL
       AND EXISTS (SELECT 1 FROM unnest(string_to_array(a.descricao, '/')) d(x) WHERE private.norm_cid_termo(d.x) = p.parte)
     WHERE p.parte IS NOT NULL
  ),
  buscas AS (
    SELECT c.i, c.pos AS ord, c.termo_norm AS texto, true AS curado FROM curados c WHERE c.tipo <> 'sigla'
    UNION
    SELECT p.i, 0, p.parte, false FROM partes p
     WHERE p.parte IS NOT NULL AND NOT EXISTS (SELECT 1 FROM curados c WHERE c.i = p.i)
  ),
  -- palavras de enchimento da evolução não buscam nada; "aguda", "crônica",
  -- "grave"... só desempatam (contam se casarem, mas sozinhas não acham)
  palavras AS (
    SELECT b.i, b.ord, b.curado,
           array_agg(DISTINCT w) FILTER (WHERE w <> ALL (ARRAY['aguda', 'agudo', 'cronica', 'cronico', 'grave', 'leve', 'moderada', 'moderado'])) AS nucleo,
           array_agg(DISTINCT w) AS todas
      FROM buscas b, unnest(string_to_array(b.texto, ' ')) AS w
     WHERE length(w) >= 3 AND w !~ '^[0-9]+$'
       AND w <> ALL (ARRAY['paciente', 'estavel', 'quadro', 'suspeita', 'suspeito', 'hipotese', 'provavel', 'possivel',
                           'esclarecer', 'idoso', 'idosa', 'crianca', 'adulto', 'repeticao', 'evolucao', 'importante',
                           'intensa', 'intenso', 'forte', 'sinais', 'sintomas', 'alarme', 'descompensada', 'descompensado',
                           'exacerbada', 'exacerbado'])
       AND numnode(plainto_tsquery('portuguese', w)) > 0
     GROUP BY b.i, b.ord, b.curado
  ),
  texto AS (
    SELECT pw.i, pw.ord, pw.curado, c.codigo, c.descricao, ts_rank(c.busca, q.q) AS rank,
           -- G1 (16/11/2026): além do radical, a descrição precisa ter uma
           -- palavra que comece com a digitada (menos a última letra): o
           -- radical junta "cefaleia" e "cefálico", "picada" e "pica"
           (SELECT count(*) FROM unnest(pw.nucleo) w WHERE c.busca @@ plainto_tsquery('portuguese', w)
                                                       AND private.cid_palavra_casa(c.descricao, w))::int AS casadas,
           (SELECT count(*) FROM unnest(pw.todas) w WHERE c.busca @@ plainto_tsquery('portuguese', w)
                                                      AND private.cid_palavra_casa(c.descricao, w))::int AS casadas_todas,
           cardinality(pw.nucleo) AS total
      FROM palavras pw
      CROSS JOIN LATERAL (SELECT to_tsquery('portuguese', array_to_string(pw.nucleo, ' | ')) AS q) q
      JOIN terminologia.cid10 c ON c.busca @@ q.q
     WHERE cardinality(pw.nucleo) > 0
       AND NOT (length(c.codigo) = 3 AND EXISTS (
             SELECT 1 FROM terminologia.cid10 s
              WHERE s.codigo = ANY (ARRAY(SELECT c.codigo || '.' || d FROM generate_series(0, 9) d))))
  ),
  todos AS (
    SELECT 0 AS grupo, c.i, -c.peso AS k1, (c.tipo <> 'preferido')::int AS k2, c.pos AS k3, 0::real AS k4, 0 AS k5,
           c.cid AS codigo, CASE c.tipo WHEN 'sigla' THEN 'sigla ' ELSE 'termo ' END || c.termo AS motivo
      FROM curados c
    UNION ALL
    SELECT 1, a.i, 0, 0, 0, 0::real, 0, a.cid, 'CIAP-2 ' || a.ciap || ' (tabela do e-SUS APS)'
      FROM ciap a
    UNION ALL
    SELECT 2, t.i, t.ord, -t.casadas_todas, (t.descricao !~* 'n[aã]o especificad')::int, -t.rank, length(t.descricao),
           t.codigo, 'texto'
      FROM texto t
     -- alternativa de um termo curado: todas as palavras dele; trecho livre:
     -- pelo menos metade
     WHERE CASE WHEN t.curado THEN t.casadas = t.total ELSE t.casadas * 2 >= t.total END
  ),
  ordenados AS (
    SELECT t.codigo, t.motivo, row_number() OVER (ORDER BY t.grupo, t.i, t.k1, t.k2, t.k3, t.k4, t.k5, t.codigo) AS n
      FROM todos t
      JOIN terminologia.cid10 c ON c.codigo = t.codigo
  ),
  unicos AS (
    SELECT DISTINCT ON (o.codigo) o.codigo, o.motivo, o.n FROM ordenados o ORDER BY o.codigo, o.n
  ),
  primeiros AS (
    SELECT u.codigo, u.motivo, u.n FROM unicos u ORDER BY u.n LIMIT 5
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('codigo', f.codigo, 'descricao', c.descricao, 'motivo', f.motivo) ORDER BY f.n), '[]'::jsonb)
    FROM primeiros f
    JOIN terminologia.cid10 c ON c.codigo = f.codigo
$$;
