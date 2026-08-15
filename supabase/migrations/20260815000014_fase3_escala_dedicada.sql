-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Escala de plantão DEDICADA (segue o modelo Excel do gestor)
--
-- A tabela escala_plantoes (Fase 2) vira legado para acesso; a nova
-- escala_plantao é a escala visual/gerencial: setor × dia × turno × plantonista,
-- com rótulo (texto da célula, ex: "JOAO PEDRO VITOR BUENO CRM 28676 15/15"),
-- observação (passagem de plantão) e flag de escala quinzenal (15/15).
--
-- O acesso do plantonista (na_escala_agora / setores_na_escala_agora) passa a
-- ler DESTA tabela.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Escala dedicada ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_plantao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id    uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  data        date NOT NULL,
  turno       text NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  rotulo      text,
  observacao  text,
  quinzenal   boolean NOT NULL DEFAULT false,
  ativo       boolean NOT NULL DEFAULT true,
  criado_por  uuid REFERENCES public.perfis(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setor_id, data, turno, perfil_id)
);
CREATE INDEX IF NOT EXISTS escala_plantao_data_idx ON public.escala_plantao (data, ativo);
CREATE INDEX IF NOT EXISTS escala_plantao_setor_idx ON public.escala_plantao (setor_id, data, turno, ativo);
CREATE INDEX IF NOT EXISTS escala_plantao_perfil_idx ON public.escala_plantao (perfil_id, data, turno, ativo);

DROP TRIGGER IF EXISTS trg_escala_plantao_updated_at ON public.escala_plantao;
CREATE TRIGGER trg_escala_plantao_updated_at BEFORE UPDATE ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── RLS: escala_plantao ──────────────────────────────────────────────────────
ALTER TABLE public.escala_plantao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_plantao_select" ON public.escala_plantao;
CREATE POLICY "escala_plantao_select" ON public.escala_plantao
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_plantao_insert" ON public.escala_plantao;
CREATE POLICY "escala_plantao_insert" ON public.escala_plantao
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_plantao_update" ON public.escala_plantao;
CREATE POLICY "escala_plantao_update" ON public.escala_plantao
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_plantao_delete" ON public.escala_plantao;
CREATE POLICY "escala_plantao_delete" ON public.escala_plantao
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── RPC: plantonistas da unidade (lista p/ montar a escala) ──────────────────
CREATE OR REPLACE FUNCTION public.plantonistas_da_unidade(p_unidade uuid)
RETURNS TABLE (
  perfil_id  uuid,
  nome_completo text,
  crm        text,
  uf_crm     text,
  email      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT p.id, p.nome_completo, p.crm, p.uf_crm, p.email
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  WHERE v.unidade_id = p_unidade
    AND v.ativo
    AND v.papel = 'plantonista'
    AND p.ativo
  ORDER BY p.nome_completo;
$$;

GRANT EXECUTE ON FUNCTION public.plantonistas_da_unidade(uuid) TO authenticated;

-- ── Acesso do plantonista passa a ler da escala dedicada ─────────────────────
CREATE OR REPLACE FUNCTION private.na_escala_agora(unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.escala_plantao e
    WHERE e.perfil_id = private.meu_perfil_id()
      AND e.ativo
      AND e.unidade_id = unidade
      AND e.data = private.data_atual()
      AND e.turno = private.turno_atual()
  );
$$;

CREATE OR REPLACE FUNCTION private.setores_na_escala_agora()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT e.setor_id FROM public.escala_plantao e
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.data = private.data_atual()
    AND e.turno = private.turno_atual();
$$;

-- ── Seed: setor CINDERELA + plantonista de teste na escala dedicada ──────────
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem)
VALUES ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000101', 'Cinderela', 'outro', 8)
ON CONFLICT (id) DO NOTHING;

-- Copia a escala ativa atual do plantonista de teste para a tabela dedicada
-- (mantém o acesso funcionando após a troca das funções).
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por)
SELECT e.unidade_id, e.setor_id, e.perfil_id, e.data, e.turno, e.ativo, e.criado_por
FROM public.escala_plantoes e
JOIN public.perfis p ON p.id = e.perfil_id
WHERE p.email = 'plantonista@teste.com'
  AND e.ativo
ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;
