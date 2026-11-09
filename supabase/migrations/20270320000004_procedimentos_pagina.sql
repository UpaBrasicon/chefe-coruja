-- ════════════════════════════════════════════════════════════════════════════
-- Item 05 do kit de desempenho, parte c (decisão do RT em 09/11/2026, A):
-- os procedimentos do paciente chegavam inteiros, da vida toda, ao
-- atendimento, aos cuidados do leito e ao BPA. procedimentos_do_paciente
-- ganha uma irmã "_pagina" que devolve {"total": n, "itens": [...]} só com a
-- página pedida (p_limite, padrão 20, máximo 200; p_deslocamento, padrão 0),
-- na mesma ordem (mais recente primeiro). Mesmo desenho da 20270320000003.
--
-- A original não muda: a irmã chama a original (SECURITY INVOKER), então a
-- regra de acesso e o segundo fator são os mesmos. Só cria (expand).
-- Limite conhecido: o servidor ainda monta a lista inteira; o ganho é na rede
-- e na tela.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.procedimentos_do_paciente_pagina(uuid, integer, integer);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.procedimentos_do_paciente_pagina(p_paciente uuid, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH lista AS (SELECT coalesce(public.procedimentos_do_paciente(p_paciente), '[]'::jsonb) AS l),
       janela AS (SELECT greatest(coalesce(p_deslocamento, 0), 0) AS de, least(greatest(coalesce(p_limite, 20), 1), 200) AS qt)
  SELECT jsonb_build_object(
    'total', jsonb_array_length(lista.l),
    'itens', coalesce((SELECT jsonb_agg(e ORDER BY o) FROM jsonb_array_elements(lista.l) WITH ORDINALITY t(e, o)
                        WHERE o > janela.de AND o <= janela.de + janela.qt), '[]'::jsonb))
  FROM lista, janela
$$;
REVOKE ALL ON FUNCTION public.procedimentos_do_paciente_pagina(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procedimentos_do_paciente_pagina(uuid, integer, integer) TO authenticated;
