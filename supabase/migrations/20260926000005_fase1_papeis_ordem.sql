-- Ordem dos papéis em papel_na_unidade (o "mais forte" de quem tem vários
-- vínculos na mesma unidade). Os novos vêm depois do plantonista: nenhum deles
-- pode esconder um vínculo de gestão ou de plantão.
CREATE OR REPLACE FUNCTION private.papel_na_unidade(unidade uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT v.papel::text
    FROM public.vinculos v
    WHERE v.perfil_id = private.meu_perfil_id()
      AND v.unidade_id = unidade
      AND v.ativo
    ORDER BY CASE v.papel
      WHEN 'admin'              THEN 0
      WHEN 'gestor'             THEN 1
      WHEN 'plantonista'        THEN 2
      WHEN 'telemedicina'       THEN 3
      WHEN 'enfermeiro'         THEN 4
      WHEN 'tecnico_enfermagem' THEN 5
      WHEN 'farmaceutico'       THEN 6
      WHEN 'recepcao'           THEN 7
    END
    LIMIT 1), '');
$$;
