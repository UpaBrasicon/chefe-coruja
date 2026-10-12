-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 5 — ocupação por setor (P1-04 do teste de ponta
-- a ponta de 11/10/2026; decisões do RT de 11/10/2026, BACKLOG.md).
--
-- • Conta as internações abertas pelo setor atual da internação (a base do
--   censo, do mapa de leitos e da enfermagem), não mais pacientes.setor_id,
--   que a porta não atualiza na observação.
-- • Setores que entram: internação, observação, isolamento e UTI. Ficam fora
--   a emergência (porta) e "outro" (setores sem leito, como a central de
--   regulação).
-- • Internado sem leito conta no setor e vem à parte (sem_leito), para a
--   superlotação ficar explicada (ex.: 8 internados para 6 leitos, 2 sem
--   leito). O limite continua sendo o número de leitos ativos.
-- • O tipo de retorno muda (coluna sem_leito): a função é recriada.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.ocupacao_setores(uuid);
CREATE FUNCTION public.ocupacao_setores(p_unidade uuid)
RETURNS TABLE(setor_id uuid, setor_nome text, internados bigint, limite integer, sem_leito bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  WITH abertas AS (
    SELECT i.setor_atual_id, i.leito_atual_id
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL
       AND i.status IN ('admitido', 'em_observacao', 'internado')
  )
  SELECT s.id, s.nome,
         (SELECT count(*) FROM abertas a WHERE a.setor_atual_id = s.id)::bigint,
         (SELECT count(*) FROM public.leitos l WHERE l.setor_id = s.id AND l.ativo)::int,
         (SELECT count(*) FROM abertas a WHERE a.setor_atual_id = s.id AND a.leito_atual_id IS NULL)::bigint
    FROM public.setores s
   WHERE s.unidade_id = p_unidade
     AND s.ativo
     AND s.tipo IN ('internacao', 'observacao', 'isolamento', 'uti')
   ORDER BY s.ordem, s.nome;
END $$;
REVOKE ALL ON FUNCTION public.ocupacao_setores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocupacao_setores(uuid) TO authenticated, service_role;
