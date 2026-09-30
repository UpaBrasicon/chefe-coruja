-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend — atendimentos anteriores SEM DESFECHO (decisão do
-- usuário em 29/09/2026).
--
-- A gaveta do leito e da porta mostra ao médico os atendimentos anteriores
-- do paciente que ficaram em aberto: sem alta, sem encaminhamento para
-- outro setor (observação) e sem internação — isto é, episódio com
-- `desfecho` nulo. Atendimento com desfecho não entra: o histórico
-- encerrado segue pelo pedido de acesso ao prontuário (fase 6).
--
-- A RLS de `episodios` só abre os setores em que a pessoa está escalada
-- agora, e o atendimento esquecido costuma estar em outro setor (a porta).
-- Por isso a leitura é por esta função: ela confere que quem pede pode atuar
-- no paciente agora (private.pode_atuar_no_paciente: paciente no plantão dela,
-- gestor da unidade ou super admin) e devolve só os episódios em aberto
-- daquele paciente, na unidade dele, sem o episódio atual.
--
-- DOWN: DROP FUNCTION public.atendimentos_sem_desfecho(uuid, uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.atendimentos_sem_desfecho(p_paciente uuid, p_exceto uuid DEFAULT NULL)
RETURNS TABLE (
  episodio_id uuid,
  chegada_em timestamptz,
  etapa text,
  queixa text,
  cor_atual text,
  classificado_em timestamptz,
  atendimento_iniciado_em timestamptz,
  setor_nome text,
  medico_nome text,
  ultimo_registro text,
  ultimo_registro_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.pode_atuar_no_paciente(p_paciente) THEN
    RAISE EXCEPTION 'Paciente fora do seu cuidado agora.';
  END IF;

  RETURN QUERY
  SELECT e.id, e.chegada_em, e.etapa, e.queixa, e.cor_atual, e.classificado_em, e.atendimento_iniciado_em,
         s.nome, m.nome_completo,
         r.texto, r.criado_em
  FROM public.episodios e
  JOIN public.pacientes pa ON pa.id = e.paciente_id
  LEFT JOIN public.setores s ON s.id = e.setor_id
  LEFT JOIN public.perfis m ON m.id = e.atendimento_medico_id
  LEFT JOIN LATERAL (
    SELECT concat_ws(E'\n',
             CASE WHEN nullif(btrim(ar.subjetivo), '') IS NOT NULL THEN 'S: ' || btrim(ar.subjetivo) END,
             CASE WHEN nullif(btrim(ar.objetivo), '') IS NOT NULL THEN 'O: ' || btrim(ar.objetivo) END,
             CASE WHEN nullif(btrim(ar.avaliacao), '') IS NOT NULL THEN 'A: ' || btrim(ar.avaliacao) END,
             CASE WHEN nullif(btrim(ar.plano), '') IS NOT NULL THEN 'P: ' || btrim(ar.plano) END) AS texto,
           ar.criado_em
    FROM public.atendimento_registros ar
    WHERE ar.episodio_id = e.id
    ORDER BY ar.criado_em DESC
    LIMIT 1
  ) r ON true
  WHERE e.paciente_id = p_paciente
    AND e.unidade_id = pa.unidade_id
    AND e.desfecho IS NULL
    AND e.encerrado_em IS NULL
    AND (p_exceto IS NULL OR e.id <> p_exceto)
  ORDER BY e.chegada_em DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atendimentos_sem_desfecho(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.atendimentos_sem_desfecho(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.atendimentos_sem_desfecho(uuid, uuid) IS
  'Atendimentos anteriores do paciente sem desfecho (sem alta, encaminhamento ou internação), para quem pode atuar nele agora. Decisão do usuário em 29/09/2026.';
