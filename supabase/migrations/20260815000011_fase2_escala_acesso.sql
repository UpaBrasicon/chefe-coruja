-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 — Escala de plantão + acesso por turno (relógio no servidor)
--
-- Platonista só acessa pacientes/setores se ESTIVER NA ESCALA no dia e turno
-- atuais, segundo o RELÓGIO DO SERVIDOR (não depende do relógio do Windows).
-- Acesso pago (fora da escala) é organizado na tabela acessos_plantonista para
-- liberar futuramente: prescrição, admissão, atestado e documento de internação.
-- ─────────────────────────────────────────────────────────────────────────────

-- Paciente passa a ter setor (onde está atualmente) — base do acesso por escala
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);

CREATE INDEX IF NOT EXISTS pacientes_setor_idx ON public.pacientes (setor_id);

-- ── escala_plantoes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_plantoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id    uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  data        date NOT NULL,
  turno       text NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  ativo       boolean NOT NULL DEFAULT true,
  criado_por  uuid REFERENCES public.perfis(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, setor_id, data, turno)
);
CREATE INDEX IF NOT EXISTS escala_data_turno_idx ON public.escala_plantoes (data, turno, ativo);
CREATE INDEX IF NOT EXISTS escala_perfil_idx ON public.escala_plantoes (perfil_id, data, turno, ativo);

-- ── acessos_plantonista (acesso pago fora da escala — organizado p/ futuro) ──
CREATE TABLE IF NOT EXISTS public.acessos_plantonista (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo_acesso text NOT NULL DEFAULT 'atendimento',
  ativo       boolean NOT NULL DEFAULT true,
  valida_ate  timestamptz,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acessos_perfil_idx ON public.acessos_plantonista (perfil_id, ativo);

DROP TRIGGER IF EXISTS trg_escala_updated_at ON public.escala_plantoes;
CREATE TRIGGER trg_escala_updated_at BEFORE UPDATE ON public.escala_plantoes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── Relógio do servidor (não depende do cliente) ─────────────────────────────
CREATE OR REPLACE FUNCTION private.data_atual()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

CREATE OR REPLACE FUNCTION private.horario_servidor()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT now();
$$;

-- Turno pelo horário de São Paulo: manhã 07–13 · tarde 13–19 · noite 19–07
CREATE OR REPLACE FUNCTION private.turno_atual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
     AND (now() AT TIME ZONE 'America/Sao_Paulo')::time <  time '13:00' THEN 'manha'
    WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= time '13:00'
     AND (now() AT TIME ZONE 'America/Sao_Paulo')::time <  time '19:00' THEN 'tarde'
    ELSE 'noite'
  END;
$$;

-- Está na escala agora (dia + turno atuais do servidor)?
CREATE OR REPLACE FUNCTION private.na_escala_agora(unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.escala_plantoes e
    WHERE e.perfil_id = private.meu_perfil_id()
      AND e.ativo
      AND e.unidade_id = unidade
      AND e.data = private.data_atual()
      AND e.turno = private.turno_atual()
  );
$$;

-- Setores onde estou na escala agora
CREATE OR REPLACE FUNCTION private.setores_na_escala_agora()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT e.setor_id FROM public.escala_plantoes e
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.data = private.data_atual()
    AND e.turno = private.turno_atual();
$$;

-- Acesso pago (fora da escala) — preparado para prescrição/admissão/atestado/
-- documento de internação
CREATE OR REPLACE FUNCTION private.tem_acesso_atendimento(unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.acessos_plantonista a
    WHERE a.perfil_id = private.meu_perfil_id()
      AND a.ativo
      AND a.unidade_id = unidade
      AND (a.valida_ate IS NULL OR a.valida_ate > now())
  );
$$;

-- ── RPCs públicas ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.horario_servidor()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT private.horario_servidor(); $$;

CREATE OR REPLACE FUNCTION public.turno_atual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT private.turno_atual(); $$;

CREATE OR REPLACE FUNCTION public.na_escala_agora(unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT private.na_escala_agora(unidade); $$;

CREATE OR REPLACE FUNCTION public.tem_acesso_atendimento(unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT private.tem_acesso_atendimento(unidade); $$;

GRANT EXECUTE ON FUNCTION public.horario_servidor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.turno_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.na_escala_agora(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_acesso_atendimento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.data_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION private.horario_servidor() TO authenticated;
GRANT EXECUTE ON FUNCTION private.turno_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION private.na_escala_agora(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.setores_na_escala_agora() TO authenticated;
GRANT EXECUTE ON FUNCTION private.tem_acesso_atendimento(uuid) TO authenticated;

-- ── RLS: escala_plantoes ─────────────────────────────────────────────────────
ALTER TABLE public.escala_plantoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_select" ON public.escala_plantoes;
CREATE POLICY "escala_select" ON public.escala_plantoes
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_insert" ON public.escala_plantoes;
CREATE POLICY "escala_insert" ON public.escala_plantoes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_update" ON public.escala_plantoes;
CREATE POLICY "escala_update" ON public.escala_plantoes
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "escala_delete" ON public.escala_plantoes;
CREATE POLICY "escala_delete" ON public.escala_plantoes
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- ── RLS: acessos_plantonista ─────────────────────────────────────────────────
ALTER TABLE public.acessos_plantonista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acessos_select" ON public.acessos_plantonista;
CREATE POLICY "acessos_select" ON public.acessos_plantonista
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id = acessos_plantonista.unidade_id
        AND (private.papel_na_unidade(u.id) = 'gestor' OR private.eh_admin_da_organizacao(u.organizacao_id))
    )
  );

-- Concessão de acesso pago: plataforma (super) — futuramente via webhook de pagamento
DROP POLICY IF EXISTS "acessos_insert" ON public.acessos_plantonista;
CREATE POLICY "acessos_insert" ON public.acessos_plantonista
  FOR INSERT TO authenticated WITH CHECK (private.eh_super_admin());
DROP POLICY IF EXISTS "acessos_update" ON public.acessos_plantonista;
CREATE POLICY "acessos_update" ON public.acessos_plantonista
  FOR UPDATE TO authenticated USING (private.eh_super_admin()) WITH CHECK (private.eh_super_admin());
DROP POLICY IF EXISTS "acessos_delete" ON public.acessos_plantonista;
CREATE POLICY "acessos_delete" ON public.acessos_plantonista
  FOR DELETE TO authenticated USING (private.eh_super_admin());

-- ── RLS: pacientes — plantonista só com escala agora (ou acesso pago) ────────
DROP POLICY IF EXISTS "pacientes_select" ON public.pacientes;
CREATE POLICY "pacientes_select" ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR private.tem_acesso_atendimento(unidade_id)
    OR (
      setor_id IS NOT NULL
      AND setor_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "pacientes_insert" ON public.pacientes;
CREATE POLICY "pacientes_insert" ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  );

-- ── RLS: prescricoes — autor plantonista precisa estar na escala agora ───────
DROP POLICY IF EXISTS "prescricoes_select" ON public.prescricoes;
CREATE POLICY "prescricoes_select" ON public.prescricoes
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      medico_id = private.meu_perfil_id()
      AND private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  );

DROP POLICY IF EXISTS "prescricoes_insert" ON public.prescricoes;
CREATE POLICY "prescricoes_insert" ON public.prescricoes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      medico_id = private.meu_perfil_id()
      AND private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  );

DROP POLICY IF EXISTS "prescricoes_update" ON public.prescricoes;
CREATE POLICY "prescricoes_update" ON public.prescricoes
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      medico_id = private.meu_perfil_id()
      AND private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      medico_id = private.meu_perfil_id()
      AND private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  );

DROP POLICY IF EXISTS "prescricoes_delete" ON public.prescricoes;
CREATE POLICY "prescricoes_delete" ON public.prescricoes
  FOR DELETE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      medico_id = private.meu_perfil_id()
      AND private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  );

-- prescricao_itens: herda o acesso da prescrição
DROP POLICY IF EXISTS "prescricao_itens_select" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_select" ON public.prescricao_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (
            p.medico_id = private.meu_perfil_id()
            AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
            AND (private.na_escala_agora(p.unidade_id) OR private.tem_acesso_atendimento(p.unidade_id))
          )
        )
    )
  );

DROP POLICY IF EXISTS "prescricao_itens_insert" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_insert" ON public.prescricao_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (
            p.medico_id = private.meu_perfil_id()
            AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
            AND (private.na_escala_agora(p.unidade_id) OR private.tem_acesso_atendimento(p.unidade_id))
          )
        )
    )
  );

DROP POLICY IF EXISTS "prescricao_itens_update" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_update" ON public.prescricao_itens
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (
            p.medico_id = private.meu_perfil_id()
            AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
            AND (private.na_escala_agora(p.unidade_id) OR private.tem_acesso_atendimento(p.unidade_id))
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (
            p.medico_id = private.meu_perfil_id()
            AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
            AND (private.na_escala_agora(p.unidade_id) OR private.tem_acesso_atendimento(p.unidade_id))
          )
        )
    )
  );

DROP POLICY IF EXISTS "prescricao_itens_delete" ON public.prescricao_itens;
CREATE POLICY "prescricao_itens_delete" ON public.prescricao_itens
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes p
      WHERE p.id = prescricao_itens.prescricao_id
        AND (
          private.eh_super_admin()
          OR private.papel_na_unidade(p.unidade_id) = 'gestor'
          OR (
            p.medico_id = private.meu_perfil_id()
            AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
            AND (private.na_escala_agora(p.unidade_id) OR private.tem_acesso_atendimento(p.unidade_id))
          )
        )
    )
  );

-- assinaturas: o médico autor também precisa estar na escala/atendimento
DROP POLICY IF EXISTS "assinaturas_insert" ON public.assinaturas;
CREATE POLICY "assinaturas_insert" ON public.assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR (
      medico_id = private.meu_perfil_id()
      AND EXISTS (
        SELECT 1 FROM public.prescricoes p
        WHERE p.id = assinaturas.prescricao_id
          AND private.papel_na_unidade(p.unidade_id) = 'plantonista'
          AND (private.na_escala_agora(p.unidade_id) OR private.tem_acesso_atendimento(p.unidade_id))
      )
    )
  );

-- ── Seed: 5 setores de plantão da UPA + escala de hoje p/ plantonista de teste ─
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'Porta Clínica Médica', 'emergencia', 3),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000101', 'Porta Pediatria', 'emergencia', 4),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000101', 'Enfermaria Clínica Médica', 'internacao', 5),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000101', 'Enfermaria Pediatria', 'internacao', 6),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000101', 'Sala Vermelha/Semi-Crítica', 'observacao', 7)
ON CONFLICT (id) DO NOTHING;

-- Plantonista de teste entra na escala HOJE (dia/turno do servidor) em todos os setores
INSERT INTO public.escala_plantoes (unidade_id, setor_id, perfil_id, data, turno, criado_por)
SELECT '00000000-0000-0000-0000-000000000101', s.id, p.id, private.data_atual(), private.turno_atual(),
       (SELECT id FROM public.perfis WHERE email = 'super@teste.com')
FROM (VALUES
  ('00000000-0000-0000-0000-000000000301'::uuid),
  ('00000000-0000-0000-0000-000000000302'::uuid),
  ('00000000-0000-0000-0000-000000000303'::uuid),
  ('00000000-0000-0000-0000-000000000304'::uuid),
  ('00000000-0000-0000-0000-000000000305'::uuid)
) AS v(id)
JOIN public.setores s ON s.id = v.id
CROSS JOIN public.perfis p
WHERE p.email = 'plantonista@teste.com'
ON CONFLICT DO NOTHING;
