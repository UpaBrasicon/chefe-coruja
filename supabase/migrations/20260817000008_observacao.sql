-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2 — Modelo de observação clínica (padrão OpenMRS/FHIR Observation)
--
-- Conceito + Observação: dados clínicos (sinais vitais, laboratório, escores)
-- viram linhas em `observacao` referenciando um `conceito` — sem migration a
-- cada exame novo. Aditivo: NÃO toca nas tabelas antigas (documentos_clinicos,
-- rascunhos) — o corte vem em fase posterior.
--
-- Multi-tenancy: o projeto usa `unidade_id` como tenant (padrão do schema);
-- aqui a coluna de tenant se chama `unidade_id` (equivalente ao tenant_id da
-- especificação). `conceito` com unidade_id NULL = conceito global.
-- ─────────────────────────────────────────────────────────────────────────────

-- ===========================================================================
-- 1. conceito
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.conceito (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid REFERENCES public.unidades(id) ON DELETE CASCADE, -- NULL = global
  nome           text NOT NULL,
  tipo           text NOT NULL DEFAULT 'numerico'
                 CHECK (tipo IN ('numerico','texto','categorico','escore')),
  unidade_padrao text,
  loinc_codigo   text REFERENCES terminologia.loinc(codigo) ON DELETE SET NULL,
  ref_min        numeric,
  ref_max        numeric,
  ativo          boolean NOT NULL DEFAULT true,
  ordem_exibicao integer NOT NULL DEFAULT 0,
  categoria      text NOT NULL DEFAULT 'outro'
                 CHECK (categoria IN ('sinal_vital','laboratorio','escore','imagem','outro')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- mesmo nome+unidade: global OU da unidade (não os dois ao mesmo tempo)
  UNIQUE (unidade_id, nome)
);
CREATE INDEX IF NOT EXISTS conceito_loinc_idx ON public.conceito (loinc_codigo);
CREATE INDEX IF NOT EXISTS conceito_categoria_idx ON public.conceito (categoria, ordem_exibicao);

DROP TRIGGER IF EXISTS trg_conceito_updated_at ON public.conceito;
CREATE TRIGGER trg_conceito_updated_at BEFORE UPDATE ON public.conceito
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ===========================================================================
-- 2. conceito_opcao (categóricos: sexo do resultado, escalas tipo "ausente/1+/2+")
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.conceito_opcao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_id uuid NOT NULL REFERENCES public.conceito(id) ON DELETE CASCADE,
  rotulo      text NOT NULL,
  valor       text,
  ordem       integer NOT NULL DEFAULT 0,
  UNIQUE (conceito_id, rotulo)
);
CREATE INDEX IF NOT EXISTS conceito_opcao_conceito_idx ON public.conceito_opcao (conceito_id, ordem);

-- ===========================================================================
-- 3. observacao
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.observacao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  internacao_id    uuid REFERENCES public.internacoes(id) ON DELETE CASCADE,
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  conceito_id      uuid NOT NULL REFERENCES public.conceito(id) ON DELETE RESTRICT,
  aferido_em       timestamptz NOT NULL DEFAULT now(),
  registrado_por   uuid REFERENCES public.perfis(id),
  valor_num        numeric,
  valor_texto      text,
  valor_conceito_id uuid REFERENCES public.conceito_opcao(id) ON DELETE SET NULL,
  unidade          text,
  ref_min          numeric,
  ref_max          numeric,
  flag             text NOT NULL DEFAULT 'N'
                   CHECK (flag IN ('L','N','H','CRIT')),
  origem           text NOT NULL DEFAULT 'manual'
                   CHECK (origem IN ('manual','lis','dispositivo','calculado')),
  observacao_pai_id uuid REFERENCES public.observacao(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índice principal da série temporal
CREATE INDEX IF NOT EXISTS obs_serie_idx ON public.observacao
  (internacao_id, conceito_id, aferido_em DESC);
CREATE INDEX IF NOT EXISTS obs_paciente_idx ON public.observacao (paciente_id, aferido_em DESC);
CREATE INDEX IF NOT EXISTS obs_pai_idx ON public.observacao (observacao_pai_id);

-- ===========================================================================
-- 4. Integridade: exatamente um valor + flag calculada no banco (L/N/H/CRIT)
-- ===========================================================================
CREATE OR REPLACE FUNCTION private.validar_observacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tipo      text;
  v_unidade   uuid;
  v_opcoes    bigint;
  v_ref_min   numeric;
  v_ref_max   numeric;
BEGIN
  -- exatamente um dos três campos de valor deve estar preenchido
  IF (NEW.valor_num IS NOT NULL)::int
   + (NEW.valor_texto IS NOT NULL)::int
   + (NEW.valor_conceito_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'observacao: preencher exatamente um de valor_num/valor_texto/valor_conceito_id';
  END IF;

  SELECT c.tipo, c.unidade_id, c.ref_min, c.ref_max
    INTO v_tipo, v_unidade, v_ref_min, v_ref_max
  FROM public.conceito c WHERE c.id = NEW.conceito_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % não existe', NEW.conceito_id;
  END IF;

  -- coerência com o tipo do conceito
  IF v_tipo IN ('numerico','escore') AND NEW.valor_num IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % exige valor_num', NEW.conceito_id;
  END IF;
  IF v_tipo = 'texto' AND NEW.valor_texto IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % exige valor_texto', NEW.conceito_id;
  END IF;
  IF v_tipo = 'categorico' AND NEW.valor_conceito_id IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % exige valor_conceito_id', NEW.conceito_id;
  END IF;

  -- a opção categórica deve pertencer ao próprio conceito
  IF NEW.valor_conceito_id IS NOT NULL THEN
    SELECT count(*) INTO v_opcoes
    FROM public.conceito_opcao o
    WHERE o.id = NEW.valor_conceito_id AND o.conceito_id = NEW.conceito_id;
    IF v_opcoes = 0 THEN
      RAISE EXCEPTION 'observacao: opção % não pertence ao conceito %', NEW.valor_conceito_id, NEW.conceito_id;
    END IF;
  END IF;

  -- unidade_id deve bater com a do conceito local (ou conceito global ok)
  IF v_unidade IS NOT NULL AND NEW.unidade_id IS DISTINCT FROM v_unidade THEN
    RAISE EXCEPTION 'observacao: conceito pertence a outra unidade';
  END IF;

  -- flag calculada NO BANCO: usa ref do conceito como fallback quando a
  -- observação não carrega ref própria; CRIT = fora de 1,5x o limite
  IF NEW.ref_min IS NULL THEN NEW.ref_min := v_ref_min; END IF;
  IF NEW.ref_max IS NULL THEN NEW.ref_max := v_ref_max; END IF;

  IF NEW.valor_num IS NULL OR (NEW.ref_min IS NULL AND NEW.ref_max IS NULL) THEN
    NEW.flag := 'N';
  ELSIF NEW.ref_max IS NOT NULL AND NEW.valor_num > NEW.ref_max * 1.5 THEN
    NEW.flag := 'CRIT';
  ELSIF NEW.ref_min IS NOT NULL AND NEW.valor_num > 0 AND NEW.valor_num < NEW.ref_min * 0.5 THEN
    NEW.flag := 'CRIT';
  ELSIF NEW.ref_max IS NOT NULL AND NEW.valor_num > NEW.ref_max THEN
    NEW.flag := 'H';
  ELSIF NEW.ref_min IS NOT NULL AND NEW.valor_num < NEW.ref_min THEN
    NEW.flag := 'L';
  ELSE
    NEW.flag := 'N';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_observacao_validar ON public.observacao;
CREATE TRIGGER trg_observacao_validar
  BEFORE INSERT OR UPDATE ON public.observacao
  FOR EACH ROW EXECUTE FUNCTION private.validar_observacao();

-- ===========================================================================
-- 5. RLS por tenant (unidade)
-- Regra do projeto: admin nunca lê dado clínico; plantonista só na escala;
-- gestor vê a unidade. Observação é dado clínico → admin NÃO lê.
-- ===========================================================================
ALTER TABLE public.conceito        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conceito_opcao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observacao      ENABLE ROW LEVEL SECURITY;

-- conceito: globais + da unidade; leitura p/ quem atende a unidade
DROP POLICY IF EXISTS "conceito_select" ON public.conceito;
CREATE POLICY "conceito_select" ON public.conceito
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR unidade_id IS NULL -- global
    OR unidade_id IN (SELECT private.unidades_gestor_plantonista())
  );
-- escrita: gestor da unidade (cria conceitos locais) ou super (globais)
DROP POLICY IF EXISTS "conceito_insert" ON public.conceito;
CREATE POLICY "conceito_insert" ON public.conceito
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR (unidade_id IS NOT NULL AND private.papel_na_unidade(unidade_id) = 'gestor')
  );
DROP POLICY IF EXISTS "conceito_update" ON public.conceito;
CREATE POLICY "conceito_update" ON public.conceito
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR (unidade_id IS NOT NULL AND private.papel_na_unidade(unidade_id) = 'gestor')
  )
  WITH CHECK (
    private.eh_super_admin()
    OR (unidade_id IS NOT NULL AND private.papel_na_unidade(unidade_id) = 'gestor')
  );

-- conceito_opcao: herda do conceito
DROP POLICY IF EXISTS "conceito_opcao_select" ON public.conceito_opcao;
CREATE POLICY "conceito_opcao_select" ON public.conceito_opcao
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.conceito c
      WHERE c.id = conceito_opcao.conceito_id
        AND (c.unidade_id IS NULL OR c.unidade_id IN (SELECT private.unidades_gestor_plantonista()))
    )
  );
DROP POLICY IF EXISTS "conceito_opcao_insert" ON public.conceito_opcao;
CREATE POLICY "conceito_opcao_insert" ON public.conceito_opcao
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.conceito c
      WHERE c.id = conceito_opcao.conceito_id
        AND c.unidade_id IS NOT NULL
        AND private.papel_na_unidade(c.unidade_id) = 'gestor'
    )
  );
DROP POLICY IF EXISTS "conceito_opcao_update" ON public.conceito_opcao;
CREATE POLICY "conceito_opcao_update" ON public.conceito_opcao
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.conceito c
      WHERE c.id = conceito_opcao.conceito_id
        AND c.unidade_id IS NOT NULL
        AND private.papel_na_unidade(c.unidade_id) = 'gestor'
    )
  );

-- observacao: dado clínico — admin NÃO lê. Plantonista na escala/atendimento
-- da unidade; gestor da unidade; super.
DROP POLICY IF EXISTS "observacao_select" ON public.observacao;
CREATE POLICY "observacao_select" ON public.observacao
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR private.tem_acesso_atendimento(unidade_id)
    OR (
      EXISTS (
        SELECT 1 FROM public.internacoes i
        WHERE i.id = observacao.internacao_id
          AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
      )
    )
  );

DROP POLICY IF EXISTS "observacao_insert" ON public.observacao;
CREATE POLICY "observacao_insert" ON public.observacao
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (
      private.papel_na_unidade(unidade_id) = 'plantonista'
      AND (private.na_escala_agora(unidade_id) OR private.tem_acesso_atendimento(unidade_id))
    )
  );

DROP POLICY IF EXISTS "observacao_update" ON public.observacao;
CREATE POLICY "observacao_update" ON public.observacao
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (registrado_por = private.meu_perfil_id() AND aferido_em > now() - interval '24 hours')
  )
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- Sem DELETE por policy: retificação via UPDATE (append-only em essência).

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.conceito, public.conceito_opcao, public.observacao TO authenticated;

-- ===========================================================================
-- DOWN — reverter manualmente (se necessário):
--   DROP TRIGGER trg_observacao_validar ON public.observacao;
--   DROP FUNCTION private.validar_observacao();
--   DROP TABLE public.observacao;
--   DROP TABLE public.conceito_opcao;
--   DROP TABLE public.conceito;
-- ===========================================================================
