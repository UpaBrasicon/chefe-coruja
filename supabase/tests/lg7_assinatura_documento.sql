-- Testes da migration 20270418000090 (LG7: assinatura dos documentos). ROLLBACK no fim.
BEGIN;
GRANT assinador_app TO postgres WITH INHERIT FALSE, SET TRUE;

CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
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

-- paciente e documentos de teste na unidade do seed; médico = ...002, outro = ...004
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
VALUES ('26000000-0000-4000-8000-000000000701', '21000000-0000-4000-8000-000000000001', 'Paciente LG7', '1980-01-01');
INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, tipo_documento,
                                        conteudo, conteudo_hash, autor_id, estado, numero, emitido_em)
SELECT x.id, x.id, 1, u.organizacao_id, u.id, '26000000-0000-4000-8000-000000000701', 'atestado', 'Atestado de teste', 'h',
       '10000000-0000-4000-8000-000000000002', x.estado, x.numero, now()
  FROM public.unidades u,
       (VALUES ('26000000-0000-4000-8000-000000000711'::uuid, 'ativo', 'LG7-0001'),
               ('26000000-0000-4000-8000-000000000712'::uuid, 'rascunho', NULL),
               ('26000000-0000-4000-8000-000000000713'::uuid, 'ativo', 'LG7-0003')) AS x(id, estado, numero)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';

-- 1. o usuário não chega às funções do assinador nem grava assinatura direto
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT private.abrir_sessao_assinatura('10000000-0000-4000-8000-000000000002', 'vidaas', 's', 'e', '1234', now() + interval '1 year', now() + interval '6 hours')$$,
  'permission denied', 'o médico não abre sessão sem passar pelo provedor');
SELECT pg_temp.falha($$INSERT INTO public.assinaturas_documento (documento_id, medico_id, sessao_id, provedor, cert_serial, cert_emissor, pdf_sha256, pdf_caminho, codigo_sha256)
  VALUES ('26000000-0000-4000-8000-000000000711', '10000000-0000-4000-8000-000000000002', gen_random_uuid(), 'x', 's', 'e', repeat('a', 64), 'c', repeat('b', 64))$$,
  'permission denied', 'ninguém grava assinatura direto na tabela');
SELECT pg_temp.falha($$INSERT INTO public.assinaturas (prescricao_id, medico_id, hash_conteudo) VALUES (gen_random_uuid(), '10000000-0000-4000-8000-000000000002', 'h')$$,
  'permission denied', 'a tabela antiga não aceita mais escrita do usuário');
SELECT pg_temp.confere((public.minha_sessao_assinatura() ->> 'ativa')::boolean = false, 'sem sessão, o app vê a sessão inativa');
RESET ROLE;

-- 2. assinador abre a sessão e assina
SET LOCAL ROLE assinador_app;
SELECT pg_temp.falha($$SELECT private.abrir_sessao_assinatura('10000000-0000-4000-8000-000000000002', 'vidaas', 's', 'e', '1234', now() - interval '1 day', now() + interval '6 hours')$$,
  'Certificado vencido', 'certificado vencido não abre sessão');
INSERT INTO t VALUES ('sessao', private.abrir_sessao_assinatura('10000000-0000-4000-8000-000000000002', 'vidaas', 'SERIAL1', 'AC VALID RFB v5', '1234',
  now() + interval '1 year', now() + interval '20 hours')::text);
RESET ROLE;
SELECT pg_temp.confere((SELECT valida_ate <= now() + interval '12 hours' FROM private.sessoes_assinatura WHERE id = (SELECT valor FROM t WHERE nome = 'sessao')::uuid),
  'a sessão dura no máximo 12 horas, mesmo se o assinador pedir mais');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere((public.minha_sessao_assinatura() ->> 'ativa')::boolean, 'com sessão, o app vê a sessão ativa');
SELECT pg_temp.confere(public.minha_sessao_assinatura() ->> 'cert_cpf_final' = '1234', 'o app vê só o final do CPF do certificado');
RESET ROLE;

SET LOCAL ROLE assinador_app;
SELECT pg_temp.falha(format($$SELECT private.registrar_assinatura_documento('26000000-0000-4000-8000-000000000712', %L, repeat('a', 64), 'p', repeat('c', 64))$$, (SELECT valor FROM t WHERE nome = 'sessao')),
  'Só documento emitido e numerado', 'rascunho não se assina');
INSERT INTO t VALUES ('assinatura', private.registrar_assinatura_documento('26000000-0000-4000-8000-000000000711', (SELECT valor FROM t WHERE nome = 'sessao')::uuid,
  repeat('A', 64), 'unidade/paciente/assinados/doc.pdf', encode(extensions.digest('codigo-secreto-de-teste-com-32-letras!!', 'sha256'), 'hex'))::text);
SELECT pg_temp.falha(format($$SELECT private.registrar_assinatura_documento('26000000-0000-4000-8000-000000000711', %L, repeat('a', 64), 'p', repeat('d', 64))$$, (SELECT valor FROM t WHERE nome = 'sessao')),
  'Documento já assinado', 'documento não se assina duas vezes');
RESET ROLE;
SELECT pg_temp.confere((SELECT assinado_em IS NOT NULL AND estado = 'ativo' AND assinatura_id = (SELECT valor FROM t WHERE nome = 'assinatura')::uuid
                          FROM public.documentos_clinicos WHERE id = '26000000-0000-4000-8000-000000000711'),
  'o documento ganha assinado_em e assinatura_id e continua ativo');
SELECT pg_temp.confere((SELECT pdf_sha256 FROM public.assinaturas_documento WHERE id = (SELECT valor FROM t WHERE nome = 'assinatura')::uuid) = repeat('a', 64),
  'o hash é guardado em minúsculas');
SELECT pg_temp.falha($$UPDATE public.assinaturas_documento SET provedor = 'x'$$, 'assinaturas_documento é só-inserção', 'assinatura não se altera');

-- 3. só o autor assina; sessão encerrada não assina
UPDATE public.documentos_clinicos SET autor_id = '10000000-0000-4000-8000-000000000004' WHERE id = '26000000-0000-4000-8000-000000000713';
SET LOCAL ROLE assinador_app;
SELECT pg_temp.falha(format($$SELECT private.registrar_assinatura_documento('26000000-0000-4000-8000-000000000713', %L, repeat('a', 64), 'p', repeat('e', 64))$$, (SELECT valor FROM t WHERE nome = 'sessao')),
  'Só o autor do documento', 'ninguém assina documento de outro médico');
SELECT private.encerrar_sessao_assinatura((SELECT valor FROM t WHERE nome = 'sessao')::uuid, 'checkout');
SELECT pg_temp.falha(format($$SELECT private.registrar_assinatura_documento('26000000-0000-4000-8000-000000000713', %L, repeat('a', 64), 'p', repeat('e', 64))$$, (SELECT valor FROM t WHERE nome = 'sessao')),
  'Sessão de assinatura encerrada', 'sessão encerrada não assina');
RESET ROLE;

-- 4. conferência pública, sem dado do paciente
SET LOCAL ROLE anon;
SELECT pg_temp.confere((public.conferir_assinatura('codigo-secreto-de-teste-com-32-letras!!') ->> 'encontrada')::boolean, 'o QR code confere a assinatura');
SELECT pg_temp.confere(public.conferir_assinatura('codigo-secreto-de-teste-com-32-letras!!')::text NOT LIKE '%Paciente LG7%', 'a conferência não mostra o paciente');
SELECT pg_temp.confere((public.conferir_assinatura('curto') ->> 'encontrada')::boolean = false, 'código curto não encontra nada');
SELECT pg_temp.falha($$SELECT * FROM public.assinaturas_documento$$, 'permission denied', 'anônimo não lê a tabela');
RESET ROLE;
ROLLBACK;
