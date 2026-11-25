-- ════════════════════════════════════════════════════════════════════════════
-- Volta da migration 20270421000041_regulacao_pacientes_meus.sql.
--
-- Devolve o corpo ANTERIOR de public.regulacao_pacientes (tirado da
-- homologação com pg_get_functiondef em 24/11/2026, com a 20270421000040
-- aplicada). Saem do JSON os campos 'no_meu_plantao' (linha) e
-- 'sou_solicitante' (pedido); a tela sem eles mostra "Toda a unidade" para o
-- médico, como antes.
--
-- Idempotente. Testado na homologação em transação desfeita
-- (migration, esta volta, BEGIN … ROLLBACK).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.regulacao_pacientes(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_exigir_unidade(p_unidade);
  RETURN coalesce((
    WITH inter AS (
      SELECT DISTINCT ON (i.paciente_id) i.*
        FROM public.internacoes i
       WHERE i.unidade_id = p_unidade AND i.data_alta IS NULL
       ORDER BY i.paciente_id, i.data_admissao DESC
    ), regs AS (
      SELECT s.* FROM public.regulacao_solicitacoes s
       WHERE s.unidade_origem_id = p_unidade AND private.regulacao_em_aberto(s.status)
    ), pac AS (
      SELECT paciente_id FROM inter UNION SELECT paciente_id FROM regs
    ), linhas AS (
      SELECT pa.id, coalesce(pa.nome_social, pa.nome) AS nome, pa.data_nascimento,
             i.id AS internacao_id, i.tipo_internacao, i.data_admissao, i.episodio_id,
             se.id AS setor_id, se.nome AS setor_nome, le.identificador AS leito
        FROM pac
        JOIN public.pacientes pa ON pa.id = pac.paciente_id
        LEFT JOIN inter i ON i.paciente_id = pa.id
        LEFT JOIN public.setores se ON se.id = i.setor_atual_id
        LEFT JOIN public.leitos le ON le.id = i.leito_atual_id
    )
    SELECT jsonb_agg(jsonb_build_object(
        'paciente', jsonb_build_object('id', l.id, 'nome', l.nome, 'nascimento', l.data_nascimento),
        'internacao', CASE WHEN l.internacao_id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', l.internacao_id, 'tipo', l.tipo_internacao, 'admissao', l.data_admissao, 'episodio_id', l.episodio_id) END,
        'setor', CASE WHEN l.setor_id IS NULL THEN NULL ELSE jsonb_build_object('id', l.setor_id, 'nome', l.setor_nome) END,
        'leito', l.leito,
        'pedidos', coalesce((SELECT jsonb_agg(private.regulacao_resumo(r) ORDER BY r.criada_em DESC)
                               FROM regs r WHERE r.paciente_id = l.id), '[]'::jsonb))
      ORDER BY l.setor_nome NULLS LAST, l.leito NULLS LAST, l.nome)
      FROM linhas l), '[]'::jsonb);
END $function$;
REVOKE ALL ON FUNCTION public.regulacao_pacientes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_pacientes(uuid) TO authenticated;

COMMIT;
