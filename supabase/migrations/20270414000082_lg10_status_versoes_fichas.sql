-- ════════════════════════════════════════════════════════════════════════════
-- LG10: aprovação clínica antes de publicar
-- (docs/regulatorio/LG10-GATE-APROVACAO-DIAGNOSTICO.md, decisões do RT de
-- 17/11/2026, todas A).
--
-- G6: o CI lê, na produção, o status das versões de ficha que um PR quer
-- publicar. A leitura é feita com a chave publicável, sem login. Por isso a
-- função é só de leitura e devolve apenas id, versão e status. Não devolve
-- nome, CRM, nota de decisão nem dado de paciente. O CI (scripts/gate-fichas.mjs)
-- só deixa mesclar quando toda versão nova está 'aprovada'.
--
-- Expand puro e idempotente: só cria uma função.
-- Volta: DROP FUNCTION IF EXISTS public.status_versoes_fichas(jsonb);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.status_versoes_fichas(p_itens jsonb)
RETURNS TABLE (ferramenta_id text, versao text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.ferramenta_id, i.versao, coalesce(v.status, 'nao_registrada')
    FROM (SELECT x.ferramenta_id, x.versao
            FROM jsonb_to_recordset(CASE WHEN jsonb_typeof(p_itens) = 'array' THEN p_itens ELSE '[]'::jsonb END)
                 AS x(ferramenta_id text, versao text)
           LIMIT 2000) i
    LEFT JOIN public.ferramenta_versoes v ON v.ferramenta_id = i.ferramenta_id AND v.versao = i.versao
$$;

COMMENT ON FUNCTION public.status_versoes_fichas(jsonb) IS
  'LG10: status de aprovação de versões de ficha (id, versão, status), para o gate do CI. Sem dado pessoal.';

REVOKE ALL ON FUNCTION public.status_versoes_fichas(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.status_versoes_fichas(jsonb) TO anon, authenticated;
