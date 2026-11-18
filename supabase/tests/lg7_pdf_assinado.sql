-- Testes da migration 20270418000091 (LG7: PDF assinado no banco). ROLLBACK no fim.
BEGIN;
GRANT assinador_app TO postgres WITH INHERIT FALSE, SET TRUE;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, assinador_app, anon;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated, assinador_app, anon;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, assinador_app, anon;

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
VALUES ('26000000-0000-4000-8000-000000000801', '21000000-0000-4000-8000-000000000001', 'Paciente LG7 PDF', '1980-01-01');
INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, tipo_documento,
                                        conteudo, conteudo_hash, autor_id, estado, numero, emitido_em)
SELECT '26000000-0000-4000-8000-000000000811', '26000000-0000-4000-8000-000000000811', 1, u.organizacao_id, u.id,
       '26000000-0000-4000-8000-000000000801', 'atestado', 'Atestado de teste', 'h', '10000000-0000-4000-8000-000000000002', 'ativo', 'LG7-PDF-1', now()
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO t VALUES ('codigo_hash', encode(extensions.digest('codigo-secreto-do-qr-com-mais-de-32-letras', 'sha256'), 'hex'));

SET LOCAL ROLE assinador_app;
INSERT INTO t VALUES ('sessao', private.abrir_sessao_assinatura('10000000-0000-4000-8000-000000000002', 'vidaas', 'S1', 'AC TESTE', '1234',
  now() + interval '1 year', now() + interval '6 hours')::text);
SELECT pg_temp.falha(format($$SELECT private.registrar_assinatura_com_pdf('26000000-0000-4000-8000-000000000811', %L, '\x00010203'::bytea, %L)$$,
  (SELECT valor FROM t WHERE nome = 'sessao'), (SELECT valor FROM t WHERE nome = 'codigo_hash')), 'O arquivo não é um PDF', 'só aceita PDF');
INSERT INTO t VALUES ('assinatura', private.registrar_assinatura_com_pdf('26000000-0000-4000-8000-000000000811', (SELECT valor FROM t WHERE nome = 'sessao')::uuid,
  convert_to('%PDF-1.7 documento assinado de teste', 'UTF8'), (SELECT valor FROM t WHERE nome = 'codigo_hash'))::text);
RESET ROLE;

SELECT pg_temp.confere((SELECT pdf_sha256 = encode(extensions.digest(convert_to('%PDF-1.7 documento assinado de teste', 'UTF8'), 'sha256'), 'hex')
                          AND pdf_caminho = 'banco:pdfs_assinados'
                          FROM public.assinaturas_documento WHERE id = (SELECT valor FROM t WHERE nome = 'assinatura')::uuid),
  'o hash do PDF é calculado no banco, não confiado');
SELECT pg_temp.falha($$UPDATE public.pdfs_assinados SET pdf = 'x'::bytea$$, 'pdfs_assinados é só-inserção', 'o PDF assinado não se altera');

SET LOCAL ROLE anon;
SELECT pg_temp.confere(convert_from(public.pdf_assinado('codigo-secreto-do-qr-com-mais-de-32-letras'), 'UTF8') LIKE '%PDF-1.7%', 'o QR code devolve o PDF');
SELECT pg_temp.confere(public.pdf_assinado('codigo-errado-mas-com-mais-de-32-letras-xx') IS NULL, 'código errado não devolve nada');
SELECT pg_temp.falha($$SELECT * FROM public.pdfs_assinados$$, 'permission denied', 'anônimo não lê a tabela');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.falha(format($$SELECT private.registrar_assinatura_com_pdf('26000000-0000-4000-8000-000000000811', %L, '\x255044462d'::bytea, %L)$$,
  (SELECT valor FROM t WHERE nome = 'sessao'), repeat('f', 64)), 'permission denied', 'o usuário não grava assinatura com PDF');
RESET ROLE;
ROLLBACK;
