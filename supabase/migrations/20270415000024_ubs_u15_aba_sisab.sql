-- Percurso da UBS, U15, PR 5 (diagnóstico docs/ubs/U15-DIAGNOSTICO.md; RT,
-- 18/11/2026: V1 a V5 = A): a aba SISAB em Integrações, para o gestor da UBS.
--
-- 1. public.ledi_painel(unidade): a configuração (IBGE, INE, endereço do PEC,
--    envio ligado), o CNES da unidade e a contagem da fila por situação.
-- 2. public.ledi_itens(unidade, situação, limite): as fichas mais recentes, com
--    o tipo, a situação, o motivo e as horas. Sem dado do paciente.
-- 3. public.ledi_reenviar(item): a ficha com erro volta à fila (tentativas do
--    zero); a retida tenta agora. Com auditoria.
-- Os três só para o gestor da unidade e o super admin, com segundo fator, como
-- a aba RNDS.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_aba_sisab.sql
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.ledi_painel(uuid), public.ledi_itens(uuid, text, integer), public.ledi_reenviar(uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ledi_painel(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.ledi_config_unidade;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade vê o envio ao SISAB.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM public.ledi_config_unidade WHERE unidade_id = p_unidade;
  RETURN jsonb_build_object(
    'ubs', EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo::text = 'ubs'),
    'cnes', (SELECT nullif(regexp_replace(coalesce(u.cnes, ''), '\D', '', 'g'), '') FROM public.unidades u WHERE u.id = p_unidade),
    'config', CASE WHEN c.unidade_id IS NULL THEN NULL ELSE jsonb_build_object(
      'codigo_ibge', c.codigo_ibge, 'ine', c.ine, 'pec_url', c.pec_url, 'envio_ligado', c.envio_ligado,
      'atualizado_em', c.atualizado_em) END,
    'contagem', (SELECT jsonb_build_object(
      'pendente', count(*) FILTER (WHERE f.status = 'pendente'), 'retido', count(*) FILTER (WHERE f.status = 'retido'),
      'erro', count(*) FILTER (WHERE f.status = 'erro'), 'enviado', count(*) FILTER (WHERE f.status = 'enviado'))
      FROM public.ledi_fila f WHERE f.unidade_id = p_unidade));
END;
$$;

CREATE OR REPLACE FUNCTION public.ledi_itens(p_unidade uuid, p_status text DEFAULT NULL, p_limite integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade vê o envio ao SISAB.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', f.id, 'tipo', f.tipo, 'uuid_ficha', f.uuid_ficha, 'status', f.status, 'tentativas', f.tentativas,
      'ultimo_erro', f.ultimo_erro, 'criado_em', f.criado_em, 'enviado_em', f.enviado_em,
      'proxima_tentativa_em', f.proxima_tentativa_em) ORDER BY f.criado_em DESC)
    FROM (SELECT * FROM public.ledi_fila x
           WHERE x.unidade_id = p_unidade AND x.status <> 'descartado' AND (p_status IS NULL OR x.status = p_status)
           ORDER BY x.criado_em DESC LIMIT greatest(1, least(coalesce(p_limite, 50), 200))) f), '[]');
END;
$$;

-- erro volta à fila; retida tenta agora
CREATE OR REPLACE FUNCTION public.ledi_reenviar(p_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.ledi_fila;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO f FROM public.ledi_fila WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ficha não encontrada.'; END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(f.unidade_id, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade reenvia.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF f.status NOT IN ('erro', 'retido') THEN RAISE EXCEPTION 'Só ficha com erro ou retida volta à fila.'; END IF;
  UPDATE public.ledi_fila
     SET status = CASE WHEN f.status = 'erro' THEN 'pendente' ELSE 'retido' END,
         tentativas = CASE WHEN f.status = 'erro' THEN 0 ELSE f.tentativas END,
         proxima_tentativa_em = now(), travado_ate = NULL, atualizado_em = now()
   WHERE id = p_item;
  PERFORM private.registrar_auditoria('ledi_ficha_reenviada', 'ledi_fila', f.id, f.unidade_id,
    jsonb_build_object('tipo', f.tipo, 'status', f.status));
END;
$$;

REVOKE ALL ON FUNCTION public.ledi_painel(uuid), public.ledi_itens(uuid, text, integer), public.ledi_reenviar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledi_painel(uuid), public.ledi_itens(uuid, text, integer), public.ledi_reenviar(uuid) TO authenticated;
