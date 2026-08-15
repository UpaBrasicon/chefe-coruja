-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — RLS (Row Level Security)
-- Modelo: admin NUNCA lê dados identificáveis de paciente (na Fase 1 não há
-- tabelas de paciente; a regra vale para leitos/setores: admin só recebe
-- agregados via vw_censo_unidade). Nenhuma policy usa expressão `true`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── organizacoes ─────────────────────────────────────────────────────────────
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizacoes_select" ON public.organizacoes;
CREATE POLICY "organizacoes_select" ON public.organizacoes
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.eh_admin_da_organizacao(id)
    OR EXISTS (
      SELECT 1
      FROM public.vinculos v
      JOIN public.unidades u ON u.id = v.unidade_id
      WHERE v.perfil_id = private.meu_perfil_id()
        AND v.ativo
        AND u.ativo
        AND u.organizacao_id = organizacoes.id
    )
  );

DROP POLICY IF EXISTS "organizacoes_insert" ON public.organizacoes;
CREATE POLICY "organizacoes_insert" ON public.organizacoes
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());

DROP POLICY IF EXISTS "organizacoes_update" ON public.organizacoes;
CREATE POLICY "organizacoes_update" ON public.organizacoes
  FOR UPDATE TO authenticated
  USING (private.eh_super_admin() OR private.eh_admin_da_organizacao(id))
  WITH CHECK (private.eh_super_admin() OR private.eh_admin_da_organizacao(id));

DROP POLICY IF EXISTS "organizacoes_delete" ON public.organizacoes;
CREATE POLICY "organizacoes_delete" ON public.organizacoes
  FOR DELETE TO authenticated
  USING (private.eh_super_admin());

-- ── unidades ─────────────────────────────────────────────────────────────────
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
CREATE POLICY "unidades_select" ON public.unidades
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.eh_admin_da_organizacao(organizacao_id)
    OR id IN (SELECT private.unidades_do_usuario())
  );

DROP POLICY IF EXISTS "unidades_insert" ON public.unidades;
CREATE POLICY "unidades_insert" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.eh_admin_da_organizacao(organizacao_id)
  );

DROP POLICY IF EXISTS "unidades_update" ON public.unidades;
CREATE POLICY "unidades_update" ON public.unidades
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.eh_admin_da_organizacao(organizacao_id)
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.eh_admin_da_organizacao(organizacao_id)
  );

-- Sem policy de DELETE: desativação via `ativo = false` (soft delete).

-- ── perfis ───────────────────────────────────────────────────────────────────
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfis_select" ON public.perfis;
CREATE POLICY "perfis_select" ON public.perfis
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR private.eh_super_admin()
    OR (
      -- admin enxerga: perfis com vínculo em unidade da própria organização
      EXISTS (
        SELECT 1
        FROM public.vinculos v
        JOIN public.unidades u ON u.id = v.unidade_id
        WHERE v.perfil_id = perfis.id
          AND u.organizacao_id IN (SELECT private.orgs_admin())
      )
      -- ou perfis ainda sem vínculo ativo (fluxo "aguardando liberação")
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.vinculos v
          WHERE v.perfil_id = perfis.id AND v.ativo
        )
        AND EXISTS (SELECT 1 FROM private.orgs_admin())
      )
    )
  );

DROP POLICY IF EXISTS "perfis_update" ON public.perfis;
CREATE POLICY "perfis_update" ON public.perfis
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.eh_super_admin())
  WITH CHECK (id = auth.uid() OR private.eh_super_admin());

DROP POLICY IF EXISTS "perfis_delete" ON public.perfis;
CREATE POLICY "perfis_delete" ON public.perfis
  FOR DELETE TO authenticated
  USING (private.eh_super_admin());

-- INSERT: apenas via trigger em auth.users (handle_new_user).

-- ── vinculos ─────────────────────────────────────────────────────────────────
ALTER TABLE public.vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vinculos_select" ON public.vinculos;
CREATE POLICY "vinculos_select" ON public.vinculos
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = vinculos.unidade_id
        AND private.eh_admin_da_organizacao(u.organizacao_id)
    )
  );

-- Anti-escalonamento: usuário NÃO pode criar/alterar o próprio vínculo.
DROP POLICY IF EXISTS "vinculos_insert" ON public.vinculos;
CREATE POLICY "vinculos_insert" ON public.vinculos
  FOR INSERT TO authenticated
  WITH CHECK (
    perfil_id <> private.meu_perfil_id()
    AND (
      private.eh_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.unidades u
        WHERE u.id = vinculos.unidade_id
          AND private.eh_admin_da_organizacao(u.organizacao_id)
      )
    )
  );

DROP POLICY IF EXISTS "vinculos_update" ON public.vinculos;
CREATE POLICY "vinculos_update" ON public.vinculos
  FOR UPDATE TO authenticated
  USING (
    perfil_id <> private.meu_perfil_id()
    AND (
      private.eh_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.unidades u
        WHERE u.id = vinculos.unidade_id
          AND private.eh_admin_da_organizacao(u.organizacao_id)
      )
    )
  )
  WITH CHECK (
    perfil_id <> private.meu_perfil_id()
    AND (
      private.eh_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.unidades u
        WHERE u.id = vinculos.unidade_id
          AND private.eh_admin_da_organizacao(u.organizacao_id)
      )
    )
  );

-- Sem policy de DELETE: revogação via `ativo = false`.

-- ── setores ──────────────────────────────────────────────────────────────────
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

-- Admin NÃO tem SELECT direto em setores (recebe só agregados).
DROP POLICY IF EXISTS "setores_select" ON public.setores;
CREATE POLICY "setores_select" ON public.setores
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR unidade_id IN (SELECT private.unidades_do_usuario())
  );

DROP POLICY IF EXISTS "setores_insert" ON public.setores;
CREATE POLICY "setores_insert" ON public.setores
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.vinculos v
      WHERE v.perfil_id = private.meu_perfil_id()
        AND v.unidade_id = setores.unidade_id
        AND v.ativo
        AND v.papel = 'gestor'
    )
  );

DROP POLICY IF EXISTS "setores_update" ON public.setores;
CREATE POLICY "setores_update" ON public.setores
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.vinculos v
      WHERE v.perfil_id = private.meu_perfil_id()
        AND v.unidade_id = setores.unidade_id
        AND v.ativo
        AND v.papel = 'gestor'
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.vinculos v
      WHERE v.perfil_id = private.meu_perfil_id()
        AND v.unidade_id = setores.unidade_id
        AND v.ativo
        AND v.papel = 'gestor'
    )
  );

DROP POLICY IF EXISTS "setores_delete" ON public.setores;
CREATE POLICY "setores_delete" ON public.setores
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.vinculos v
      WHERE v.perfil_id = private.meu_perfil_id()
        AND v.unidade_id = setores.unidade_id
        AND v.ativo
        AND v.papel = 'gestor'
    )
  );

-- ── leitos ───────────────────────────────────────────────────────────────────
ALTER TABLE public.leitos ENABLE ROW LEVEL SECURITY;

-- Admin NÃO tem SELECT direto em leitos (recebe só agregados).
DROP POLICY IF EXISTS "leitos_select" ON public.leitos;
CREATE POLICY "leitos_select" ON public.leitos
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.setores s
      WHERE s.id = leitos.setor_id
        AND s.unidade_id IN (SELECT private.unidades_do_usuario())
    )
  );

DROP POLICY IF EXISTS "leitos_insert" ON public.leitos;
CREATE POLICY "leitos_insert" ON public.leitos
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.setores s
      JOIN public.vinculos v ON v.unidade_id = s.unidade_id
      WHERE s.id = leitos.setor_id
        AND v.perfil_id = private.meu_perfil_id()
        AND v.ativo
        AND v.papel = 'gestor'
    )
  );

DROP POLICY IF EXISTS "leitos_update" ON public.leitos;
CREATE POLICY "leitos_update" ON public.leitos
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.setores s
      JOIN public.vinculos v ON v.unidade_id = s.unidade_id
      WHERE s.id = leitos.setor_id
        AND v.perfil_id = private.meu_perfil_id()
        AND v.ativo
        AND v.papel = 'gestor'
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.setores s
      JOIN public.vinculos v ON v.unidade_id = s.unidade_id
      WHERE s.id = leitos.setor_id
        AND v.perfil_id = private.meu_perfil_id()
        AND v.ativo
        AND v.papel = 'gestor'
    )
  );

DROP POLICY IF EXISTS "leitos_delete" ON public.leitos;
CREATE POLICY "leitos_delete" ON public.leitos
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.setores s
      JOIN public.vinculos v ON v.unidade_id = s.unidade_id
      WHERE s.id = leitos.setor_id
        AND v.perfil_id = private.meu_perfil_id()
        AND v.ativo
        AND v.papel = 'gestor'
    )
  );

-- ── log_auditoria (append-only: sem INSERT/UPDATE/DELETE por policy) ─────────
ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_auditoria_select" ON public.log_auditoria;
CREATE POLICY "log_auditoria_select" ON public.log_auditoria
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR (
      unidade_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.unidades u
        WHERE u.id = log_auditoria.unidade_id
          AND private.eh_admin_da_organizacao(u.organizacao_id)
      )
    )
  );

-- ── super_admins ─────────────────────────────────────────────────────────────
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_select" ON public.super_admins;
CREATE POLICY "super_admins_select" ON public.super_admins
  FOR SELECT TO authenticated
  USING (private.eh_super_admin());

DROP POLICY IF EXISTS "super_admins_insert" ON public.super_admins;
CREATE POLICY "super_admins_insert" ON public.super_admins
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());

DROP POLICY IF EXISTS "super_admins_delete" ON public.super_admins;
CREATE POLICY "super_admins_delete" ON public.super_admins
  FOR DELETE TO authenticated
  USING (private.eh_super_admin());
