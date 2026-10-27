-- Fila do PS com dados novos (P2, pedido do RT em 21/10/2026; diagnóstico em
-- docs/porta/FILA-PS-DADOS-NOVOS-DIAGNOSTICO.md, decisões D1–D5 aceitas pelo RT em 27/10/2026).
--
-- Para a fila do médico: por episódio da porta (triagem e atendimento) dos setores em
-- que quem chama está na escala agora — o mesmo recorte da fila —, a alergia, a sala da
-- última chamada, o médico responsável, os exames ("N de M" com resultado), a
-- medicação (contagem de pendentes e a hora da última checagem) e o alvo da cor da
-- unidade (D5: a fila deixa o alvo fixo de Manchester).
--
-- D3: a medicação de outro médico vem só como contagem e hora, sem o nome do remédio;
-- a política de prescricoes não muda. Nada de texto clínico, resultado ou remédio sai daqui.
-- Só leitura; nenhuma tabela, coluna, índice ou política nova.
--
-- Rollback: DROP FUNCTION IF EXISTS public.fila_ps_detalhes();

CREATE OR REPLACE FUNCTION public.fila_ps_detalhes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();

  WITH eps AS (
    SELECT e.id, e.unidade_id, e.paciente_id, e.cor_atual, e.atendimento_medico_id
      FROM public.episodios e
     WHERE e.etapa IN ('triagem', 'atendimento')
       AND e.setor_id IN (SELECT private.setores_na_escala_agora())
  ), alvos AS (
    SELECT u.unidade_id, private.tempos_alvo_unidade(u.unidade_id) AS tempos
      FROM (SELECT DISTINCT unidade_id FROM eps) u
  )
  SELECT coalesce(jsonb_object_agg(e.id, jsonb_build_object(
           -- D5: o alvo da cor da unidade (ajuste › protocolo › Manchester)
           'alvo_min', (a.tempos ->> e.cor_atual)::int,
           -- D2: tem (substâncias, a grave primeiro), nega, desconhece ou não perguntado
           'alergia', CASE
              WHEN al.itens IS NOT NULL THEN jsonb_build_object('situacao', 'tem', 'itens', al.itens)
              WHEN ng.tipo IS NOT NULL THEN jsonb_build_object('situacao', ng.tipo, 'itens', '[]'::jsonb)
              ELSE jsonb_build_object('situacao', 'nao_perguntado', 'itens', '[]'::jsonb) END,
           'sala', sa.nome,
           'medico', pf.nome_completo,
           'exames', jsonb_build_object('feitos', ex.feitos, 'total', ex.total),
           'medicacao', jsonb_build_object('pendentes', md.pendentes, 'ultima_em', md.ultima_em))), '{}'::jsonb)
    INTO v
    FROM eps e
    LEFT JOIN alvos a ON a.unidade_id = e.unidade_id
    LEFT JOIN public.perfis pf ON pf.id = e.atendimento_medico_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('substancia', x.substancia, 'gravidade', x.gravidade)
               ORDER BY (x.gravidade = 'grave') DESC, x.registrado_em) AS itens
        FROM public.alergias_paciente x
       WHERE x.paciente_id = e.paciente_id AND x.inativada_em IS NULL) al ON true
    LEFT JOIN LATERAL (
      SELECT n.tipo FROM public.alergias_negacoes n
       WHERE n.paciente_id = e.paciente_id AND n.encerrada_em IS NULL LIMIT 1) ng ON true
    LEFT JOIN LATERAL (
      SELECT s.nome FROM public.chamadas c JOIN public.salas s ON s.id = c.sala_id
       WHERE c.episodio_id = e.id ORDER BY c.criado_em DESC LIMIT 1) sa ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS total, count(*) FILTER (WHERE x.situacao = 'resultado')::int AS feitos
        FROM public.exames_pedidos x WHERE x.episodio_id = e.id AND x.situacao <> 'cancelado') ex ON true
    LEFT JOIN LATERAL (
      -- a regra de private.medicacao_sem_checagem: porta, medicamento, não suspenso, não "se necessário"
      SELECT count(*) FILTER (WHERE NOT EXISTS (
               SELECT 1 FROM public.administracoes ad WHERE ad.item_id = it.id AND ad.situacao = 'feito'))::int AS pendentes,
             max((SELECT max(ad.registrado_em) FROM public.administracoes ad
                   WHERE ad.item_id = it.id AND ad.situacao = 'feito')) AS ultima_em
        FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
       WHERE pr.episodio_id = e.id AND pr.internacao_id IS NULL
         AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL AND NOT it.se_necessario) md ON true;

  RETURN jsonb_build_object('gerado_em', now(), 'episodios', v);
END; $function$;

REVOKE ALL ON FUNCTION public.fila_ps_detalhes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fila_ps_detalhes() TO authenticated;

COMMENT ON FUNCTION public.fila_ps_detalhes() IS
  'Fila do PS do médico: por episódio da porta nos setores da escala de quem chama, alergia, sala, médico, exames, medicação (só contagem) e alvo da cor da unidade.';
