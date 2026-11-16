-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S5: anexos (migration 20270414000060).
-- 1. A1: tipos e tamanho de cada bucket, sem SVG nem HTML.
-- 2. A1: registrar_anexo_prontuario e a tabela recusam SVG.
-- 3. A2: gestor da unidade vê o objeto do bucket `atendimento`, mas não o
--    sobrescreve nem o move.
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000055a1'),
  ('uni', '00000000-0000-4000-8000-0000000055a2'),
  ('set', '00000000-0000-4000-8000-0000000055a3'),
  ('med', '00000000-0000-4000-8000-0000000055b1'),
  ('pac', '00000000-0000-4000-8000-0000000055c1');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
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

-- ── 1. A1: tipos e tamanho de cada bucket ───────────────────────────────────
SELECT pg_temp.ok(
  (SELECT count(*) FROM storage.buckets
    WHERE id IN ('atendimento', 'farmacia', 'banners', 'fotos', 'receitas')
      AND file_size_limit IS NOT NULL AND allowed_mime_types IS NOT NULL) = 5,
  'atendimento, farmacia, banners, fotos e receitas com tipos e tamanho');
SELECT pg_temp.ok(
  NOT EXISTS (SELECT 1 FROM storage.buckets b, unnest(b.allowed_mime_types) t
               WHERE t ILIKE '%svg%' OR t ILIKE '%html%' OR t ILIKE '%/xml' OR t ILIKE '%javascript%' OR t LIKE '%/*'),
  'nenhum bucket aceita SVG, HTML, XML, script ou curinga');
SELECT pg_temp.ok(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'atendimento') = 20971520
  AND (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'atendimento')
      @> ARRAY['application/pdf', 'image/jpeg', 'image/png'],
  'atendimento: PDF e imagem comum até 20 MB');
SELECT pg_temp.ok(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'banners') = 5242880
  AND (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'banners') <@ ARRAY['image/png', 'image/jpeg', 'image/webp'],
  'banners (público): só PNG, JPEG e WebP até 5 MB');

-- ── fixture: unidade, gestora com plantão aberto e paciente ─────────────────
INSERT INTO auth.users (id, email) VALUES (pg_temp.id('med'), 'med@s5.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('med'), 'Médica do S5')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do S5');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do S5', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('set'), pg_temp.id('uni'), 'Pronto Socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('med'), pg_temp.id('uni'), 'gestor');
INSERT INTO public.pacientes (id, unidade_id, setor_id, nome, data_nascimento)
VALUES (pg_temp.id('pac'), pg_temp.id('uni'), pg_temp.id('set'), 'Paciente do S5', date '1970-01-01');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES (pg_temp.id('uni'), pg_temp.id('set'), pg_temp.id('med'), private.data_atual(), 'manha', now() - interval '3 hours', 720);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('uni') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE arq (nome text PRIMARY KEY, caminho text) ON COMMIT DROP;
GRANT ALL ON arq TO authenticated;
INSERT INTO arq VALUES
  ('svg', pg_temp.id('uni')::text || '/' || pg_temp.id('pac')::text || '/prontuario/s5-desenho.svg'),
  ('png', pg_temp.id('uni')::text || '/' || pg_temp.id('pac')::text || '/prontuario/s5-exame.png'),
  ('jus', pg_temp.id('uni')::text || '/justificativas/s5-atestado.pdf');
INSERT INTO storage.objects (bucket_id, name, owner) SELECT 'atendimento', caminho, pg_temp.id('med') FROM arq;

-- ── 2. A1: o registro do anexo e a tabela recusam SVG ───────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.registrar_anexo_prontuario(%L, %L, %L, %L, %s)', pg_temp.id('pac'),
  (SELECT caminho FROM arq WHERE nome = 'svg'), 'desenho.svg', 'image/svg+xml', 1000),
  'Anexo só em PDF ou imagem', 'registrar_anexo_prontuario recusa image/svg+xml');
SELECT pg_temp.falha(format('SELECT public.registrar_anexo_prontuario(%L, %L, %L, %L, %s)', pg_temp.id('pac'),
  (SELECT caminho FROM arq WHERE nome = 'svg'), 'pagina.html', 'text/html', 1000),
  'Anexo só em PDF ou imagem', 'registrar_anexo_prontuario recusa text/html');
SELECT pg_temp.ok(public.registrar_anexo_prontuario(pg_temp.id('pac'), (SELECT caminho FROM arq WHERE nome = 'png'),
  'exame.png', 'image/png', 2048) IS NOT NULL, 'registrar_anexo_prontuario aceita image/png');
RESET ROLE;
SELECT pg_temp.falha(format(
  'INSERT INTO public.anexos_prontuario (organizacao_id, unidade_id, paciente_id, caminho, nome, tipo_mime, tamanho, autor_id) VALUES (%L, %L, %L, %L, %L, %L, 1000, %L)',
  pg_temp.id('org'), pg_temp.id('uni'), pg_temp.id('pac'), (SELECT caminho FROM arq WHERE nome = 'svg'), 'desenho.svg',
  'image/svg+xml', pg_temp.id('med')),
  'new row for relation "anexos_prontuario" violates check constraint "anexos_prontuario_tipo_seguro"',
  'a tabela recusa SVG em linha nova');

-- ── 3. A2: gestor vê o objeto, mas não sobrescreve nem move ─────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'atendimento' AND name = (SELECT caminho FROM arq WHERE nome = 'jus')) = 1,
  'gestor da unidade vê a justificativa no bucket');
WITH u AS (
  UPDATE storage.objects SET metadata = jsonb_build_object('mimetype', 'image/svg+xml')
   WHERE bucket_id = 'atendimento' AND name = (SELECT caminho FROM arq WHERE nome = 'jus') RETURNING 1)
SELECT pg_temp.ok((SELECT count(*) FROM u) = 0, 'gestor não sobrescreve objeto do atendimento');
WITH u AS (
  UPDATE storage.objects SET name = (SELECT caminho FROM arq WHERE nome = 'jus') || '.movido'
   WHERE bucket_id = 'atendimento' AND name = (SELECT caminho FROM arq WHERE nome = 'jus') RETURNING 1)
SELECT pg_temp.ok((SELECT count(*) FROM u) = 0, 'gestor não move objeto do atendimento');
RESET ROLE;
SELECT pg_temp.ok(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'atendimento' AND name = (SELECT caminho FROM arq WHERE nome = 'jus')
     AND metadata IS NULL) = 1,
  'o objeto continua igual');

ROLLBACK;
