-- ════════════════════════════════════════════════════════════════════════════
-- Bug alto A5 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- atestado na justificativa de falta. A E4 levou a justificativa com anexo para
-- todos os papéis, mas a política atendimento_upload do bucket privado
-- atendimento só aceita gestor e plantonista (private.unidades_gestor_plantonista):
-- a enfermeira, o técnico e os outros papéis batiam em "new row violates
-- row-level security policy". O link gravado era getPublicUrl, que não abre em
-- bucket privado (corrigido na tela: URL assinada na hora de abrir).
--
-- Correção (só acrescenta; nada do que já vale sai):
--  1. atendimento_justificativa_upload (INSERT): quem tem vínculo ativo na
--     unidade grava em <unidade>/justificativas/<arquivo>.
--  2. atendimento_justificativa_read (SELECT): quem enviou e o gestor da unidade
--     leem o arquivo das justificativas.
--  3. atendimento_justificativa_sigilo (SELECT, restritiva): o atestado é dado de
--     saúde do profissional; nas justificativas, só quem enviou, o gestor da
--     unidade e o super admin leem (a política ampla atendimento_read deixava o
--     plantonista da unidade ler o atestado de qualquer colega).
--
-- Sem DROP/RENAME de coluna. Idempotente (DROP POLICY IF EXISTS antes do CREATE).
-- Teste: supabase/tests/escala_atestado_falta.sql
--
-- Rollback:
--   DROP POLICY IF EXISTS "atendimento_justificativa_upload" ON storage.objects;
--   DROP POLICY IF EXISTS "atendimento_justificativa_read" ON storage.objects;
--   DROP POLICY IF EXISTS "atendimento_justificativa_sigilo" ON storage.objects;
--   DROP FUNCTION IF EXISTS private.justificativa_da_minha_unidade(text);
--   DROP FUNCTION IF EXISTS private.justificativa_que_posso_ler(text, text);
-- ════════════════════════════════════════════════════════════════════════════

-- <unidade>/justificativas/<arquivo>, com vínculo ativo meu na unidade
CREATE OR REPLACE FUNCTION private.justificativa_da_minha_unidade(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT p_nome ~ '^[0-9a-f-]{36}/justificativas/[^/]+$'
     AND EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo
                    AND v.unidade_id::text = split_part(p_nome, '/', 1))
$function$;
REVOKE ALL ON FUNCTION private.justificativa_da_minha_unidade(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.justificativa_da_minha_unidade(text) TO authenticated;

-- quem enviou, o gestor da unidade da pasta ou o super admin
CREATE OR REPLACE FUNCTION private.justificativa_que_posso_ler(p_nome text, p_dono text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT p_dono = auth.uid()::text
      OR private.eh_super_admin()
      OR EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo AND v.papel = 'gestor'
                    AND v.unidade_id::text = split_part(p_nome, '/', 1))
$function$;
REVOKE ALL ON FUNCTION private.justificativa_que_posso_ler(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.justificativa_que_posso_ler(text, text) TO authenticated;

DROP POLICY IF EXISTS "atendimento_justificativa_upload" ON storage.objects;
CREATE POLICY "atendimento_justificativa_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atendimento' AND private.justificativa_da_minha_unidade(name));

DROP POLICY IF EXISTS "atendimento_justificativa_read" ON storage.objects;
CREATE POLICY "atendimento_justificativa_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'atendimento' AND name ~ '^[0-9a-f-]{36}/justificativas/'
         AND private.justificativa_que_posso_ler(name, owner_id));

DROP POLICY IF EXISTS "atendimento_justificativa_sigilo" ON storage.objects;
CREATE POLICY "atendimento_justificativa_sigilo" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'atendimento' OR name !~ '^[0-9a-f-]{36}/justificativas/'
         OR private.justificativa_que_posso_ler(name, owner_id));
