-- ════════════════════════════════════════════════════════════════════════════
-- Item 05 do kit de desempenho, parte b (decisão do RT em 09/11/2026, A):
-- listas administrativas que crescem com o uso e chegavam inteiras à tela
-- (AIH e APAC da unidade). Cada RPC
-- ganha uma irmã "_pagina" que devolve {"total": n, "itens": [...]} só com a
-- página pedida (p_limite, padrão 50, máximo 200; p_deslocamento, padrão 0),
-- na mesma ordem da original.
--
-- As originais não mudam: a irmã chama a original (SECURITY INVOKER), então
-- as regras de acesso e o segundo fator são os mesmos, e quem ainda chama a
-- original não é afetado. Só cria funções (expand).
-- Limite conhecido: o servidor ainda monta a lista inteira; o ganho é na rede
-- e na tela (o celular recebe e desenha só uma página). Paginar dentro da
-- consulta fica para quando os números do item 30 pedirem.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.aihs_da_unidade_pagina(uuid, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.apacs_da_unidade_pagina(uuid, text, integer, integer);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.aihs_da_unidade_pagina(p_unidade uuid, p_status text DEFAULT NULL, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH lista AS (SELECT coalesce(public.aihs_da_unidade(p_unidade, p_status), '[]'::jsonb) AS l),
       janela AS (SELECT greatest(coalesce(p_deslocamento, 0), 0) AS de, least(greatest(coalesce(p_limite, 50), 1), 200) AS qt)
  SELECT jsonb_build_object(
    'total', jsonb_array_length(lista.l),
    'itens', coalesce((SELECT jsonb_agg(e ORDER BY o) FROM jsonb_array_elements(lista.l) WITH ORDINALITY t(e, o)
                        WHERE o > janela.de AND o <= janela.de + janela.qt), '[]'::jsonb))
  FROM lista, janela
$$;
REVOKE ALL ON FUNCTION public.aihs_da_unidade_pagina(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aihs_da_unidade_pagina(uuid, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.apacs_da_unidade_pagina(p_unidade uuid, p_status text DEFAULT NULL, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH lista AS (SELECT coalesce(public.apacs_da_unidade(p_unidade, p_status), '[]'::jsonb) AS l),
       janela AS (SELECT greatest(coalesce(p_deslocamento, 0), 0) AS de, least(greatest(coalesce(p_limite, 50), 1), 200) AS qt)
  SELECT jsonb_build_object(
    'total', jsonb_array_length(lista.l),
    'itens', coalesce((SELECT jsonb_agg(e ORDER BY o) FROM jsonb_array_elements(lista.l) WITH ORDINALITY t(e, o)
                        WHERE o > janela.de AND o <= janela.de + janela.qt), '[]'::jsonb))
  FROM lista, janela
$$;
REVOKE ALL ON FUNCTION public.apacs_da_unidade_pagina(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apacs_da_unidade_pagina(uuid, text, integer, integer) TO authenticated;
