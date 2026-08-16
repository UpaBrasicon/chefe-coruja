-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Candidaturas a plantões livres
--
-- O plantonista vê a Escala Geral (setor × dia × turno do mês) e pode se
-- candidatar a plantões sem plantonista. A candidatura fica pendente até o
-- gestor aprovar (assumindo o plantão) ou recusar.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.candidaturas_escala (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id    uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  data        date NOT NULL,
  turno       text NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  criado_por  uuid REFERENCES public.perfis(id),
  decidido_por uuid REFERENCES public.perfis(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setor_id, data, turno, perfil_id)
);
CREATE INDEX IF NOT EXISTS candidaturas_unidade_idx ON public.candidaturas_escala (unidade_id, status);
CREATE INDEX IF NOT EXISTS candidaturas_perfil_idx ON public.candidaturas_escala (perfil_id);

DROP TRIGGER IF EXISTS trg_candidaturas_escala_updated_at ON public.candidaturas_escala;
CREATE TRIGGER trg_candidaturas_escala_updated_at BEFORE UPDATE ON public.candidaturas_escala
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.candidaturas_escala ENABLE ROW LEVEL SECURITY;

-- SELECT: o candidato, o gestor da unidade ou super
DROP POLICY IF EXISTS "candidaturas_select" ON public.candidaturas_escala;
CREATE POLICY "candidaturas_select" ON public.candidaturas_escala
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- INSERT: plantonista cria a própria candidatura
DROP POLICY IF EXISTS "candidaturas_insert" ON public.candidaturas_escala;
CREATE POLICY "candidaturas_insert" ON public.candidaturas_escala
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR (
      perfil_id = private.meu_perfil_id()
      AND private.papel_na_unidade(unidade_id) = 'plantonista'
    )
  );

-- UPDATE/DELETE: gestor decide; super também
DROP POLICY IF EXISTS "candidaturas_update" ON public.candidaturas_escala;
CREATE POLICY "candidaturas_update" ON public.candidaturas_escala
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "candidaturas_delete" ON public.candidaturas_escala;
CREATE POLICY "candidaturas_delete" ON public.candidaturas_escala
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── Aprovar candidatura: cria o plantão na escala e marca como aprovado ──────
CREATE OR REPLACE FUNCTION public.aprovar_candidatura(p_candidatura uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidatura public.candidaturas_escala%ROWTYPE;
  v_plantao uuid;
BEGIN
  SELECT * INTO v_candidatura
  FROM public.candidaturas_escala
  WHERE id = p_candidatura
  FOR UPDATE;

  IF v_candidatura.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  -- Verifica se o plantão já não foi preenchido (evita conflito)
  SELECT e.id INTO v_plantao
  FROM public.escala_plantao e
  WHERE e.setor_id = v_candidatura.setor_id
    AND e.data = v_candidatura.data
    AND e.turno = v_candidatura.turno
    AND e.ativo
  LIMIT 1;

  IF v_plantao IS NOT NULL THEN
    RAISE EXCEPTION 'Este plantão já foi preenchido por outro plantonista.';
  END IF;

  -- Cria o plantão para o candidato
  INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por)
  VALUES (v_candidatura.unidade_id, v_candidatura.setor_id, v_candidatura.perfil_id,
          v_candidatura.data, v_candidatura.turno, true, auth.uid())
  RETURNING id INTO v_plantao;

  UPDATE public.candidaturas_escala
  SET status = 'aprovado', decidido_por = auth.uid()
  WHERE id = p_candidatura;

  RETURN v_plantao;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_candidatura(uuid) TO authenticated;
