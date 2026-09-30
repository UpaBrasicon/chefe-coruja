-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — Avisos com "Marcar como lido", "Marcar todas
-- como lidas" e filtros (P/index.html 9561–9598; valsAvisos 25980–26020).
--
-- Os avisos já moram em notificacoes_plantonista (minhas_notificacoes lê; a
-- categoria sai do prefixo do tipo, na tela). Faltava marcar em lote e o
-- desfazer, com a reversão no servidor:
--  * marcar_avisos_lidos(unidade, ids): marca como lidos os avisos NÃO LIDOS
--    do próprio usuário na unidade (todos, se ids vier nulo) e devolve os ids
--    que mudaram — é o que o desfazer precisa;
--  * reabrir_avisos(ids): volta a não lido, só avisos do próprio usuário
--    marcados há até 10 minutos (o desfazer).
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.marcar_avisos_lidos(p_unidade uuid, p_ids uuid[] DEFAULT NULL)
RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ids uuid[];
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  WITH m AS (
    UPDATE public.notificacoes_plantonista n SET lida_em = now()
     WHERE n.perfil_id = private.meu_perfil_id() AND n.unidade_id = p_unidade AND n.lida_em IS NULL
       AND (p_ids IS NULL OR n.id = ANY (p_ids))
    RETURNING n.id)
  SELECT coalesce(array_agg(m.id), '{}') INTO v_ids FROM m;
  RETURN v_ids;
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_avisos(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_n integer;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  UPDATE public.notificacoes_plantonista n SET lida_em = NULL
   WHERE n.perfil_id = private.meu_perfil_id() AND n.id = ANY (coalesce(p_ids, '{}'))
     AND n.lida_em > now() - interval '10 minutes';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.marcar_avisos_lidos(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reabrir_avisos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_avisos_lidos(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_avisos(uuid[]) TO authenticated;
