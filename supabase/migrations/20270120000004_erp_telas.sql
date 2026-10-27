-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 3 (ERP/financeiro), etapa 3.4: tela "Envio ao ERP"
-- (opção A do RT, 27/10/2026: lista com filtro e gaveta).
--
-- erp_contas_da_unidade: as versões das contas dos últimos 13 meses, com o
--   mesmo conteúdo que o ERP recebe pela API (faturamento, gestor).
-- erp_baixar: o mesmo conteúdo para o arquivo CSV ou JSON da tela (decisão
--   1a: "a tela do faturamento baixa o mesmo conteúdo"); cada baixa vai para a
--   auditoria. Os plantões (com CPF) só para o gestor, com segundo fator, e só
--   de mês já fechado.
-- A prévia, o fechamento e a reabertura dos plantões já existem (etapa 3.2).
--
-- expand: só funções novas.
--
-- Rollback (testado na homologação):
--   DROP FUNCTION IF EXISTS public.erp_baixar(uuid, text, text, text), public.erp_contas_da_unidade(uuid);
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.erp_contas_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'faturamento') OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: o envio ao ERP é do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.erp_versao_json(v) ORDER BY v.alterada_em DESC, v.id)
                     FROM public.conta_versoes_erp v
                    WHERE v.unidade_id = p_unidade AND v.gerada_em > now() - interval '13 months'), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.erp_baixar(p_unidade uuid, p_conjunto text, p_formato text, p_competencia text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dados jsonb;
BEGIN
  IF p_formato IS NULL OR p_formato NOT IN ('csv', 'json') THEN RAISE EXCEPTION 'Formato: csv ou json.'; END IF;
  IF p_conjunto = 'contas' THEN
    v_dados := public.erp_contas_da_unidade(p_unidade);
  ELSIF p_conjunto = 'plantoes' THEN
    PERFORM private.exigir_segundo_fator();
    IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
      RAISE EXCEPTION 'Acesso negado: os plantões para o ERP são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT private.competencia_valida(p_competencia) THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
    v_dados := coalesce((SELECT jsonb_agg(private.erp_plantao_versao_json(v) ORDER BY v.versao)
                           FROM public.plantao_versoes_erp v WHERE v.unidade_id = p_unidade AND v.competencia = p_competencia), '[]'::jsonb);
    IF jsonb_array_length(v_dados) = 0 THEN RAISE EXCEPTION 'Os plantões deste mês ainda não foram fechados.'; END IF;
  ELSE
    RAISE EXCEPTION 'Conjunto: contas ou plantoes.';
  END IF;
  PERFORM private.registrar_auditoria('erp_baixado', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('conjunto', p_conjunto, 'formato', p_formato, 'competencia', p_competencia, 'versoes', jsonb_array_length(v_dados)));
  RETURN v_dados;
END $$;
REVOKE ALL ON FUNCTION public.erp_contas_da_unidade(uuid), public.erp_baixar(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_contas_da_unidade(uuid), public.erp_baixar(uuid, text, text, text) TO authenticated;
