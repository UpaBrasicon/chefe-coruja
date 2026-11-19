-- Percurso da UBS, U15, PR 4 (diagnóstico docs/ubs/U15-DIAGNOSTICO.md; RT,
-- 18/11/2026: V1 a V5 = A): o envio das fichas do LEDI ao PEC e-SUS APS do
-- município.
--
-- O serviço de envio (services/rnds-envio, módulo do LEDI) não lê tabela:
-- chama três funções com a chave de serviço, como na RNDS (5C-5.3a).
--
-- 1. public.ledi_pegar_lote(limite): até 100 fichas pendentes ou retidas cuja
--    hora chegou, só de UBS com o envio ligado e o endereço do PEC. Trava cada
--    ficha por 5 minutos.
-- 2. public.ledi_dados_ficha(item): a carga (private.ledi_carga_fai ou
--    ledi_carga_fp, PR 2), o uuid da ficha e o endereço do PEC. A falta de dado
--    chega como erro "retido: …".
-- 3. public.ledi_registrar_resultado(item, resultado, resposta, erro):
--    - enviado: o PEC aceitou (201);
--    - retido: falta dado; tenta de novo em 1 hora;
--    - reenviar: rede, 5xx ou sessão do PEC; tenta de novo em 1, 2, 4… minutos,
--      no máximo 1 hora; na 30ª tentativa vira erro;
--    - erro: o PEC recusou a ficha (400); não tenta de novo.
-- 4. public.ledi_ligar_envio(unidade, ligado): o gestor da UBS liga ou desliga,
--    com segundo fator e auditoria. Ligar exige CNES, código IBGE e o
--    endereço do PEC.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_envio_pec.sql
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.ledi_pegar_lote(integer), public.ledi_dados_ficha(uuid),
--     public.ledi_registrar_resultado(uuid, text, jsonb, text), public.ledi_ligar_envio(uuid, boolean);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ledi_pegar_lote(p_limite integer DEFAULT 20)
RETURNS TABLE (id uuid, tipo text, unidade_id uuid, uuid_ficha text, tentativas integer)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  WITH escolhidos AS (
    SELECT f.id FROM public.ledi_fila f
      JOIN public.ledi_config_unidade c ON c.unidade_id = f.unidade_id
     WHERE f.status IN ('pendente', 'retido')
       AND c.envio_ligado AND c.pec_url IS NOT NULL
       AND coalesce(f.proxima_tentativa_em, f.criado_em) <= now()
       AND (f.travado_ate IS NULL OR f.travado_ate < now())
     ORDER BY coalesce(f.proxima_tentativa_em, f.criado_em)
     LIMIT greatest(1, least(coalesce(p_limite, 20), 100))
     FOR UPDATE OF f SKIP LOCKED
  )
  UPDATE public.ledi_fila f
     SET travado_ate = now() + interval '5 minutes', atualizado_em = now()
    FROM escolhidos x
   WHERE f.id = x.id
  RETURNING f.id, f.tipo, f.unidade_id, f.uuid_ficha, f.tentativas
$$;

CREATE OR REPLACE FUNCTION public.ledi_dados_ficha(p_item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.ledi_fila; v_url text; v_carga jsonb;
BEGIN
  SELECT * INTO f FROM public.ledi_fila WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'ficha % não encontrada na fila', p_item; END IF;
  SELECT c.pec_url INTO v_url FROM public.ledi_config_unidade c WHERE c.unidade_id = f.unidade_id;
  IF v_url IS NULL THEN RAISE EXCEPTION 'retido: unidade sem o endereço do PEC'; END IF;
  v_carga := CASE f.tipo WHEN 'fai' THEN private.ledi_carga_fai(f.referencia_id) ELSE private.ledi_carga_fp(f.referencia_id) END;
  RETURN jsonb_build_object('item_id', f.id, 'tipo', f.tipo, 'uuid_ficha', f.uuid_ficha, 'unidade_id', f.unidade_id,
                            'carga', v_carga, 'envio', jsonb_build_object('pec_url', v_url));
END;
$$;

CREATE OR REPLACE FUNCTION public.ledi_registrar_resultado(p_item uuid, p_resultado text, p_resposta jsonb DEFAULT NULL, p_erro text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.ledi_fila;
BEGIN
  SELECT * INTO f FROM public.ledi_fila WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ficha % não encontrada na fila', p_item; END IF;
  IF p_resultado = 'enviado' THEN
    UPDATE public.ledi_fila SET status = 'enviado', enviado_em = now(), resposta = p_resposta, ultimo_erro = NULL,
           tentativas = f.tentativas + 1, travado_ate = NULL, proxima_tentativa_em = NULL, atualizado_em = now()
     WHERE id = p_item;
  ELSIF p_resultado = 'retido' THEN
    UPDATE public.ledi_fila SET status = 'retido', ultimo_erro = left(p_erro, 1000), travado_ate = NULL,
           proxima_tentativa_em = now() + interval '1 hour', atualizado_em = now()
     WHERE id = p_item;
  ELSIF p_resultado = 'reenviar' THEN
    UPDATE public.ledi_fila
       SET status = CASE WHEN f.tentativas + 1 >= 30 THEN 'erro' ELSE 'pendente' END,
           tentativas = f.tentativas + 1, ultimo_erro = left(p_erro, 1000), resposta = p_resposta, travado_ate = NULL,
           proxima_tentativa_em = now() + make_interval(mins => least(power(2, f.tentativas)::int, 60)), atualizado_em = now()
     WHERE id = p_item;
  ELSIF p_resultado = 'erro' THEN
    UPDATE public.ledi_fila SET status = 'erro', tentativas = f.tentativas + 1, ultimo_erro = left(p_erro, 1000),
           resposta = p_resposta, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
  ELSE
    RAISE EXCEPTION 'resultado "%" fora de enviado, retido, reenviar e erro', p_resultado;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledi_ligar_envio(p_unidade uuid, p_ligado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.ledi_config_unidade; v_cnes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade liga o envio ao SISAB.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'O envio ao SISAB é da UBS.';
  END IF;
  SELECT * INTO c FROM public.ledi_config_unidade WHERE unidade_id = p_unidade;
  IF coalesce(p_ligado, false) THEN
    SELECT regexp_replace(coalesce(u.cnes, ''), '\D', '', 'g') INTO v_cnes FROM public.unidades u WHERE u.id = p_unidade;
    IF length(v_cnes) <> 7 THEN RAISE EXCEPTION 'Para ligar o envio, a unidade precisa do CNES.'; END IF;
    IF c.codigo_ibge IS NULL OR c.pec_url IS NULL THEN
      RAISE EXCEPTION 'Para ligar o envio, informe o código IBGE do município e o endereço do PEC.';
    END IF;
  END IF;
  IF c.unidade_id IS NULL THEN
    IF coalesce(p_ligado, false) THEN RAISE EXCEPTION 'Para ligar o envio, informe o código IBGE do município e o endereço do PEC.'; END IF;
    RETURN;
  END IF;
  UPDATE public.ledi_config_unidade SET envio_ligado = coalesce(p_ligado, false), atualizado_por = private.meu_perfil_id(), atualizado_em = now()
   WHERE unidade_id = p_unidade;
  PERFORM private.registrar_auditoria('ledi_envio_ligado', 'ledi_config_unidade', p_unidade, p_unidade,
    jsonb_build_object('ativo', coalesce(p_ligado, false)));
END;
$$;

REVOKE ALL ON FUNCTION public.ledi_pegar_lote(integer), public.ledi_dados_ficha(uuid),
  public.ledi_registrar_resultado(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledi_pegar_lote(integer), public.ledi_dados_ficha(uuid),
  public.ledi_registrar_resultado(uuid, text, jsonb, text) TO service_role;
REVOKE ALL ON FUNCTION public.ledi_ligar_envio(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledi_ligar_envio(uuid, boolean) TO authenticated;
