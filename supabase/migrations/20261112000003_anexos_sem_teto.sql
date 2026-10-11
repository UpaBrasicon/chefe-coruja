-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 6 — decisão do RT no teste da homologação (11/10/2026): o
-- pedido não tem teto de anexos. Há paciente que pede muitos exames e laudos
-- e outro que não pede nenhum. Continua o limite de 10 MB por arquivo e os
-- tipos PDF, JPG e PNG.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.regulacao_anexo_conferir(s public.regulacao_solicitacoes)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.regulacao_pode_anexar(s) THEN
    RAISE EXCEPTION 'Anexam o solicitante, o médico assistente e o gestor da origem, e o regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida') THEN
    RAISE EXCEPTION 'Só se anexa com o pedido em aberto.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_anexo_conferir(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;
