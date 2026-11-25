-- ════════════════════════════════════════════════════════════════════════════
-- Envio à UPA feito da escuta: o médico informa o CID-10 ou a CIAP-2
-- (decisão do RT em 25/11/2026, segunda rodada do item A-13 do teste de fluxo A).
--
-- A ficha da UBS encerrada pelo envio da escuta já fechava como encaminhamento
-- (migration 20270426000012), mas ficava retida na carga do SISAB: a ficha de
-- atendimento individual não sai sem problema, CID nem CIAP. O envio pela
-- escuta passa a exigir um dos dois, e a ficha fecha com ele:
--   - encaminhar_upa ganha p_cid e p_ciap (opcionais na assinatura);
--   - com a ficha na escuta (etapa "triagem"), um dos dois é obrigatório, o CID
--     tem de existir na CID-10 e a CIAP na tabela do e-SUS APS;
--   - a ficha encerra com cid_aps / ciap_aps e a conduta de encaminhamento.
-- No envio feito da consulta nada muda: o problema e a conduta continuam vindo
-- da aba Conduta (registrar_conduta_aps), e p_cid / p_ciap são ignorados.
--
-- Expand/contract: a função é recriada com dois parâmetros a mais, com padrão
-- nulo, e a de três parâmetros sai na mesma transação (as chamadas com três
-- argumentos continuam valendo). Mesmos GRANTs. Idempotente.
--
-- Rollback: recriar public.encaminhar_upa(uuid, uuid, text) com o corpo de
-- 20270426000012 (tirar os dois parâmetros, as duas variáveis, o bloco "envio
-- pela escuta" e os dois campos do UPDATE) e
--   DROP FUNCTION public.encaminhar_upa(uuid, uuid, text, text, text);
-- ════════════════════════════════════════════════════════════════════════════

DO $m$
DECLARE
  def text;
  novo text;
  pares text[] := ARRAY[
    -- 1. assinatura
    'public.encaminhar_upa(p_episodio uuid, p_destino uuid, p_motivo text)',
    'public.encaminhar_upa(p_episodio uuid, p_destino uuid, p_motivo text, p_cid text DEFAULT NULL::text, p_ciap text DEFAULT NULL::text)',
    -- 2. variáveis
    E'  v_resumo jsonb;\nBEGIN',
    E'  v_resumo jsonb;\n  v_cid text;\n  v_ciap text;\nBEGIN',
    -- 3. conferência do envio pela escuta
    E'    RAISE EXCEPTION ''Já há um envio à UPA em andamento para esta consulta.'';\n  END IF;\n',
    E'    RAISE EXCEPTION ''Já há um envio à UPA em andamento para esta consulta.'';\n  END IF;\n'
    || E'  -- envio pela escuta (RT, 25/11/2026): o médico informa o CID-10 ou a CIAP-2 do problema,\n'
    || E'  -- para a ficha da UBS fechar como encaminhamento e ir ao SISAB\n'
    || E'  IF e.etapa = ''triagem'' THEN\n'
    || E'    IF nullif(btrim(p_cid), '''') IS NOT NULL THEN v_cid := private.cid_existente(p_cid); END IF;\n'
    || E'    v_ciap := upper(nullif(btrim(p_ciap), ''''));\n'
    || E'    IF v_ciap IS NOT NULL AND NOT EXISTS (SELECT 1 FROM terminologia.ciap2 t WHERE t.codigo = v_ciap) THEN\n'
    || E'      RAISE EXCEPTION ''CIAP-2 não encontrada na tabela do e-SUS APS: %.'', v_ciap;\n'
    || E'    END IF;\n'
    || E'    IF v_cid IS NULL AND v_ciap IS NULL THEN\n'
    || E'      RAISE EXCEPTION ''No envio pela escuta, informe o CID-10 ou a CIAP-2 do problema: a ficha da UBS fecha como encaminhamento.'';\n'
    || E'    END IF;\n'
    || E'  END IF;\n',
    -- 4. a ficha fecha com o problema informado
    E'       SET etapa = ''encerrado'', conduta_aps = ARRAY[''encaminhamento_urgencia''],\n',
    E'       SET etapa = ''encerrado'', conduta_aps = ARRAY[''encaminhamento_urgencia''],\n'
    || E'           cid_aps = CASE WHEN v_cid IS NULL THEN cid_aps ELSE ARRAY[v_cid] END,\n'
    || E'           ciap_aps = CASE WHEN v_ciap IS NULL THEN ciap_aps ELSE ARRAY[v_ciap] END,\n'];
BEGIN
  IF to_regprocedure('public.encaminhar_upa(uuid, uuid, text, text, text)') IS NOT NULL THEN
    -- já aplicada: só garante que a de três parâmetros não ficou
    DROP FUNCTION IF EXISTS public.encaminhar_upa(uuid, uuid, text);
    RETURN;
  END IF;
  def := replace(pg_get_functiondef('public.encaminhar_upa(uuid, uuid, text)'::regprocedure), chr(13), '');
  novo := def;
  FOR k IN 1 .. array_length(pares, 1) BY 2 LOOP
    IF position(pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION 'encaminhar_upa mudou: trecho não encontrado (aplique antes a 20270426000012): %', pares[k];
    END IF;
    novo := replace(novo, pares[k], pares[k + 1]);
  END LOOP;
  DROP FUNCTION public.encaminhar_upa(uuid, uuid, text);
  EXECUTE novo;
  REVOKE ALL ON FUNCTION public.encaminhar_upa(uuid, uuid, text, text, text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.encaminhar_upa(uuid, uuid, text, text, text) TO authenticated;
END $m$;
