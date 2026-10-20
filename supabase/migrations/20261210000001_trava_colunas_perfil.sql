-- Correção de segurança S1 (decisão do RT "1a 2a", 19/10/2026): a pessoa
-- alterava pela API qualquer coluna do próprio perfil (policy perfis_update),
-- inclusive CRM, conselho, número e UF do registro, CPF e `ativo`. As telas
-- só gravam foto, tipo sanguíneo, dados pessoais e tema.
--
-- Agora o UPDATE direto vale só para essas quatro colunas. O resto muda pelas
-- funções que validam (SECURITY DEFINER): aplicar_primeiro_acesso (ativação
-- do convite), definir_meu_cbo, definir_meu_cns e handle_user_email_update.
REVOKE UPDATE ON public.perfis FROM authenticated;
GRANT UPDATE (foto_url, tipo_sanguineo, dados_pessoais, tema) ON public.perfis TO authenticated;
