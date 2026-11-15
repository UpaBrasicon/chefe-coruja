-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S1 (contract): o admin da organização deixa de gravar
-- direto em `vinculos`. Aplicar DEPOIS da tela nova no ar (ela usa
-- revogar_vinculo, reativar_vinculo e concluir_adesao, de 20270414000055).
--
-- Escrita direta fica só com o super admin. Pessoa nova ou papel novo entram
-- pelo convite (gerar_convite) ou pelo contrato (concluir_adesao), que já
-- aplicam as regras de papel. Fecha também o caminho que contornava
-- zerar_segundo_fator (vínculo criado sem consentimento).
--
-- Reaplicável. Rollback: recriar as políticas antigas
--   vinculos_insert WITH CHECK (perfil_id <> private.meu_perfil_id() AND (private.eh_super_admin()
--     OR EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = vinculos.unidade_id
--                AND private.eh_admin_da_organizacao(u.organizacao_id))))
--   vinculos_update USING e WITH CHECK com a mesma expressão.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS vinculos_insert ON public.vinculos;
CREATE POLICY vinculos_insert ON public.vinculos FOR INSERT TO authenticated
  WITH CHECK (perfil_id <> private.meu_perfil_id() AND private.eh_super_admin());

DROP POLICY IF EXISTS vinculos_update ON public.vinculos;
CREATE POLICY vinculos_update ON public.vinculos FOR UPDATE TO authenticated
  USING (perfil_id <> private.meu_perfil_id() AND private.eh_super_admin())
  WITH CHECK (perfil_id <> private.meu_perfil_id() AND private.eh_super_admin());
