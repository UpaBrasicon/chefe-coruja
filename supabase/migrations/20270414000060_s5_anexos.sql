-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S5: anexos (docs/seguranca/S5-ANEXOS-DIAGNOSTICO.md).
-- Decisões do RT em 15/11/2026: todas A.
--
-- A1. Tipos e tamanho por bucket, conferidos pelo armazenamento (não só pela
--     tela). Nada de SVG nem HTML: o arquivo declarado como imagem ou PDF não
--     roda script ao abrir. O registro do anexo do prontuário passa a aceitar só
--     os tipos do bucket, e a tabela ganha a mesma regra para linhas novas
--     (NOT VALID: as antigas ficam como estão).
-- A2. Sobrescrever ou mover objeto do bucket `atendimento` só o super admin,
--     igual à exclusão. Nenhuma tela usa sobrescrita (envio sempre upsert:false).
-- A3, A4 e A5 não mudam o banco.
--
-- Idempotente. Rollback no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── A1. Tipos e tamanho por bucket ──────────────────────────────────────────
UPDATE storage.buckets SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'atendimento';

UPDATE storage.buckets SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/csv', 'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'farmacia';

UPDATE storage.buckets SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id IN ('banners', 'fotos');

UPDATE storage.buckets SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']
WHERE id = 'receitas';

-- O registro do anexo do prontuário aceita só os tipos do bucket.
CREATE OR REPLACE FUNCTION public.registrar_anexo_prontuario(
  p_paciente uuid, p_caminho text, p_nome text, p_tipo_mime text, p_tamanho integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid; v_org uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF p_caminho IS NULL OR NOT starts_with(p_caminho, v_unidade::text || '/' || p_paciente::text || '/prontuario/')
     OR p_caminho ~ '\.\.' THEN
    RAISE EXCEPTION 'Caminho do anexo fora da pasta do prontuário do paciente.';
  END IF;
  -- S5 (A1): sem SVG nem outro tipo que rode script ao abrir
  IF p_tipo_mime IS NULL OR p_tipo_mime NOT IN
     ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') THEN
    RAISE EXCEPTION 'Anexo só em PDF ou imagem (JPEG, PNG, WebP ou HEIC).';
  END IF;
  IF p_tamanho IS NULL OR p_tamanho <= 0 OR p_tamanho > 10485760 THEN
    RAISE EXCEPTION 'Anexo acima de 10 MB. Reduza o arquivo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'atendimento' AND o.name = p_caminho) THEN
    RAISE EXCEPTION 'Arquivo não encontrado no armazenamento. Envie de novo.';
  END IF;
  INSERT INTO public.anexos_prontuario (organizacao_id, unidade_id, paciente_id, episodio_id, caminho, nome, tipo_mime, tamanho, autor_id)
  VALUES (v_org, v_unidade, p_paciente, private.episodio_aberto(p_paciente), p_caminho, left(btrim(p_nome), 200), p_tipo_mime,
          p_tamanho, v_perfil)
  ON CONFLICT (caminho) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Este arquivo já está anexado.'; END IF;
  PERFORM private.registrar_auditoria('anexar_prontuario', 'anexos_prontuario', v_id, v_unidade,
    jsonb_build_object('tipo_mime', p_tipo_mime, 'tamanho', p_tamanho));
  RETURN v_id;
END $$;

-- A mesma regra na tabela, para linhas novas (as antigas não são conferidas).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.anexos_prontuario'::regclass AND conname = 'anexos_prontuario_tipo_seguro') THEN
    ALTER TABLE public.anexos_prontuario ADD CONSTRAINT anexos_prontuario_tipo_seguro
      CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')) NOT VALID;
  END IF;
END $$;

-- ── A2. Sobrescrita no bucket `atendimento` só pelo super admin ─────────────
DROP POLICY IF EXISTS "atendimento_update" ON storage.objects;
CREATE POLICY "atendimento_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'atendimento' AND private.eh_super_admin())
  WITH CHECK (bucket_id = 'atendimento' AND private.eh_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, se precisar):
--   UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL
--    WHERE id IN ('atendimento', 'banners', 'fotos', 'receitas');
--   UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'farmacia';  -- o limite de 20 MB já existia
--   ALTER TABLE public.anexos_prontuario DROP CONSTRAINT IF EXISTS anexos_prontuario_tipo_seguro;
--   registrar_anexo_prontuario: recriar com a versão de 20261005000003_documentos_estados.sql.
--   atendimento_update: recriar com a versão de 20260817000013_fix_atendimento_bucket_rls.sql
--     (super admin ou unidade em private.unidades_gestor_plantonista()).
-- ════════════════════════════════════════════════════════════════════════════
