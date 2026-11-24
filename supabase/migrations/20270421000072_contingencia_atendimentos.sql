-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes da revisão (RT, 24/11/2026), item 3: atendimentos de uma contingência.
--
-- contingencias_da_unidade só devolve contagens ("3 de 7 atendimentos com
-- reentrada"); a equipe não tinha onde ver quais faltam. A RPC nova
-- contingencia_atendimentos(p_contingencia) lista os atendimentos do período
-- (mesma regra da contagem: chegou até o fim e não tinha encerrado antes do
-- início), cada um com a reentrada feita (quando e por quem) ou pendente.
--
-- Sem expor mais do que a equipe já vê:
--   • precisa ser da unidade da contingência (membro_da_unidade), como a
--     contingencias_da_unidade;
--   • o gestor da unidade (tenho_papel, vale para conta com vários papéis) e o
--     administrador geral veem todos;
--   • os outros só veem o atendimento do paciente em que já podem atuar
--     (pode_atuar_no_paciente) ou com acesso aprovado vigente
--     (acesso_encerrado_vigente), a mesma regra da RLS de
--     reentradas_contingencia. Os demais entram só na contagem
--     ("fora do seu acesso"), que a tela da contingência já mostrava.
--
-- Expand puro: função nova, sem tabela nova.
-- ROLLBACK: DROP FUNCTION IF EXISTS public.contingencia_atendimentos(uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.contingencia_atendimentos(p_contingencia uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.contingencias;
  v_todos boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contingencias WHERE id = p_contingencia;
  IF c.id IS NULL OR private.membro_da_unidade(c.unidade_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_todos := coalesce(private.eh_super_admin(), false) OR private.tenho_papel(c.unidade_id, 'gestor') IS TRUE;

  RETURN (
    WITH ep AS (
      SELECT e.id, e.paciente_id, e.chegada_em, e.encerrado_em,
             (v_todos OR private.pode_atuar_no_paciente(e.paciente_id)
                      OR private.acesso_encerrado_vigente(e.paciente_id)) AS visivel
        FROM public.episodios e
       WHERE e.unidade_id = c.unidade_id
         AND e.chegada_em <= c.fim
         AND coalesce(e.encerrado_em, now()) >= c.inicio
    ), x AS (
      SELECT ep.*, r.registrado_em AS reentrada_em, r.registrado_por AS reentrada_por
        FROM ep
        LEFT JOIN LATERAL (
          SELECT rc.registrado_em, rc.registrado_por FROM public.reentradas_contingencia rc
           WHERE rc.contingencia_id = c.id AND rc.episodio_id = ep.id
           ORDER BY rc.registrado_em LIMIT 1) r ON true
    )
    SELECT jsonb_build_object(
      'atendimentos', coalesce(jsonb_agg(jsonb_build_object(
          'episodio_id', x.id, 'paciente_id', x.paciente_id, 'paciente_nome', pa.nome,
          'chegada_em', x.chegada_em, 'encerrado_em', x.encerrado_em,
          'reentrada_em', x.reentrada_em,
          'reentrada_por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = x.reentrada_por))
        ORDER BY (x.reentrada_em IS NOT NULL), x.chegada_em) FILTER (WHERE x.visivel), '[]'::jsonb),
      'fora_do_seu_acesso', count(*) FILTER (WHERE NOT x.visivel),
      'pendentes_fora', count(*) FILTER (WHERE NOT x.visivel AND x.reentrada_em IS NULL))
      FROM x LEFT JOIN public.pacientes pa ON pa.id = x.paciente_id
  );
END $$;
REVOKE ALL ON FUNCTION public.contingencia_atendimentos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contingencia_atendimentos(uuid) TO authenticated;
