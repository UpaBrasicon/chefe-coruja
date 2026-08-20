-- ─────────────────────────────────────────────────────────────────────────────
-- Fix — terminologia.buscar: LOINC apenas em pt-BR
--
-- Filtra os resultados de LOINC para exibir SOMENTE termos com tradução
-- pt-BR (componente_pt preenchido). Exames sem tradução oficial não aparecem.
-- ─────────────────────────────────────────────────────────────────────────────

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
BEGIN
  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 50 THEN
    p_limite := 10;
  END IF;
  IF p_termo IS NULL OR length(trim(p_termo)) = 0 THEN
    RETURN;
  END IF;

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
    RETURN;
  END;

  -- ── CID-10 ────────────────────────────────────────────────────────────────
  IF p_tabela = 'cid10' THEN
    RETURN QUERY
      SELECT 'cid10'::text,
             t.codigo,
             t.descricao,
             jsonb_build_object('capitulo', t.capitulo, 'grupo', t.grupo),
             ts_rank(t.busca, v_query)
      FROM terminologia.cid10 t
      WHERE t.busca @@ v_query OR t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')
      ORDER BY (t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')) DESC, rank DESC, t.codigo
      LIMIT p_limite;
    RETURN;
  END IF;

  -- ── SIGTAP ────────────────────────────────────────────────────────────────
  IF p_tabela = 'sigtap_procedimento' THEN
    RETURN QUERY
      SELECT 'sigtap_procedimento'::text,
             t.codigo,
             t.nome,
             jsonb_build_object('complexidade', t.complexidade, 'sexo', t.sexo, 'idade_min', t.idade_min, 'idade_max', t.idade_max, 'valor_sa', t.valor_sa, 'valor_sh', t.valor_sh, 'valor_sp', t.valor_sp, 'competencia', t.competencia),
             ts_rank(t.busca, v_query)
      FROM terminologia.sigtap_procedimento t
      WHERE t.busca @@ v_query OR t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')
      ORDER BY (t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')) DESC, rank DESC, t.codigo
      LIMIT p_limite;
    RETURN;
  END IF;

  -- ── CBO ───────────────────────────────────────────────────────────────────
  IF p_tabela = 'cbo' THEN
    RETURN QUERY
      SELECT 'cbo'::text,
             t.codigo,
             t.titulo,
             NULL::jsonb,
             ts_rank(t.busca, v_query)
      FROM terminologia.cbo t
      WHERE t.busca @@ v_query OR t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')
      ORDER BY (t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')) DESC, rank DESC, t.codigo
      LIMIT p_limite;
    RETURN;
  END IF;

  -- ── CMED ──────────────────────────────────────────────────────────────────
  IF p_tabela = 'medicamento_cmed' THEN
    RETURN QUERY
      SELECT 'medicamento_cmed'::text,
             t.id,
             t.produto,
             jsonb_build_object('principio_ativo', t.principio_ativo, 'apresentacao', t.apresentacao, 'laboratorio', t.laboratorio, 'registro_anvisa', t.registro_anvisa, 'classe_terapeutica', t.classe_terapeutica, 'tarja', t.tarja, 'pf_sem_impostos', t.pf_sem_impostos, 'competencia', t.competencia),
             ts_rank(t.busca, v_query)
      FROM terminologia.medicamento_cmed t
      WHERE t.busca @@ v_query OR t.id ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')
      ORDER BY (t.id ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')) DESC, rank DESC, t.id
      LIMIT p_limite;
    RETURN;
  END IF;

  -- ── LOINC (SOMENTE pt-BR) ─────────────────────────────────────────────────
  IF p_tabela = 'loinc' THEN
    RETURN QUERY
      SELECT 'loinc'::text,
             t.codigo,
             -- descrição sempre em pt-BR (só retornamos linhas traduzidas)
             t.componente_pt,
             jsonb_build_object(
               'componente', t.componente,
               'componente_pt', t.componente_pt,
               'propriedade', t.propriedade,
               'unidade_exemplo', t.unidade_exemplo,
               'nome_curto', t.nome_curto,
               'nome_curto_pt', t.nome_curto_pt,
               'classe', t.classe
             ),
             ts_rank(t.busca, v_query)
      FROM terminologia.loinc t
      WHERE t.componente_pt IS NOT NULL AND t.componente_pt <> ''
        AND (t.busca @@ v_query OR t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%'))
      ORDER BY (t.codigo ILIKE (terminologia.unaccent_text(trim(p_termo)) || '%')) DESC, rank DESC, t.codigo
      LIMIT p_limite;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Tabela de terminologia inválida: %', p_tabela;
END;
$$;

GRANT EXECUTE ON FUNCTION terminologia.buscar(text, text, integer) TO authenticated;

-- ===========================================================================
-- DOWN — aplicar a versão anterior (git history da migration 00006).
-- ===========================================================================
