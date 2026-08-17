-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1/3 — Tabela canônica de medicamento + tabela de diluição
-- Chave canônica: rxcui (RxNorm) + registro ANVISA. OBM/RNDS integração futura.
-- Regras: nenhum valor de diluição sem fonte; nada publicado sem revisor_crf.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── medicamento (canônico) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicamento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principio_ativo    text NOT NULL,
  principio_ativo_norm text NOT NULL,
  apresentacao       text,
  concentracao       text,
  setor_uso          text,
  rxcui              text,
  anvisa_registro    text,
  anvisa_produto     text,
  anvisa_situacao    text,
  anvisa_empresa     text,
  obm_id             text,           -- Ontologia Brasileira de Medicamentos (futuro)
  obm_ampp           text,           -- identificador AMPP (RNDS) (futuro)
  alta_vigilancia    boolean NOT NULL DEFAULT false,
  ativo              boolean NOT NULL DEFAULT true,
  fonte              text NOT NULL DEFAULT 'ETL_FASE1',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (principio_ativo_norm, apresentacao)
);

CREATE INDEX IF NOT EXISTS idx_medicamento_rxcui ON public.medicamento (rxcui);
CREATE INDEX IF NOT EXISTS idx_medicamento_pa ON public.medicamento (principio_ativo_norm);
CREATE INDEX IF NOT EXISTS idx_medicamento_anvisa ON public.medicamento (anvisa_registro);

-- ── diluicao (núcleo da Fase 3) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diluicao (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id            uuid REFERENCES public.medicamento(id),
  principio_ativo           text NOT NULL,
  apresentacao              text NOT NULL,
  via                       text NOT NULL,          -- EV, IM, SC, IN, VO
  reconstituicao_diluente   text,                   -- AD, SF0.9, diluente próprio
  reconstituicao_volume_ml  numeric,
  reconstituicao_concentracao text,
  diluicao_solucao          text[],                 -- {SF0.9, SG5, RL, AD}
  diluicao_volume_min_ml    numeric,
  concentracao_maxima       text,
  tempo_infusao_min         integer,
  velocidade_max            text,
  bolus_permitido           boolean,
  estabilidade_ta_h         numeric,
  estabilidade_refrig_h     numeric,
  fotossensivel             boolean,
  acesso                    text,                   -- periferico | central
  ajuste_renal              boolean,
  ajuste_renal_regra        text,
  incompatibilidades        text[],
  alta_vigilancia           boolean DEFAULT false,  -- ISMP
  observacoes               text,
  fonte                     text NOT NULL,
  data_revisao              date,
  revisor_crf               text,
  status                    text NOT NULL DEFAULT 'rascunho',  -- rascunho|revisado|publicado
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diluicao_med ON public.diluicao (medicamento_id);
CREATE INDEX IF NOT EXISTS idx_diluicao_status ON public.diluicao (status);

-- RLS: leitura ampla para autenticados (identificação/diluição publicadas),
-- escrita apenas super (curadoria via ETL/script com papel de farmacêutico).
ALTER TABLE public.medicamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diluicao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicamento_select" ON public.medicamento;
CREATE POLICY "medicamento_select" ON public.medicamento
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "medicamento_write" ON public.medicamento;
CREATE POLICY "medicamento_write" ON public.medicamento
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());

DROP POLICY IF EXISTS "medicamento_update" ON public.medicamento;
CREATE POLICY "medicamento_update" ON public.medicamento
  FOR UPDATE TO authenticated
  USING (private.eh_super_admin());

DROP POLICY IF EXISTS "diluicao_select_publicado" ON public.diluicao;
CREATE POLICY "diluicao_select_publicado" ON public.diluicao
  FOR SELECT TO authenticated
  USING (status = 'publicado' OR private.eh_super_admin());

DROP POLICY IF EXISTS "diluicao_insert" ON public.diluicao;
CREATE POLICY "diluicao_insert" ON public.diluicao
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());

DROP POLICY IF EXISTS "diluicao_update" ON public.diluicao;
CREATE POLICY "diluicao_update" ON public.diluicao
  FOR UPDATE TO authenticated
  USING (private.eh_super_admin());

-- RPC: diluição de um medicamento, somente registros publicados
CREATE OR REPLACE FUNCTION public.diluicao_publicada(p_medicamento uuid)
RETURNS SETOF public.diluicao AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.diluicao
    WHERE medicamento_id = p_medicamento AND status = 'publicado'
    ORDER BY via;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers de updated_at
DROP TRIGGER IF EXISTS trg_medicamento_updated_at ON public.medicamento;
CREATE TRIGGER trg_medicamento_updated_at BEFORE UPDATE ON public.medicamento
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_diluicao_updated_at ON public.diluicao;
CREATE TRIGGER trg_diluicao_updated_at BEFORE UPDATE ON public.diluicao
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
