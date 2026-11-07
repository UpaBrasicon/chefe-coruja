-- ════════════════════════════════════════════════════════════════════════════
-- CID de referência a partir da Avaliação (achado guardado de 07/10/2026;
-- docs/porta/CID-SUGERIDO-AVALIACAO-DIAGNOSTICO.md). Decisão do RT em
-- 06/11/2026: A em C1 a C7.
--
-- C1. Determinístico, dentro do banco: lista curada de termos e siglas (no
--     padrão de public.medicamento_sinonimo) mais a busca de texto na CID-10.
--     Nada sai do banco; todo código devolvido existe em terminologia.cid10.
-- C4. Carga inicial: siglas e termos comuns do PS, propostos para o RT revisar
--     antes da produção. Os pares CIAP-2 → CID (tabela do e-SUS APS) não são
--     copiados para cá: a função os consulta em terminologia.ciap2 como
--     referência mais fraca, só quando o trecho é o próprio nome da CIAP-2.
-- C5. Cada termo aponta um código; o preferido é o "não especificado" do grupo
--     (pneumonia → J18.9). A busca de texto completa até 5 códigos.
-- C6. Termo negado ("descartado IAM", "TEP afastado", "sem pneumonia") não
--     gera sugestão.
-- C7. A lista é mantida pelo RT, por migration.
--
-- A função só LÊ: não grava CID, não registra nada. A tela mostra os códigos
-- como "só referência"; o clique só preenche o campo e a escolha é do médico.
--
-- Acesso: como public.terminologia_buscar (a busca de CID que a tela já usa),
-- SECURITY INVOKER, só para authenticated; anon não executa. Não pede o
-- segundo fator porque não lê dado de paciente, só tabelas de referência.
--
-- Expand, idempotente. Teste: supabase/tests/depois_cid_sugerido.sql
--
-- ROLLBACK (testado na homologação; nada aqui toca dado clínico):
--   DROP FUNCTION IF EXISTS public.cid_sugerir_do_texto(text);
--   DROP TABLE IF EXISTS public.cid_termo;
--   DROP FUNCTION IF EXISTS private.norm_cid_termo(text);
-- ════════════════════════════════════════════════════════════════════════════

-- ── normalização: sem caixa, sem acento, só letras, números e espaço ────────
CREATE OR REPLACE FUNCTION private.norm_cid_termo(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(coalesce(private.nome_comparavel(t), ''), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;
REVOKE ALL ON FUNCTION private.norm_cid_termo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.norm_cid_termo(text) TO authenticated;

-- ── termos curados ──────────────────────────────────────────────────────────
-- tipo: 'sigla' (PAC), 'popular' (nome de uso corrente que não é a descrição
-- oficial, ex.: "crise asmática") ou 'preferido' (o nome clínico do grupo; o
-- código é o "não especificado" dele quando existe).
CREATE TABLE IF NOT EXISTS public.cid_termo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo text NOT NULL,
  termo_norm text NOT NULL,
  cid text NOT NULL REFERENCES terminologia.cid10 (codigo),
  tipo text NOT NULL CHECK (tipo IN ('sigla', 'popular', 'preferido')),
  fonte text NOT NULL,
  peso integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cid_termo_unico UNIQUE (termo_norm, cid)
);
CREATE INDEX IF NOT EXISTS cid_termo_cid ON public.cid_termo (cid);
ALTER TABLE public.cid_termo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cid_termo_select ON public.cid_termo;
CREATE POLICY cid_termo_select ON public.cid_termo FOR SELECT TO authenticated USING (true);
-- só leitura pela API: nenhum outro privilégio na tabela
REVOKE ALL ON public.cid_termo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cid_termo TO authenticated;
COMMENT ON TABLE public.cid_termo IS
  'Termos e siglas do PS → CID-10 de referência (CID sugerido, decisão do RT de 06/11/2026, C1 a C7). Mantida pelo RT por migration.';

-- ── carga inicial (C4) ──────────────────────────────────────────────────────
-- Cada código foi conferido em 06/11/2026 na terminologia.cid10 da homologação
-- (CID-10 do DATASUS): existe e a descrição oficial corresponde ao termo.
-- Com a CID-10 carregada, código ausente para a migration (nunca inventar).
-- Sem a tabela carregada (ambiente vazio, como o banco do CI), nada entra.
-- tabela temporária de carga: some no fim da sessão (sem DROP explícito, que a
-- trava expand/contract confundiria com DROP de tabela do app)
CREATE TEMP TABLE cid_termo_carga (termo text, cid text, tipo text);
INSERT INTO pg_temp.cid_termo_carga (termo, cid, tipo) VALUES
  -- respiratório
  ('PAC', 'J18.9', 'sigla'),
  ('pneumonia', 'J18.9', 'preferido'),
  ('DPOC', 'J44.9', 'sigla'),
  ('DPOC exacerbada', 'J44.1', 'sigla'),
  ('DPOC descompensada', 'J44.1', 'sigla'),
  ('asma', 'J45.9', 'preferido'),
  ('crise asmática', 'J45.9', 'popular'),
  ('IVAS', 'J06.9', 'sigla'),
  ('resfriado', 'J00', 'popular'),
  ('sinusite aguda', 'J01.9', 'preferido'),
  ('faringite', 'J02.9', 'preferido'),
  ('amigdalite', 'J03.9', 'preferido'),
  ('otite média', 'H66.9', 'preferido'),
  ('TEP', 'I26.9', 'sigla'),
  ('embolia pulmonar', 'I26.9', 'preferido'),
  -- cardiovascular
  ('IAM', 'I21.9', 'sigla'),
  ('infarto agudo do miocárdio', 'I21.9', 'preferido'),
  ('angina instável', 'I20.0', 'preferido'),
  ('ICC', 'I50.9', 'sigla'),
  ('insuficiência cardíaca', 'I50.9', 'preferido'),
  ('HAS', 'I10', 'sigla'),
  ('hipertensão arterial', 'I10', 'popular'),
  ('fibrilação atrial', 'I48', 'preferido'),
  ('TVP', 'I80.2', 'sigla'),
  ('trombose venosa profunda', 'I80.2', 'popular'),
  ('síncope', 'R55', 'preferido'),
  ('dor torácica', 'R07.4', 'preferido'),
  -- neurológico
  ('AVC', 'I64', 'sigla'),
  ('acidente vascular cerebral', 'I64', 'preferido'),
  ('AVC isquêmico', 'I63.9', 'sigla'),
  ('AIT', 'G45.9', 'sigla'),
  ('cefaleia', 'R51', 'preferido'),
  ('convulsão', 'R56.8', 'popular'),
  ('crise convulsiva', 'R56.8', 'popular'),
  ('convulsão febril', 'R56.0', 'preferido'),
  -- endócrino e metabólico
  ('DM', 'E14.9', 'sigla'),
  ('diabetes', 'E14.9', 'preferido'),
  ('DM1', 'E10.9', 'sigla'),
  ('diabetes tipo 1', 'E10.9', 'popular'),
  ('DM2', 'E11.9', 'sigla'),
  ('diabetes tipo 2', 'E11.9', 'popular'),
  ('CAD', 'E14.1', 'sigla'),
  ('cetoacidose diabética', 'E14.1', 'preferido'),
  ('hipoglicemia', 'E16.2', 'preferido'),
  ('desidratação', 'E86', 'popular'),
  -- urinário
  ('ITU', 'N39.0', 'sigla'),
  ('infecção urinária', 'N39.0', 'popular'),
  ('infecção do trato urinário', 'N39.0', 'preferido'),
  ('cistite', 'N30.9', 'preferido'),
  ('cólica renal', 'N23', 'popular'),
  ('cólica nefrética', 'N23', 'preferido'),
  -- infeccioso e pele
  ('sepse', 'A41.9', 'popular'),
  ('celulite', 'L03.9', 'preferido'),
  ('erisipela', 'A46', 'preferido'),
  ('gastroenterite', 'A09', 'popular'),
  ('GECA', 'A09', 'sigla'),
  ('dengue', 'A90', 'preferido'),
  -- abdome
  ('dor abdominal', 'R10.4', 'preferido'),
  ('abdome agudo', 'R10.0', 'preferido'),
  ('apendicite', 'K37', 'preferido'),
  ('apendicite aguda', 'K35.9', 'preferido'),
  ('pancreatite aguda', 'K85.9', 'preferido'),
  ('colecistite', 'K81.9', 'preferido'),
  ('colecistite aguda', 'K81.0', 'preferido'),
  ('hemorragia digestiva', 'K92.2', 'popular'),
  -- outros
  ('lombalgia', 'M54.5', 'popular'),
  ('febre', 'R50.9', 'preferido'),
  ('anafilaxia', 'T78.2', 'popular'),
  ('choque anafilático', 'T78.2', 'preferido');

DO $$
DECLARE v_faltam text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM terminologia.cid10) THEN RETURN; END IF;
  SELECT string_agg(s.termo || ' → ' || s.cid, ', ') INTO v_faltam
    FROM pg_temp.cid_termo_carga s
   WHERE NOT EXISTS (SELECT 1 FROM terminologia.cid10 c WHERE c.codigo = s.cid);
  IF v_faltam IS NOT NULL THEN
    RAISE EXCEPTION 'CID sugerido: código fora da CID-10 carregada: %', v_faltam;
  END IF;
END $$;

INSERT INTO public.cid_termo (termo, termo_norm, cid, tipo, fonte)
SELECT s.termo, private.norm_cid_termo(s.termo), s.cid, s.tipo,
       'CID-10 DATASUS (descrição do código); lista proposta para revisão do RT em 06/11/2026'
  FROM pg_temp.cid_termo_carga s
  JOIN terminologia.cid10 c ON c.codigo = s.cid
ON CONFLICT ON CONSTRAINT cid_termo_unico DO NOTHING;


-- ── a sugestão ──────────────────────────────────────────────────────────────
-- 1. Quebra o texto em trechos: + , ; / . quebra de linha e a palavra "e".
-- 2. Negação (C6): trecho com "descartado", "afastado", "excluído",
--    "improvável", "negativo" ou "negado" sai inteiro (o termo pode vir antes:
--    "TEP afastado"); "sem", "não", "nega", "descartar", "afastar", "excluir"
--    apagam o que vem depois deles no trecho ("PAC sem DPOC" fica com PAC).
-- 3. Termos curados: o termo inteiro, palavra por palavra, dentro do trecho.
--    O termo mais longo vence o mais curto que ele contém ("DPOC exacerbada"
--    tira "DPOC"; "apendicite aguda" tira "apendicite").
-- 4. CIAP-2 (referência mais fraca, C4): quando o trecho é o próprio nome da
--    CIAP-2 (ou uma das partes separadas por "/"), a CID-10 relacionada da
--    tabela do e-SUS APS.
-- 5. Busca de texto na CID-10: do nome curado que não é sigla ("pneumonia"
--    traz as outras pneumonias; todas as palavras dele precisam casar) e do
--    trecho sem nenhum termo curado (OU entre as palavras; pelo menos metade
--    casa). Palavras de enchimento ("paciente", "estável", "suspeita"...) não
--    buscam; "aguda", "crônica", "grave"... só desempatam. Categoria de 3
--    caracteres que tem subcategorias fica de fora (o código vai até o 4º).
-- Até 5 códigos distintos, na ordem: curados, CIAP-2, texto. Todo código vem
-- de terminologia.cid10.
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
           (SELECT count(*) FROM unnest(pw.nucleo) w WHERE c.busca @@ plainto_tsquery('portuguese', w))::int AS casadas,
           (SELECT count(*) FROM unnest(pw.todas) w WHERE c.busca @@ plainto_tsquery('portuguese', w))::int AS casadas_todas,
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
REVOKE ALL ON FUNCTION public.cid_sugerir_do_texto(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cid_sugerir_do_texto(text) TO authenticated;
COMMENT ON FUNCTION public.cid_sugerir_do_texto(text) IS
  'CIDs de referência a partir do texto da hipótese (só leitura; a escolha é do médico). Decisão do RT de 06/11/2026, C1 a C7.';
