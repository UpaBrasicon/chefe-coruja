-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Escala FIXA (template) + geração mensal automática + alertas
--
-- O gestor mantém DUAS escalas:
--   1. ESCALA FIXA (escala_fixa): o padrão que não muda — setor × dia da semana
--      × turno × plantonista. É o template (ex.: quem é fixo 15/15).
--   2. ESCALA MENSAL (escala_plantao): gerada automaticamente a partir da fixa
--      a cada mês (função gerar_escala_mensal). É a escala operacional, onde
--      ocorrem passagens, faltas e justificativas.
--
-- Também cria o tipo 'falta' em solicitacoes_escala para o alerta do gestor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Escala fixa (template) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_fixa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id    uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  dia_semana  smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo .. 6=sábado
  turno       text NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  quinzenal   boolean NOT NULL DEFAULT false, -- 15/15: alterna a cada quinzena
  ativo       boolean NOT NULL DEFAULT true,
  criado_por  uuid REFERENCES public.perfis(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, setor_id, perfil_id, dia_semana, turno)
);
CREATE INDEX IF NOT EXISTS escala_fixa_unidade_idx ON public.escala_fixa (unidade_id, dia_semana, turno, ativo);

DROP TRIGGER IF EXISTS trg_escala_fixa_updated_at ON public.escala_fixa;
CREATE TRIGGER trg_escala_fixa_updated_at BEFORE UPDATE ON public.escala_fixa
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── RLS: escala_fixa ─────────────────────────────────────────────────────────
ALTER TABLE public.escala_fixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_fixa_select" ON public.escala_fixa;
CREATE POLICY "escala_fixa_select" ON public.escala_fixa
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_fixa_insert" ON public.escala_fixa;
CREATE POLICY "escala_fixa_insert" ON public.escala_fixa
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_fixa_update" ON public.escala_fixa;
CREATE POLICY "escala_fixa_update" ON public.escala_fixa
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_fixa_delete" ON public.escala_fixa;
CREATE POLICY "escala_fixa_delete" ON public.escala_fixa
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── Adiciona tipo 'falta' às solicitações de escala ──────────────────────────
ALTER TABLE public.solicitacoes_escala
  DROP CONSTRAINT IF EXISTS solicitacoes_escala_tipo_check;
ALTER TABLE public.solicitacoes_escala
  ADD CONSTRAINT solicitacoes_escala_tipo_check
  CHECK (tipo IN ('sair_fixo', 'passar_plantao', 'justificar_falta', 'falta'));

-- ── Geração mensal automática a partir da fixa ───────────────────────────────
-- Para cada dia do mês, aplica os templates da escala fixa do dia da semana.
-- Registros quinzenais (15/15) alternam por quinzena (semanas ímpares do mês).
CREATE OR REPLACE FUNCTION public.gerar_escala_mensal(
  p_unidade uuid,
  p_ano int,
  p_mes int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ini date := make_date(p_ano, p_mes, 1);
  v_fim date := (make_date(p_ano, p_mes + 1, 1) - interval '1 day')::date;
  v_dia date;
  v_dow int;
  v_semana_do_mes int;
  v_count int := 0;
BEGIN
  FOR v_dia IN SELECT generate_series(v_ini, v_fim, interval '1 day')::date LOOP
    v_dow := EXTRACT(ISODOW FROM v_dia)::int % 7; -- 0=domingo..6=sábado (ISO: 7=dom)
    v_semana_do_mes := (EXTRACT(day FROM v_dia)::int - 1) / 7; -- 0 = 1ª semana

    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, quinzenal, ativo)
    SELECT f.unidade_id, f.setor_id, f.perfil_id, v_dia, f.turno, f.quinzenal, true
    FROM public.escala_fixa f
    WHERE f.unidade_id = p_unidade
      AND f.ativo
      AND f.dia_semana = v_dow
      AND (f.quinzenal = false OR v_semana_do_mes % 2 = 0)
    ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_escala_mensal(uuid, int, int) TO authenticated;

-- ── Seed: escala fixa do plantonista de teste (todos os dias, todos os turnos) ─
INSERT INTO public.escala_fixa (unidade_id, setor_id, perfil_id, dia_semana, turno, quinzenal, criado_por)
SELECT '00000000-0000-0000-0000-000000000101', s.id, p.id, d.dia, t.turno, false,
       (SELECT id FROM public.perfis WHERE email = 'super@teste.com')
FROM (VALUES
  ('00000000-0000-0000-0000-000000000301'::uuid),
  ('00000000-0000-0000-0000-000000000302'::uuid),
  ('00000000-0000-0000-0000-000000000303'::uuid),
  ('00000000-0000-0000-0000-000000000304'::uuid),
  ('00000000-0000-0000-0000-000000000305'::uuid),
  ('00000000-0000-0000-0000-000000000306'::uuid)
) AS sv(id)
JOIN public.setores s ON s.id = sv.id
CROSS JOIN public.perfis p
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS d(dia)
CROSS JOIN (VALUES ('manha'), ('tarde'), ('noite')) AS t(turno)
WHERE p.email = 'plantonista@teste.com'
ON CONFLICT (unidade_id, setor_id, perfil_id, dia_semana, turno) DO NOTHING;
