-- Fase 4.2 — folha A4 gerada no servidor.
--
-- A edge function `folha` chama esta RPC com o token de quem imprime: ela
-- confere o acesso, registra a impressão (protocolo IMP-…) e devolve o
-- conteúdo EMITIDO do banco — não o que está na tela — com o número, a
-- versão, o autor e o código de conferência (derivado do hash do conteúdo).
-- A folha que sai no papel é, assim, sempre a do documento gravado.

CREATE OR REPLACE FUNCTION public.folha_documento(p_documento uuid, p_tipo_impressao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
  imp record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF d.estado NOT IN ('ativo', 'retificado', 'assinado') OR d.numero IS NULL THEN
    RAISE EXCEPTION 'Só se imprime documento emitido.';
  END IF;
  IF NOT (d.autor_id = v_perfil OR private.pode_atuar_no_paciente(d.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  SELECT * INTO imp FROM public.registrar_impressao(d.paciente_id,
    coalesce(nullif(btrim(p_tipo_impressao), ''), replace(d.tipo_documento, '_', ' ')), d.internacao_id, d.id);
  RETURN jsonb_build_object(
    'tipo', d.tipo_documento,
    'conteudo', d.conteudo,
    'numero', d.numero,
    'versao', d.versao,
    'estado', d.estado,
    'autor', (SELECT nome_completo FROM public.perfis WHERE id = d.autor_id),
    'codigo', upper(substr(d.conteudo_hash, 1, 4) || '-' || substr(d.conteudo_hash, 5, 4) || '-' || substr(d.conteudo_hash, 9, 4)),
    'protocolo', imp.protocolo,
    'impresso_em', imp.emitido_em);
END $$;
REVOKE ALL ON FUNCTION public.folha_documento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_documento(uuid, text) TO authenticated;
