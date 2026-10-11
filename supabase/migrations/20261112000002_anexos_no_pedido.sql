-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 6 — ajuste pedido pelo RT no teste da homologação
-- (11/10/2026): os anexos entram já na nova solicitação. Para escolher os
-- documentos do prontuário antes de o pedido existir, a origem lista os
-- documentos do paciente (versão mais recente, sem o texto). Os arquivos e os
-- documentos escolhidos são anexados logo depois do envio, pelas RPCs da
-- migration 20261112000001.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.regulacao_documentos_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.tenho_papel(v_unidade, 'plantonista') OR private.tenho_papel(v_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo_documento, 'numero', d.numero, 'versao', d.versao,
      'emitido_em', coalesce(d.emitido_em, d.created_at), 'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = d.autor_id))
      ORDER BY coalesce(d.emitido_em, d.created_at) DESC)
    FROM (SELECT DISTINCT ON (dc.documento_raiz_id) dc.* FROM public.documentos_clinicos dc
           WHERE dc.paciente_id = p_paciente AND dc.estado NOT IN ('rascunho', 'cancelado')
           ORDER BY dc.documento_raiz_id, dc.versao DESC) d), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_documentos_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_documentos_do_paciente(uuid) TO authenticated;
