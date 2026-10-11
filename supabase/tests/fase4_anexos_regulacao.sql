-- Fase 4, tarefa 6 — migration 20261112000001_anexos_regulacao.sql: anexos e
-- laudos da regulação. Cobre:
-- - quem anexa (origem e regulador da central; enfermagem não) e com o pedido aberto;
-- - arquivo: tipo, tamanho, caminho do próprio pedido, objeto no armazenamento;
-- - documento do prontuário do mesmo paciente (também escolhido na nova solicitação);
-- - limite de 10 anexos;
-- - abrir registra o acesso e libera a leitura do arquivo por 2 min;
-- - retirar com motivo, sem apagar; histórico e auditoria.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009d0', 'Rede dos Anexos');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009d0', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009d1'::uuid, 'UPA Centro-Sul', '7654458'),
               ('21000000-0000-4000-8000-0000000009d3'::uuid, 'Central Centro-Sul', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-0000000009d1', '21000000-0000-4000-8000-0000000009d1', 'Porta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009d0', '21000000-0000-4000-8000-0000000009d3', '10000000-0000-4000-8000-000000000003');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009d1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009d1', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009d3', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000009d1', '21000000-0000-4000-8000-0000000009d1', 'Paciente Anexo', '1970-01-01', 'A-1', '22000000-0000-4000-8000-0000000009d1', 'M'),
  ('23000000-0000-4000-8000-0000000009d2', '21000000-0000-4000-8000-0000000009d1', 'Outro Paciente', '1970-01-01', 'A-2', '22000000-0000-4000-8000-0000000009d1', 'M');
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, paciente_nao_identificado,
  tipo, procedimento, tipo_leito, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel)
VALUES ('2a000000-0000-4000-8000-0000000009d1', '20000000-0000-4000-8000-0000000009d0', '21000000-0000-4000-8000-0000000009d3',
        '21000000-0000-4000-8000-0000000009d1', '7654458', '23000000-0000-4000-8000-0000000009d1', true, 'leito', '0303060190', 'uti_adulto',
        'a_definir', 'urgencia', '04', 'urgencia', 'I21.9', 'Quadro clínico do pedido com anexos.', '10000000-0000-4000-8000-000000000002', 'medico');
-- documentos do prontuário: um do paciente, um de outro paciente
INSERT INTO public.documentos_clinicos (id, documento_raiz_id, organizacao_id, unidade_id, paciente_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado, emitido_em)
VALUES
  ('26000000-0000-4000-8000-0000000009d1', '26000000-0000-4000-8000-0000000009d1', '20000000-0000-4000-8000-0000000009d0', '21000000-0000-4000-8000-0000000009d1',
   '23000000-0000-4000-8000-0000000009d1', 'evolucao', 'ECG com supra de ST inferior às 14h.', 'h1', '10000000-0000-4000-8000-000000000002', 'ativo', now()),
  ('26000000-0000-4000-8000-0000000009d2', '26000000-0000-4000-8000-0000000009d2', '20000000-0000-4000-8000-0000000009d0', '21000000-0000-4000-8000-0000000009d1',
   '23000000-0000-4000-8000-0000000009d2', 'evolucao', 'Documento de outra pessoa.', 'h2', '10000000-0000-4000-8000-000000000002', 'ativo', now());
-- arquivos "já enviados" ao bucket (o envio real é do navegador)
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('regulacao', '2a000000-0000-4000-8000-0000000009d1/ecg.pdf'),
  ('regulacao', '2a000000-0000-4000-8000-0000000009d1/foto.png');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.acessos() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.log_acesso_prontuario WHERE unidade_id = '21000000-0000-4000-8000-0000000009d1' AND tipo_acesso = 'leitura_documento' $$;
GRANT EXECUTE ON FUNCTION pg_temp.acessos() TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. anexar arquivo ───────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', '2a000000-0000-4000-8000-0000000009d1/ecg.pdf', 'ecg.pdf', 1000, 'application/pdf')$$,
  'Anexam o solicitante', 'enfermagem não anexa');
SELECT pg_temp.ok(NOT private.regulacao_pode_subir('2a000000-0000-4000-8000-0000000009d1/x.pdf'), 'enfermagem também não sobe arquivo no armazenamento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok(private.regulacao_pode_subir('2a000000-0000-4000-8000-0000000009d1/x.pdf') AND NOT private.regulacao_pode_subir('qualquer/x.pdf'),
  'médico da origem sobe arquivo só na pasta do pedido');
SELECT pg_temp.falha($$SELECT public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', '2a000000-0000-4000-8000-0000000009d1/ecg.pdf', 'ecg.exe', 1000, 'application/x-msdownload')$$,
  'Envie PDF, JPG ou PNG', 'tipo de arquivo fora da lista');
SELECT pg_temp.falha($$SELECT public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', '2a000000-0000-4000-8000-0000000009d1/ecg.pdf', 'ecg.pdf', 20000000, 'application/pdf')$$,
  'O arquivo vai até 10 MB', 'arquivo grande demais');
SELECT pg_temp.falha($$SELECT public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', '2a000000-0000-4000-8000-0000000009d1/nao-existe.pdf', 'x.pdf', 1000, 'application/pdf')$$,
  'O arquivo não chegou ao armazenamento', 'arquivo que não subiu');
SELECT pg_temp.falha($$SELECT public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', 'outra-pasta/ecg.pdf', 'ecg.pdf', 1000, 'application/pdf')$$,
  'O arquivo não é deste pedido', 'caminho de outro pedido');
INSERT INTO t SELECT 'a1', public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', '2a000000-0000-4000-8000-0000000009d1/ecg.pdf', 'ECG 14h.pdf', 120000, 'application/pdf')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'a2', public.regulacao_registrar_anexo('2a000000-0000-4000-8000-0000000009d1', '2a000000-0000-4000-8000-0000000009d1/foto.png', 'Resposta do destino.png', 50000, 'image/png')::text;
SELECT pg_temp.ok(pg_temp.v('a2') IS NOT NULL, 'regulador da central também anexa');

-- ── 2. documento do prontuário ──────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_documentos_anexaveis('2a000000-0000-4000-8000-0000000009d1')) = 1,
  'só os documentos do próprio paciente aparecem para anexar');
-- migration 20261112000002: escolher os documentos já na nova solicitação
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_documentos_do_paciente('23000000-0000-4000-8000-0000000009d1')) = 1
              AND NOT (public.regulacao_documentos_do_paciente('23000000-0000-4000-8000-0000000009d1')->0 ? 'conteudo'),
  'nova solicitação lista os documentos do paciente, sem o texto');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_documentos_do_paciente('23000000-0000-4000-8000-0000000009d1')$$,
  'Acesso negado', 'enfermagem não lista documentos para a solicitação');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_anexar_documento('2a000000-0000-4000-8000-0000000009d1', '26000000-0000-4000-8000-0000000009d2')$$,
  'Documento não encontrado no prontuário deste paciente', 'documento de outro paciente recusado');
INSERT INTO t SELECT 'a3', public.regulacao_anexar_documento('2a000000-0000-4000-8000-0000000009d1', '26000000-0000-4000-8000-0000000009d1')::text;
SELECT pg_temp.falha($$SELECT public.regulacao_anexar_documento('2a000000-0000-4000-8000-0000000009d1', '26000000-0000-4000-8000-0000000009d1')$$,
  'Este documento já está anexado', 'mesmo documento duas vezes');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_anexos('2a000000-0000-4000-8000-0000000009d1')->'anexos') = 3
              AND (public.regulacao_anexos('2a000000-0000-4000-8000-0000000009d1')->>'pode_anexar')::boolean,
  'lista com os três anexos');

-- ── 3. abrir registra e libera a leitura ────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE bucket_id = 'regulacao' AND name = '2a000000-0000-4000-8000-0000000009d1/ecg.pdf') = 0,
  'arquivo não se lê direto do armazenamento');
SELECT pg_temp.ok((public.regulacao_anexo_abrir(pg_temp.v('a1')::uuid)->>'caminho') = '2a000000-0000-4000-8000-0000000009d1/ecg.pdf', 'abrir devolve o caminho');
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE bucket_id = 'regulacao' AND name = '2a000000-0000-4000-8000-0000000009d1/ecg.pdf') = 1
              AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'regulacao' AND name = '2a000000-0000-4000-8000-0000000009d1/foto.png') = 0,
  'depois de abrir, só aquele arquivo fica legível');
SELECT pg_temp.ok((public.regulacao_anexo_abrir(pg_temp.v('a3')::uuid)->>'conteudo') LIKE 'ECG com supra%', 'documento abre com o texto da versão anexada');
SELECT pg_temp.ok(pg_temp.acessos() = 2, 'cada abertura entra no registro de acesso');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.regulacao_anexo_abrir(%L)', pg_temp.v('a1')), 'Acesso negado', 'quem não vê o pedido não abre');

-- ── 4. retirar e limite ─────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_retirar_anexo(%L, %L)', pg_temp.v('a2'), 'curto'), 'Escreva o motivo', 'retirar pede motivo');
SELECT public.regulacao_retirar_anexo(pg_temp.v('a2')::uuid, 'Imagem do paciente errado');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_anexos('2a000000-0000-4000-8000-0000000009d1')->'anexos') = 2
              AND (public.regulacao_anexos('2a000000-0000-4000-8000-0000000009d1')->>'retirados')::int = 1,
  'retirado sai da lista, mas fica guardado');
SELECT pg_temp.falha(format('SELECT public.regulacao_anexo_abrir(%L)', pg_temp.v('a2')), 'Anexo não encontrado', 'retirado não abre');
RESET ROLE;
SELECT pg_temp.falha(format('DELETE FROM public.regulacao_anexos WHERE id = %L', pg_temp.v('a1')), 'Anexo da regulação não se apaga', 'anexo não se apaga');
INSERT INTO public.regulacao_anexos (solicitacao_id, tipo, caminho, nome, tamanho, tipo_mime, enviado_por)
SELECT '2a000000-0000-4000-8000-0000000009d1', 'arquivo', '2a000000-0000-4000-8000-0000000009d1/extra-' || n || '.pdf', 'extra ' || n, 1000, 'application/pdf',
       '10000000-0000-4000-8000-000000000002' FROM generate_series(1, 8) n;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_anexar_documento('2a000000-0000-4000-8000-0000000009d1', '26000000-0000-4000-8000-0000000009d1')$$,
  'O pedido já tem 10 anexos', 'limite de 10 anexos');

-- ── 5. pedido fechado não recebe anexo ──────────────────────────────────────
RESET ROLE;
UPDATE public.regulacao_solicitacoes SET status = 'negada' WHERE id = '2a000000-0000-4000-8000-0000000009d1';
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT private.regulacao_pode_subir('2a000000-0000-4000-8000-0000000009d1/x.pdf')
              AND NOT (public.regulacao_anexos('2a000000-0000-4000-8000-0000000009d1')->>'pode_anexar')::boolean,
  'pedido fechado não recebe anexo');
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.regulacao_detalhe('2a000000-0000-4000-8000-0000000009d1')->'eventos') e
                    WHERE e->>'evento' IN ('anexo_incluido', 'anexo_aberto', 'anexo_retirado')) = 6,
  'histórico: inclusões, aberturas e retirada');

ROLLBACK;
