-- ════════════════════════════════════════════════════════════════════════════
-- Rollback da migration 20270422000095_secretaria_estado_exato.sql: volta
-- public.secretaria_estado_unidades() ao corpo da 20270421000080 (ocupados e
-- regulações vencidas de 1 a 4 saem vazios, private.suprimir). Mesma
-- assinatura e permissões; nada se perde. O frontend lida com os dois jeitos
-- (vazio vira "menos de 5").
--
-- Para testar sem gravar (homologação), troque o COMMIT por ROLLBACK.
-- Ainda não rodado: a migration não foi aplicada em lugar nenhum.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public.secretaria_estado_unidades()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date;
BEGIN
  IF private.meu_perfil_id() IS NULL OR NOT EXISTS (SELECT 1 FROM private.unidades_da_minha_secretaria()) THEN
    RAISE EXCEPTION 'O estado das unidades é de quem cuida da secretaria.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_fim := (date_trunc('month', v_hoje) + interval '1 month' - interval '1 day')::date;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', u.id,
      'leitos', lt.total,
      'ocupados', private.suprimir(lt.ocupados),
      'ocupacao', CASE WHEN lt.total > 0 AND private.suprimir(lt.ocupados) IS NOT NULL AND private.suprimir(lt.total) IS NOT NULL
                       THEN round(100.0 * lt.ocupados / lt.total, 1) END,
      'hoje', jsonb_build_object('plantoes', fx.faixas, 'cobertas', fx.cobertas, 'com_vaga', fx.com_vaga, 'vagas', fx.vagas),
      'vagas_ate_fim_do_mes', va.vagas,
      'regulacoes_vencidas', private.suprimir(rg.n),
      -- cada pessoa uma vez, não cada vínculo (como pessoas_total de secretaria_indicadores)
      'pessoas', pe.n) ORDER BY u.nome)
      FROM public.unidades u
      CROSS JOIN LATERAL (
        SELECT count(*) AS total, count(*) FILTER (WHERE l.status = 'ocupado') AS ocupados
          FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
         WHERE s.unidade_id = u.id AND s.ativo AND l.ativo) lt
      CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE jsonb_array_length(f.escalados) > 0 OR jsonb_array_length(f.abertas) > 0) AS faixas,
               count(*) FILTER (WHERE jsonb_array_length(f.escalados) > 0 AND jsonb_array_length(f.abertas) = 0) AS cobertas,
               count(*) FILTER (WHERE jsonb_array_length(f.abertas) > 0) AS com_vaga,
               coalesce(sum(jsonb_array_length(f.abertas)), 0) AS vagas
          FROM private.escala_faixas(u.id, v_hoje, v_hoje) f) fx
      CROSS JOIN LATERAL (
        SELECT coalesce(sum(jsonb_array_length(f.abertas)), 0) AS vagas
          FROM private.escala_faixas(u.id, v_hoje, v_fim) f) va
      CROSS JOIN LATERAL (
        -- vencida: na origem (resposta à central ou evolução), na fila da central ou sem resposta do destino
        SELECT count(*) AS n
          FROM public.regulacao_solicitacoes s
          CROSS JOIN LATERAL (SELECT private.regulacao_sla(s) AS sla) x
         WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino')
           AND ((s.unidade_origem_id = u.id
                 AND (coalesce((x.sla ->> 'atrasado_origem')::boolean, false) OR coalesce((x.sla ->> 'atrasado_central')::boolean, false)))
             OR (s.destino_unidade_id = u.id AND coalesce((x.sla ->> 'atrasado_destino')::boolean, false)))) rg
      CROSS JOIN LATERAL (
        SELECT count(DISTINCT v.perfil_id) AS n FROM public.vinculos v WHERE v.unidade_id = u.id AND v.ativo) pe
     WHERE u.ativo AND u.id IN (SELECT private.unidades_da_minha_secretaria())), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.secretaria_estado_unidades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_estado_unidades() TO authenticated;

COMMIT;
