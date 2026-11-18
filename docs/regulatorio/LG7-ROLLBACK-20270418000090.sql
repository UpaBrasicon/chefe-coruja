-- Rollback da migration 20270418000090 (LG7: base do banco da assinatura).
-- Atenção: apaga as sessões e as assinaturas registradas. Na produção, exporte
-- antes as tabelas private.sessoes_assinatura e public.assinaturas_documento e
-- os PDFs assinados do Storage. Testado na homologação dentro de transação.
BEGIN;
UPDATE public.documentos_clinicos SET assinatura_id = NULL, assinado_em = NULL
 WHERE assinatura_id IN (SELECT id FROM public.assinaturas_documento);
DROP FUNCTION IF EXISTS public.conferir_assinatura(text);
DROP FUNCTION IF EXISTS public.minha_sessao_assinatura();
DROP FUNCTION IF EXISTS private.registrar_assinatura_documento(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS private.encerrar_sessao_assinatura(uuid, text);
DROP FUNCTION IF EXISTS private.abrir_sessao_assinatura(uuid, text, text, text, text, timestamptz, timestamptz);
DROP TABLE IF EXISTS public.assinaturas_documento;
DROP TABLE IF EXISTS private.sessoes_assinatura;
REVOKE USAGE ON SCHEMA private FROM assinador_app;
DROP ROLE IF EXISTS assinador_app;
-- A escrita da tabela antiga public.assinaturas pelo usuário NÃO volta: era uma
-- brecha (o próprio usuário gravava a própria assinatura) e a tabela está vazia.
COMMIT;
