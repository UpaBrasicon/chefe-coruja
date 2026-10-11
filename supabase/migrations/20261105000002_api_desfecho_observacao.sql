-- ════════════════════════════════════════════════════════════════════════════
-- Correção achada no teste da exportação (Fase 3, tarefa 9), que usa o mesmo
-- formato da API v1 (tarefa 7):
--
-- 1. Desfecho "observacao" saía como "internacao", e "cancelado" como
--    "outro". Agora os dois saem com o próprio nome; o contrato
--    (docs/api/openapi.yaml) ganha os dois valores.
-- 2. Atendimento encerrado com desfecho, mas sem desfecho_em (ex.: evasão
--    registrada no encerramento), saía sem data. Agora vale o encerrado_em.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.api_atendimento(e public.episodios)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'unidade_id', e.unidade_id, 'paciente', private.api_paciente_resumo(e.paciente_id),
    'setor', (SELECT s.nome FROM public.setores s WHERE s.id = e.setor_id),
    'chegada_em', e.chegada_em,
    'situacao', CASE
      WHEN e.etapa = 'encerrado' THEN 'encerrado'
      WHEN e.etapa = 'observacao' THEN 'em_observacao'
      WHEN e.etapa = 'internacao' THEN 'internado'
      WHEN e.etapa = 'triagem' THEN 'aguardando_triagem'
      WHEN e.atendimento_iniciado_em IS NOT NULL THEN 'em_atendimento'
      ELSE 'aguardando_medico' END,
    'classificacao', CASE WHEN e.cor_atual IS NOT NULL THEN jsonb_build_object('cor', e.cor_atual, 'classificada_em', e.classificado_em) END,
    'atendimento_medico_em', e.atendimento_iniciado_em,
    'cid_principal', (SELECT d.cid FROM public.diagnosticos_episodio d
                       WHERE d.episodio_id = e.id AND d.tipo = 'primario' AND d.encerrado_em IS NULL
                       ORDER BY d.registrado_em DESC LIMIT 1),
    'desfecho', CASE
      WHEN e.desfecho IS NULL THEN NULL
      WHEN e.desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido') THEN 'alta'
      WHEN e.desfecho IN ('internacao', 'observacao', 'transferencia', 'evasao', 'obito', 'cancelado') THEN e.desfecho
      ELSE 'outro' END,
    'desfecho_em', CASE WHEN e.desfecho IS NOT NULL THEN coalesce(e.desfecho_em, e.encerrado_em) END)
$$;
REVOKE ALL ON FUNCTION private.api_atendimento(public.episodios) FROM PUBLIC, anon, authenticated;
