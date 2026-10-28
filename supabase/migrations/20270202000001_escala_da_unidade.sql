-- Aba Escala para todos os papéis, entrega E0 (decisão do RT em 27/10/2026):
-- corrige a "Escala da unidade" e a troca do plantonista.
--
-- Defeito: a tela lia public.escala_plantao direto, e a RLS da tabela só devolve
-- a linha da própria pessoa (ou tudo ao gestor e ao super admin). O plantonista
-- via os turnos dos colegas como "livre" e a lista de plantões para troca vazia.
--
-- Correção: a leitura passa por esta função. A RLS da tabela não muda.
--   * gestor da unidade e super admin: a escala inteira (o mesmo que a RLS dá);
--   * os demais: os próprios plantões e, para quem tem vínculo de plantonista na
--     unidade, os plantões de quem também tem vínculo de plantonista nela
--     ("a escala da equipe da minha categoria", resposta 2 do RT). Na E1 o filtro
--     passa a ser a categoria gravada no plantão, sem mudar a assinatura;
--   * dos colegas sai só o que a tela mostra: setor, dia, turno, horário, rótulo,
--     nome e CRM. A observação (passagem de plantão) só vai para o dono e o gestor;
--   * no máximo 62 dias por chamada.
--
-- Rollback: DROP FUNCTION IF EXISTS public.escala_da_unidade(uuid, date, date);

CREATE OR REPLACE FUNCTION public.escala_da_unidade(p_unidade uuid, p_de date, p_ate date)
RETURNS TABLE (
  id                uuid,
  unidade_id        uuid,
  setor_id          uuid,
  perfil_id         uuid,
  data              date,
  turno             text,
  inicio            timestamptz,
  duracao_min       integer,
  rotulo            text,
  observacao        text,
  quinzenal         boolean,
  fracionado        boolean,
  plantao_origem_id uuid,
  nome_completo     text,
  crm               text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_eu      uuid := private.meu_perfil_id();
  v_tudo    boolean;
  v_equipe  boolean;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: entre no app.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_unidade IS NULL OR p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN
    RAISE EXCEPTION 'Informe a unidade e o período.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_ate - p_de > 62 THEN
    RAISE EXCEPTION 'Período maior que 62 dias.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_tudo := private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor';
  IF NOT v_tudo AND NOT EXISTS (
    SELECT 1 FROM public.vinculos v
    WHERE v.perfil_id = v_eu AND v.unidade_id = p_unidade AND v.ativo
  ) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com esta unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_equipe := EXISTS (
    SELECT 1 FROM public.vinculos v
    WHERE v.perfil_id = v_eu AND v.unidade_id = p_unidade AND v.ativo
      AND v.papel = 'plantonista'
  );

  RETURN QUERY
  SELECT e.id, e.unidade_id, e.setor_id, e.perfil_id, e.data, e.turno, e.inicio, e.duracao_min,
         e.rotulo,
         CASE WHEN v_tudo OR e.perfil_id = v_eu THEN e.observacao END,
         e.quinzenal, e.fracionado, e.plantao_origem_id,
         p.nome_completo, p.crm
  FROM public.escala_plantao e
  LEFT JOIN public.perfis p ON p.id = e.perfil_id
  WHERE e.unidade_id = p_unidade
    AND e.ativo
    AND e.data BETWEEN p_de AND p_ate
    AND (
      v_tudo
      OR e.perfil_id = v_eu
      OR (v_equipe AND EXISTS (
        SELECT 1 FROM public.vinculos c
        WHERE c.perfil_id = e.perfil_id AND c.unidade_id = p_unidade AND c.ativo
          AND c.papel = 'plantonista'
      ))
    )
  ORDER BY e.data, e.inicio NULLS LAST, e.setor_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.escala_da_unidade(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escala_da_unidade(uuid, date, date) TO authenticated;
