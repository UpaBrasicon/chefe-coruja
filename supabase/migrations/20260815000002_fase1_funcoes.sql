-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — Funções auxiliares (schema private, SECURITY DEFINER)
-- Usadas nas policies RLS e no cliente (via RPC).
-- Todas com search_path fixo e objetos qualificados (proteção contra CVE de
-- search_path). Bypass de RLS é intencional: rodam como owner.
-- ─────────────────────────────────────────────────────────────────────────────

-- Id do perfil do usuário atual (1:1 com auth.users)
CREATE OR REPLACE FUNCTION private.meu_perfil_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.perfis WHERE id = auth.uid();
$$;

-- Se o usuário atual é super_admin
CREATE OR REPLACE FUNCTION private.eh_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE perfil_id = auth.uid()
  );
$$;

-- Papel do usuário na unidade (mais forte ganha: admin > gestor > plantonista).
-- Retorna NULL se não houver vínculo ativo.
CREATE OR REPLACE FUNCTION private.papel_na_unidade(unidade uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.papel::text
  FROM public.vinculos v
  WHERE v.perfil_id = private.meu_perfil_id()
    AND v.unidade_id = unidade
    AND v.ativo
  ORDER BY CASE v.papel
    WHEN 'admin'       THEN 0
    WHEN 'gestor'      THEN 1
    WHEN 'plantonista' THEN 2
  END
  LIMIT 1;
$$;

-- Unidades com vínculo ativo do usuário
CREATE OR REPLACE FUNCTION private.unidades_do_usuario()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.unidade_id
  FROM public.vinculos v
  WHERE v.perfil_id = private.meu_perfil_id()
    AND v.ativo
  ORDER BY v.unidade_id;
$$;

-- Organizações onde o usuário é admin (admin em qualquer unidade ativa da org)
CREATE OR REPLACE FUNCTION private.orgs_admin()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT u.organizacao_id
  FROM public.vinculos v
  JOIN public.unidades u ON u.id = v.unidade_id
  WHERE v.perfil_id = private.meu_perfil_id()
    AND v.ativo
    AND v.papel = 'admin'
    AND u.ativo;
$$;

-- Se o usuário é admin em qualquer unidade da organização
CREATE OR REPLACE FUNCTION private.eh_admin_da_organizacao(org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM private.orgs_admin() WHERE orgs_admin = org);
$$;

-- Unidades das organizações onde o usuário é admin (visão do admin)
CREATE OR REPLACE FUNCTION private.unidades_admin()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM public.unidades u
  WHERE u.ativo
    AND u.organizacao_id IN (SELECT private.orgs_admin())
  ORDER BY u.id;
$$;

-- Registra evento de auditoria (chamado pelo cliente via RPC).
-- SECURITY DEFINER: grava mesmo sem policy de INSERT.
CREATE OR REPLACE FUNCTION private.registrar_auditoria(
  p_acao         text,
  p_entidade     text,
  p_entidade_id  uuid DEFAULT NULL,
  p_unidade_id   uuid DEFAULT NULL,
  p_payload      jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.log_auditoria (
    ator_id, acao, entidade, entidade_id, unidade_id, payload
  )
  VALUES (
    private.meu_perfil_id(),
    p_acao,
    p_entidade,
    p_entidade_id,
    p_unidade_id,
    p_payload
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.meu_perfil_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.eh_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.papel_na_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.unidades_do_usuario() TO authenticated;
GRANT EXECUTE ON FUNCTION private.orgs_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.eh_admin_da_organizacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.unidades_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.registrar_auditoria(text, text, uuid, uuid, jsonb) TO authenticated;
