-- Rollback da migration 20270418000091 (LG7: PDF assinado no banco).
-- Atenção: apaga os PDFs assinados. Na produção, exporte antes a tabela
-- public.pdfs_assinados. Testado na homologação dentro de transação.
BEGIN;
DROP FUNCTION IF EXISTS public.pdf_assinado(text);
DROP FUNCTION IF EXISTS private.registrar_assinatura_com_pdf(uuid, uuid, bytea, text, text);
DROP TABLE IF EXISTS public.pdfs_assinados;
COMMIT;
