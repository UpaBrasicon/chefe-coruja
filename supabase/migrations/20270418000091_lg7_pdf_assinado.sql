-- LG7 (decisões do RT de 18/11/2026; docs/regulatorio/LG7-DESENHO-TECNICO.md):
-- o PDF assinado fica no banco, no Brasil, com o backup e o cofre de sempre.
--   * public.pdfs_assinados: o PDF de cada assinatura (só de inclusão). Lê quem
--     vê o documento (a RLS de assinaturas_documento vale dentro do EXISTS).
--   * private.registrar_assinatura_com_pdf: o assinador grava a assinatura e o
--     PDF numa chamada só; o hash do PDF é calculado aqui, não confiado.
--   * public.pdf_assinado(codigo): o PDF pelo código secreto do QR code
--     (VALIDAR do ITI), sem login; 192 bits de código, só o hash fica no banco.
--
-- Expand: só acrescenta.
-- Rollback (testado na homologação, dentro de transação):
--   docs/regulatorio/LG7-ROLLBACK-20270418000091.sql

CREATE TABLE IF NOT EXISTS public.pdfs_assinados (
  assinatura_id uuid PRIMARY KEY REFERENCES public.assinaturas_documento(id),
  pdf           bytea NOT NULL CHECK (octet_length(pdf) BETWEEN 1 AND 5242880),
  em            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pdfs_assinados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdfs_assinados FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pdfs_assinados TO authenticated;
DROP POLICY IF EXISTS pdfs_assinados_select ON public.pdfs_assinados;
CREATE POLICY pdfs_assinados_select ON public.pdfs_assinados FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assinaturas_documento a WHERE a.id = assinatura_id));
DROP TRIGGER IF EXISTS trg_pdfs_assinados_so_insercao ON public.pdfs_assinados;
CREATE TRIGGER trg_pdfs_assinados_so_insercao
  BEFORE UPDATE OR DELETE ON public.pdfs_assinados
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();

CREATE OR REPLACE FUNCTION private.registrar_assinatura_com_pdf(
  p_documento uuid, p_sessao uuid, p_pdf bytea, p_codigo_sha256 text, p_politica text DEFAULT 'AD-RB')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_pdf IS NULL OR octet_length(p_pdf) = 0 OR substring(p_pdf FROM 1 FOR 5) <> '\x255044462d'::bytea THEN
    RAISE EXCEPTION 'O arquivo não é um PDF';
  END IF;
  v_id := private.registrar_assinatura_documento(
    p_documento, p_sessao, encode(extensions.digest(p_pdf, 'sha256'), 'hex'),
    'banco:pdfs_assinados', p_codigo_sha256, p_politica);
  INSERT INTO public.pdfs_assinados (assinatura_id, pdf) VALUES (v_id, p_pdf);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pdf_assinado(p_codigo text)
RETURNS bytea
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.pdf
    FROM public.assinaturas_documento a
    JOIN public.pdfs_assinados p ON p.assinatura_id = a.id
   WHERE length(coalesce(p_codigo, '')) >= 32
     AND a.codigo_sha256 = encode(extensions.digest(p_codigo, 'sha256'), 'hex')
$$;

REVOKE ALL ON FUNCTION private.registrar_assinatura_com_pdf(uuid, uuid, bytea, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.registrar_assinatura_com_pdf(uuid, uuid, bytea, text, text) TO assinador_app;
REVOKE ALL ON FUNCTION public.pdf_assinado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdf_assinado(text) TO anon, authenticated;
