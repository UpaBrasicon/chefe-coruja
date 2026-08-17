-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 ADT — Eventos ADT + auditoria + censo + documentos + sugestões
-- Refatoração do módulo de internação (Arquitetura ADT).
-- Base normativa: SBIS/CFM NGS1, Res. CFM 1.821/2007, Lei 13.787/2018, LGPD.
-- Princípios: evento imutável para cada transição; leito como recurso;
-- retificação (nunca apagamento); log de acesso a prontuário; RLS por tenant.
-- ─────────────────────────────────────────────────────────────────────────────

-- ===========================================================================
-- 1. EPISÓDIO DE INTERNAÇÃO
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.internacoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id     uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id),
  tipo_internacao    text NOT NULL DEFAULT 'urgencia'
                     CHECK (tipo_internacao IN ('eletiva','urgencia','emergencia','observacao')),
  origem_admissao    text NOT NULL DEFAULT 'emergencia'
                     CHECK (origem_admissao IN ('emergencia','ambulatorio','outra_unidade','domicilio')),
  status             text NOT NULL DEFAULT 'admitido'
                     CHECK (status IN ('admitido','em_observacao','internado','alta_melhorada',
                                       'alta_pedido','alta_evasao','transferencia_externa','obito')),
  leito_atual_id     uuid REFERENCES public.leitos(id),
  setor_atual_id     uuid REFERENCES public.setores(id),
  data_admissao      timestamptz NOT NULL DEFAULT now(),
  data_entrada_setor timestamptz,
  data_alta          timestamptz,
  cid_principal      text,
  motivo_alta        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internacoes_unidade ON public.internacoes (unidade_id, status);
CREATE INDEX IF NOT EXISTS idx_internacoes_paciente ON public.internacoes (paciente_id);
CREATE INDEX IF NOT EXISTS idx_internacoes_setor ON public.internacoes (setor_atual_id);

-- 1 episódio ATIVO por paciente por unidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_internacoes_paciente_ativo
  ON public.internacoes (paciente_id)
  WHERE status IN ('admitido','em_observacao','internado');

DROP TRIGGER IF EXISTS trg_internacoes_updated_at ON public.internacoes;
CREATE TRIGGER trg_internacoes_updated_at BEFORE UPDATE ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ===========================================================================
-- 2. STREAM DE EVENTOS ADT (imutável, append-only, cadeia de hash)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.eventos_adt (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq               integer NOT NULL,
  organizacao_id    uuid NOT NULL,
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  internacao_id     uuid NOT NULL REFERENCES public.internacoes(id),
  paciente_id       uuid NOT NULL,
  tipo_evento       text NOT NULL
                    CHECK (tipo_evento IN
                      ('admissao','entrada_observacao','internacao',
                       'transferencia_leito','transferencia_setor',
                       'solicitacao_alta','alta_melhorada','alta_pedido',
                       'alta_evasao','transferencia_externa','obito',
                       'cancelamento_alta','retificacao')),
  estado_antes      jsonb,
  estado_depois     jsonb,
  leito_origem_id   uuid,
  leito_destino_id  uuid,
  setor_origem_id   uuid,
  setor_destino_id  uuid,
  autor_id          uuid NOT NULL REFERENCES public.perfis(id),
  motivo            text,
  payload           jsonb,
  hash_previo       text,
  hash_conteudo     text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (internacao_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_eventos_adt_internacao ON public.eventos_adt (internacao_id, seq);
CREATE INDEX IF NOT EXISTS idx_eventos_adt_unidade      ON public.eventos_adt (unidade_id, created_at);
CREATE INDEX IF NOT EXISTS idx_eventos_adt_paciente     ON public.eventos_adt (paciente_id, created_at);

-- ===========================================================================
-- 3. EVENTOS DO LEITO (recurso desacoplado do paciente)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.eventos_leito (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leito_id       uuid NOT NULL REFERENCES public.leitos(id),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  tipo_evento    text NOT NULL
                 CHECK (tipo_evento IN
                   ('reserva','cancelamento_reserva','ocupacao','liberacao',
                    'higienizacao','higienizacao_concluida','bloqueio','desbloqueio')),
  status_antes   public.status_leito,
  status_depois  public.status_leito,
  internacao_id  uuid REFERENCES public.internacoes(id),
  autor_id       uuid NOT NULL REFERENCES public.perfis(id),
  motivo         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_leito_leito ON public.eventos_leito (leito_id, created_at);
CREATE INDEX IF NOT EXISTS idx_eventos_leito_setor ON public.eventos_leito (unidade_id, created_at);

-- ===========================================================================
-- 4. DOCUMENTOS CLÍNICOS COM VERSIONAMENTO (retificação, nunca apagamento)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.documentos_clinicos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_raiz_id   uuid NOT NULL,
  versao              integer NOT NULL DEFAULT 1,
  organizacao_id      uuid NOT NULL,
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  tipo_documento      text NOT NULL
                      CHECK (tipo_documento IN
                        ('admissao_anamnese','evolucao','prescricao','sumario_alta',
                         'sumario_obito','atestado','termo_consentimento',
                         'boletim_emergencia','partograma')),
  conteudo            text NOT NULL,
  conteudo_hash       text NOT NULL,
  autor_id            uuid NOT NULL REFERENCES public.perfis(id),
  estado              text NOT NULL DEFAULT 'rascunho'
                      CHECK (estado IN ('rascunho','ativo','retificado','assinado','cancelado')),
  retificacao_de      uuid REFERENCES public.documentos_clinicos(id),
  motivo_retificacao  text,
  assinatura_id       uuid,
  assinado_em         timestamptz,
  carimbo_tempo       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_raiz_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_doc_paciente ON public.documentos_clinicos (paciente_id, documento_raiz_id, versao);
CREATE INDEX IF NOT EXISTS idx_doc_internacao ON public.documentos_clinicos (internacao_id);

DROP TRIGGER IF EXISTS trg_documentos_updated_at ON public.documentos_clinicos;
CREATE TRIGGER trg_documentos_updated_at BEFORE UPDATE ON public.documentos_clinicos
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ===========================================================================
-- 5. LOG DE ACESSO A PRONTUÁRIO (NGS1)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.log_acesso_prontuario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL,
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  acessado_por    uuid NOT NULL REFERENCES public.perfis(id),
  papel           text,
  tipo_acesso     text NOT NULL DEFAULT 'leitura_prontuario'
                  CHECK (tipo_acesso IN ('leitura_prontuario','leitura_documento','impressao','exportacao')),
  documento_id    uuid,
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_acesso_pac  ON public.log_acesso_prontuario (paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_acesso_ator ON public.log_acesso_prontuario (acessado_por, created_at DESC);

-- ===========================================================================
-- 6. CENSO MATERIALIZADO (projeção alimentada pelos eventos ADT)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.censo_ocupacao (
  organizacao_id       uuid NOT NULL,
  unidade_id           uuid NOT NULL REFERENCES public.unidades(id),
  setor_id             uuid NOT NULL REFERENCES public.setores(id),
  data                 date NOT NULL,
  turno                text NOT NULL DEFAULT 'diario',
  internados           integer NOT NULL DEFAULT 0,
  leitos_total         integer NOT NULL DEFAULT 0,
  leitos_ocupados      integer NOT NULL DEFAULT 0,
  leitos_livres        integer NOT NULL DEFAULT 0,
  leitos_higienizacao  integer NOT NULL DEFAULT 0,
  leitos_bloqueados    integer NOT NULL DEFAULT 0,
  taxa_ocupacao        numeric,
  permanencia_media_h  numeric,
  giro_leito           numeric,
  snapshot             jsonb,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unidade_id, setor_id, data, turno)
);

CREATE INDEX IF NOT EXISTS idx_censo_unidade ON public.censo_ocupacao (unidade_id, data DESC);

-- ===========================================================================
-- 7. SUGESTÃO DE PRESCRIÇÃO (gestor SUGERE; só médico altera)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.sugestoes_prescricao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL,
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  gestor_id       uuid NOT NULL REFERENCES public.perfis(id),
  descricao       text NOT NULL,
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','aceita','recusada','retirada')),
  decidido_por    uuid REFERENCES public.perfis(id),
  decidido_em     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sugestoes_pac ON public.sugestoes_prescricao (paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_sugestoes_internacao ON public.sugestoes_prescricao (internacao_id, status);

DROP TRIGGER IF EXISTS trg_sugestoes_updated_at ON public.sugestoes_prescricao;
CREATE TRIGGER trg_sugestoes_updated_at BEFORE UPDATE ON public.sugestoes_prescricao
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ===========================================================================
-- 8. RLS — isolamento por unidade/organização
-- Regra: admin nunca lê dado clínico. Plantonista restrito por escala.
-- ===========================================================================
ALTER TABLE public.internacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_adt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_leito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_acesso_prontuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.censo_ocupacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sugestoes_prescricao ENABLE ROW LEVEL SECURITY;

-- ---- internacoes ----
DROP POLICY IF EXISTS "internacoes_select" ON public.internacoes;
CREATE POLICY "internacoes_select" ON public.internacoes
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (setor_atual_id IN (SELECT private.setores_na_escala_agora()))
  );

-- escrita via RPCs SECURITY DEFINER (admissão/transferência/alta)
DROP POLICY IF EXISTS "internacoes_insert" ON public.internacoes;
CREATE POLICY "internacoes_insert" ON public.internacoes
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());

DROP POLICY IF EXISTS "internacoes_update" ON public.internacoes;
CREATE POLICY "internacoes_update" ON public.internacoes
  FOR UPDATE TO authenticated
  USING (private.eh_super_admin());

-- ---- eventos_adt (append-only; leitura para quem vê a internação) ----
DROP POLICY IF EXISTS "eventos_adt_select" ON public.eventos_adt;
CREATE POLICY "eventos_adt_select" ON public.eventos_adt
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.internacoes i
      WHERE i.id = eventos_adt.internacao_id
        AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
    )
  );

-- ---- eventos_leito ----
DROP POLICY IF EXISTS "eventos_leito_select" ON public.eventos_leito;
CREATE POLICY "eventos_leito_select" ON public.eventos_leito
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.setores s
      WHERE s.id = (SELECT l.setor_id FROM public.leitos l WHERE l.id = eventos_leito.leito_id)
        AND s.unidade_id = eventos_leito.unidade_id
        AND s.unidade_id IN (SELECT private.unidades_gestor_plantonista())
    )
  );

-- ---- documentos_clinicos ----
DROP POLICY IF EXISTS "documentos_select" ON public.documentos_clinicos;
CREATE POLICY "documentos_select" ON public.documentos_clinicos
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.internacoes i
      WHERE i.id = documentos_clinicos.internacao_id
        AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "documentos_insert" ON public.documentos_clinicos;
CREATE POLICY "documentos_insert" ON public.documentos_clinicos
  FOR INSERT TO authenticated
  WITH CHECK (private.eh_super_admin());

-- ---- log_acesso_prontuario (nunca apaga; escrita via RPC) ----
DROP POLICY IF EXISTS "log_acesso_select" ON public.log_acesso_prontuario;
CREATE POLICY "log_acesso_select" ON public.log_acesso_prontuario
  FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor');

-- ---- censo_ocupacao ----
DROP POLICY IF EXISTS "censo_select" ON public.censo_ocupacao;
CREATE POLICY "censo_select" ON public.censo_ocupacao
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR unidade_id IN (SELECT private.unidades_gestor_plantonista())
  );

-- ---- sugestoes_prescricao ----
DROP POLICY IF EXISTS "sugestoes_select" ON public.sugestoes_prescricao;
CREATE POLICY "sugestoes_select" ON public.sugestoes_prescricao
  FOR SELECT TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR EXISTS (
      SELECT 1 FROM public.internacoes i
      WHERE i.id = sugestoes_prescricao.internacao_id
        AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
    )
  );

DROP POLICY IF EXISTS "sugestoes_insert" ON public.sugestoes_prescricao;
CREATE POLICY "sugestoes_insert" ON public.sugestoes_prescricao
  FOR INSERT TO authenticated
  WITH CHECK (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "sugestoes_update" ON public.sugestoes_prescricao;
CREATE POLICY "sugestoes_update" ON public.sugestoes_prescricao
  FOR UPDATE TO authenticated
  USING (
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR gestor_id = private.meu_perfil_id()
  );
