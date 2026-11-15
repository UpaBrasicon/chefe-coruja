-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S1 (expand): vínculos e perfis entre organizações.
-- Decisões do RT V1–V6 = A, 15/11/2026 (docs/seguranca/S1-VINCULOS-DIAGNOSTICO.md).
--
-- Antes: o admin da organização gravava direto em `vinculos` (qualquer pessoa,
-- qualquer papel) e lia todo perfil sem vínculo ativo da plataforma.
--
-- Esta etapa (expand), aplicada antes da tela nova:
--   1. revogar_vinculo / reativar_vinculo: o admin mexe só em vínculo que já
--      existe numa unidade da própria organização (mesmo papel), com o segundo
--      fator e auditoria no servidor.
--   2. concluir_adesao: quem aderiu ao contrato da rede entra numa unidade da
--      organização do contrato, com o papel do contrato. Pessoa nova ou papel
--      novo fora do contrato: só pelo convite.
--   3. perfis_select: o ramo "perfil sem vínculo" vale só para quem tem adesão
--      a contrato da organização do admin (V3).
-- A retirada da escrita direta é a etapa seguinte (20270414000056, contract).
--
-- Reaplicável. Rollback: DROP FUNCTION das três RPCs e recriar perfis_select
-- com o ramo antigo:
--   OR ((NOT EXISTS (SELECT 1 FROM vinculos v WHERE v.perfil_id = perfis.id AND v.ativo))
--       AND EXISTS (SELECT 1 FROM private.orgs_admin()))
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Revogar e reativar ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.vinculo_para_admin(p_vinculo uuid)
RETURNS TABLE(id uuid, perfil_id uuid, unidade_id uuid, papel public.papel, ativo boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.exigir_segundo_fator();
  SELECT vi.id, vi.perfil_id, vi.unidade_id, vi.papel, vi.ativo, u.organizacao_id
    INTO v
    FROM public.vinculos vi JOIN public.unidades u ON u.id = vi.unidade_id
   WHERE vi.id = p_vinculo
   FOR UPDATE OF vi;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo não encontrado.';
  END IF;
  IF v.perfil_id = private.meu_perfil_id() THEN
    RAISE EXCEPTION 'Não é possível alterar o próprio vínculo.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(v.organizacao_id)) THEN
    RAISE EXCEPTION 'Só o administrador da organização da unidade altera este vínculo.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT v.id, v.perfil_id, v.unidade_id, v.papel, v.ativo;
END $$;
REVOKE ALL ON FUNCTION private.vinculo_para_admin(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.revogar_vinculo(p_vinculo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM private.vinculo_para_admin(p_vinculo);
  UPDATE public.vinculos SET ativo = false WHERE id = v.id;
  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
  VALUES (auth.uid(), 'vinculo_revogado', 'vinculos', v.id, v.unidade_id,
          private.payload_auditoria('vinculos', jsonb_build_object('perfil_id', v.perfil_id, 'papel', v.papel)));
END $$;

CREATE OR REPLACE FUNCTION public.reativar_vinculo(p_vinculo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM private.vinculo_para_admin(p_vinculo);
  -- papel de rede: só o super admin (mesma regra do convite)
  IF private.eh_papel_rede(v.papel::text) AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Pessoas de rede são cadastradas pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.vinculos SET ativo = true WHERE id = v.id;
  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
  VALUES (auth.uid(), 'vinculo_reativado', 'vinculos', v.id, v.unidade_id,
          private.payload_auditoria('vinculos', jsonb_build_object('perfil_id', v.perfil_id, 'papel', v.papel)));
END $$;

REVOKE ALL ON FUNCTION public.revogar_vinculo(uuid), public.reativar_vinculo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revogar_vinculo(uuid), public.reativar_vinculo(uuid) TO authenticated;

-- ── 2. Concluir a entrada de quem aderiu ao contrato ────────────────────────
CREATE OR REPLACE FUNCTION public.concluir_adesao(p_adesao uuid, p_unidade uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a  record;
  v_org_unidade uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.exigir_segundo_fator();
  SELECT ad.id, ad.perfil_id, ad.papel, k.organizacao_id, k.ativo
    INTO a
    FROM public.adesoes_contrato ad JOIN public.contratos_rede k ON k.id = ad.contrato_id
   WHERE ad.id = p_adesao;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adesão não encontrada.';
  END IF;
  IF NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(a.organizacao_id)) THEN
    RAISE EXCEPTION 'Só o administrador da organização do contrato conclui esta entrada.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF a.perfil_id = private.meu_perfil_id() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'A própria entrada é concluída pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT a.ativo THEN
    RAISE EXCEPTION 'O contrato desta adesão não está ativo.';
  END IF;
  SELECT u.organizacao_id INTO v_org_unidade FROM public.unidades u WHERE u.id = p_unidade AND u.ativo;
  IF v_org_unidade IS DISTINCT FROM a.organizacao_id THEN
    RAISE EXCEPTION 'A unidade não é da organização do contrato.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Na unidade Secretaria entram só os papéis de rede.';
  END IF;

  INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
  VALUES (a.perfil_id, p_unidade, a.papel, true, auth.uid())
  ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true
  RETURNING id INTO v_id;

  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
  VALUES (auth.uid(), 'adesao_concluida', 'vinculos', v_id, p_unidade,
          private.payload_auditoria('vinculos', jsonb_build_object('perfil_id', a.perfil_id, 'papel', a.papel)));
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.concluir_adesao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_adesao(uuid, uuid) TO authenticated;

-- ── 3. Leitura de perfis ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS perfis_select ON public.perfis;
CREATE POLICY perfis_select ON public.perfis FOR SELECT TO authenticated USING (
  id = (SELECT auth.uid())
  OR private.eh_super_admin()
  -- quem tem ou teve vínculo numa unidade da organização do admin (histórico da equipe, V4)
  OR EXISTS (SELECT 1 FROM public.vinculos v JOIN public.unidades u ON u.id = v.unidade_id
              WHERE v.perfil_id = perfis.id AND u.organizacao_id IN (SELECT private.orgs_admin()))
  -- quem aderiu a contrato da organização do admin e espera a entrada (V3)
  OR EXISTS (SELECT 1 FROM public.adesoes_contrato ad JOIN public.contratos_rede k ON k.id = ad.contrato_id
              WHERE ad.perfil_id = perfis.id AND k.organizacao_id IN (SELECT private.orgs_admin()))
);
