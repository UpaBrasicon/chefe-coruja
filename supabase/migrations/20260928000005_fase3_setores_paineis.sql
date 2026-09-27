-- Os painéis de Observação e de Internação não listavam setor nenhum:
-- setores_observacao/setores_internacao declaram `tipo text`, mas devolviam o
-- enum tipo_setor, e o PostgREST respondia 400 ("structure of query does not
-- match function result type"). Só o cast faltava.
CREATE OR REPLACE FUNCTION public.setores_observacao(p_unidade uuid)
RETURNS TABLE(id uuid, nome text, tipo text, ordem integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.nome, s.tipo::text, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND s.tipo = 'observacao'
    AND NOT (position('verm' in lower(s.nome)) > 0)
  ORDER BY s.ordem, s.nome;
END $$;

CREATE OR REPLACE FUNCTION public.setores_internacao(p_unidade uuid)
RETURNS TABLE(id uuid, nome text, tipo text, ordem integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.nome, s.tipo::text, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND (s.tipo IN ('internacao', 'uti', 'isolamento')
         OR (s.tipo = 'observacao' AND position('verm' in lower(s.nome)) > 0))
  ORDER BY s.ordem, s.nome;
END $$;
