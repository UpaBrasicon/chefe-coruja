-- ════════════════════════════════════════════════════════════════════════════
-- Preferências de prescrição — os FAVORITOS pessoais do plantonista (protótipo,
-- D6 de 24/08: "o um clique tem duas fontes: o protocolo da instituição, que o
-- gestor publica e versiona, e o favorito pessoal, que cada plantonista edita").
--
-- • A lista é de quem a fez: cada pessoa lê, grava e apaga só as próprias
--   linhas. O gestor não vê e não edita (nem o super-admin: não é prontuário,
--   é preferência de trabalho).
-- • O favorito aponta para o medicamento do CADASTRO (public.medicamento),
--   como a prescrição estruturada; dose, via, posologia e quantidade são
--   escritas pelo médico — o sistema não sugere dose.
-- • A classe alergênica é opcional e só informa: um favorito nunca contorna a
--   alergia. Quem trava o item é a prescrição, pela alergia registrada.
-- • Mesmo medicamento com a mesma posologia não entra duas vezes para a
--   mesma pessoa.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.preferencias_prescricao (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- dono da linha: por padrão, quem está logado
  perfil_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES public.perfis(id) ON DELETE CASCADE,
  medicamento_id    uuid NOT NULL REFERENCES public.medicamento(id),
  dose              text CHECK (dose IS NULL OR length(dose) <= 80),
  via               text CHECK (via IS NULL OR length(via) <= 40),
  posologia         text NOT NULL CHECK (length(btrim(posologia)) BETWEEN 3 AND 200),
  quantidade        text CHECK (quantidade IS NULL OR length(quantidade) <= 80),
  classe_alergenica text CHECK (classe_alergenica IS NULL OR length(btrim(classe_alergenica)) BETWEEN 2 AND 60),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.preferencias_prescricao IS
  'Favoritos de prescrição de cada pessoa. Só o dono lê e grava (RLS). O gestor não vê.';
COMMENT ON COLUMN public.preferencias_prescricao.classe_alergenica IS
  'Classe alergênica informativa (ex.: Sulfa, Penicilina). Não libera nada: a alergia registrada do paciente continua travando o item.';

-- sem repetir o mesmo medicamento com a mesma posologia
CREATE UNIQUE INDEX IF NOT EXISTS preferencias_prescricao_sem_repetir
  ON public.preferencias_prescricao (perfil_id, medicamento_id, lower(btrim(posologia)));
CREATE INDEX IF NOT EXISTS preferencias_prescricao_perfil
  ON public.preferencias_prescricao (perfil_id, created_at);

DROP TRIGGER IF EXISTS trg_preferencias_prescricao_updated_at ON public.preferencias_prescricao;
CREATE TRIGGER trg_preferencias_prescricao_updated_at BEFORE UPDATE ON public.preferencias_prescricao
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── RLS: cada um com o que é seu ────────────────────────────────────────────
ALTER TABLE public.preferencias_prescricao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preferencias_prescricao FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_prescricao TO authenticated;

DROP POLICY IF EXISTS preferencias_prescricao_select ON public.preferencias_prescricao;
CREATE POLICY preferencias_prescricao_select ON public.preferencias_prescricao
  FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());

DROP POLICY IF EXISTS preferencias_prescricao_insert ON public.preferencias_prescricao;
CREATE POLICY preferencias_prescricao_insert ON public.preferencias_prescricao
  FOR INSERT TO authenticated
  WITH CHECK (perfil_id = private.meu_perfil_id());

-- o dono pode corrigir a linha, mas não passá-la para outra pessoa
DROP POLICY IF EXISTS preferencias_prescricao_update ON public.preferencias_prescricao;
CREATE POLICY preferencias_prescricao_update ON public.preferencias_prescricao
  FOR UPDATE TO authenticated
  USING (perfil_id = private.meu_perfil_id())
  WITH CHECK (perfil_id = private.meu_perfil_id());

DROP POLICY IF EXISTS preferencias_prescricao_delete ON public.preferencias_prescricao;
CREATE POLICY preferencias_prescricao_delete ON public.preferencias_prescricao
  FOR DELETE TO authenticated
  USING (perfil_id = private.meu_perfil_id());
