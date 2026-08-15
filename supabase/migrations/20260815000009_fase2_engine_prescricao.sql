-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2 — Fundação do Motor de Prescrição Digital
-- Inspirado em prescreve.com: prescrição digital, assinatura ICP-Brasil,
-- VIDaaS, validador de assinatura, portal do paciente, WhatsApp, retenção em
-- farmácia, base de medicamentos e deep links.
--
-- REGRA DE OURO preservada: admin NUNCA lê identidade de paciente — apenas
-- agregados (vw_indicadores_unidade). Plantonista vê só pacientes sob seu
-- cuidado (cuidados_plantonistas).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── medicamentos (base de medicamentos — referência global) ──────────────────
CREATE TABLE IF NOT EXISTS public.medicamentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL,
  principio_ativo  text NOT NULL,
  concentracao     text,
  forma_farmaceutica text,
  apresentacao     text,
  via              text,
  unidade          text,
  tipo_receituario text NOT NULL DEFAULT 'branca',
  controlado       boolean NOT NULL DEFAULT false,
  codigo_anvisa    text,
  codigo_barras    text,
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medicamentos_nome_idx ON public.medicamentos (principio_ativo);
CREATE INDEX IF NOT EXISTS medicamentos_barras_idx ON public.medicamentos (codigo_barras);

-- ── pacientes (identidade — restrito) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  data_nascimento date,
  sexo            text,
  cpf             text,
  telefone        text,
  prontuario      text,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pacientes_unidade_idx ON public.pacientes (unidade_id);
CREATE INDEX IF NOT EXISTS pacientes_cpf_idx ON public.pacientes (cpf) WHERE cpf IS NOT NULL;

-- ── cuidados_plantonistas (quem está sob cuidado de quem) ───────────────────
CREATE TABLE IF NOT EXISTS public.cuidados_plantonistas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS cuidados_perfil_idx ON public.cuidados_plantonistas (perfil_id, ativo);

-- ── prescricoes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescricoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  medico_id     uuid NOT NULL REFERENCES public.perfis(id),
  status        text NOT NULL DEFAULT 'rascunho',
  observacoes   text,
  valida_ate    timestamptz,
  assinada_em   timestamptz,
  criada_por    uuid REFERENCES public.perfis(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prescricoes_paciente_idx ON public.prescricoes (paciente_id);
CREATE INDEX IF NOT EXISTS prescricoes_medico_idx ON public.prescricoes (medico_id, created_at DESC);

-- ── prescricao_itens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescricao_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id   uuid NOT NULL REFERENCES public.prescricoes(id) ON DELETE CASCADE,
  medicamento_id  uuid REFERENCES public.medicamentos(id),
  descricao       text NOT NULL,
  dose            text,
  posologia       text,
  duracao         text,
  observacao      text,
  ordem           integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prescricao_itens_presc_idx ON public.prescricao_itens (prescricao_id, ordem);

-- ── assinaturas (ICP-Brasil / VIDaaS) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id     uuid NOT NULL REFERENCES public.prescricoes(id) ON DELETE CASCADE,
  medico_id         uuid NOT NULL REFERENCES public.perfis(id),
  certificado_serial text,
  certificado_cpf   text,
  hash_conteudo     text NOT NULL,
  algoritmo         text NOT NULL DEFAULT 'SHA-256',
  id_assinatura_icp text,
  status            text NOT NULL DEFAULT 'pendente',
  validado_em       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prescricao_id, medico_id)
);
CREATE INDEX IF NOT EXISTS assinaturas_presc_idx ON public.assinaturas (prescricao_id);

-- ── receitas_retidas (retenção em farmácia — registro legal, append-only) ───
CREATE TABLE IF NOT EXISTS public.receitas_retidas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id   uuid NOT NULL REFERENCES public.prescricoes(id) ON DELETE CASCADE,
  codigo_retencao text NOT NULL,
  farmacia_nome   text,
  farmacia_cnpj   text,
  farmaceutico_nome text,
  data_retencao   timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receitas_retidas_presc_idx ON public.receitas_retidas (prescricao_id);

-- ── notificacoes_whatsapp (log de envio) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificacoes_whatsapp (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id     uuid REFERENCES public.prescricoes(id) ON DELETE CASCADE,
  destinatario_nome text,
  telefone          text NOT NULL,
  template          text,
  payload           jsonb,
  status            text NOT NULL DEFAULT 'pendente',
  id_provedor       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_whats_status_idx ON public.notificacoes_whatsapp (status, created_at);

-- ── configuracoes_unidade (config não-secreta) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.configuracoes_unidade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  chave       text NOT NULL,
  valor       text,
  descricao   text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, chave)
);
CREATE INDEX IF NOT EXISTS config_unidade_idx ON public.configuracoes_unidade (unidade_id);

-- ── links_publicos_receita (deep links de emissão/consulta) ─────────────────
CREATE TABLE IF NOT EXISTS public.links_publicos_receita (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id uuid NOT NULL REFERENCES public.prescricoes(id) ON DELETE CASCADE,
  tipo          text NOT NULL,
  token         text NOT NULL UNIQUE,
  valida_ate    timestamptz,
  criado_por    uuid REFERENCES public.perfis(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS links_receita_token_idx ON public.links_publicos_receita (token);

-- ── Triggers updated_at ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_medicamentos_updated_at ON public.medicamentos;
CREATE TRIGGER trg_medicamentos_updated_at BEFORE UPDATE ON public.medicamentos
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
DROP TRIGGER IF EXISTS trg_pacientes_updated_at ON public.pacientes;
CREATE TRIGGER trg_pacientes_updated_at BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
DROP TRIGGER IF EXISTS trg_prescricoes_updated_at ON public.prescricoes;
CREATE TRIGGER trg_prescricoes_updated_at BEFORE UPDATE ON public.prescricoes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
DROP TRIGGER IF EXISTS trg_notif_whats_updated_at ON public.notificacoes_whatsapp;
CREATE TRIGGER trg_notif_whats_updated_at BEFORE UPDATE ON public.notificacoes_whatsapp
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
DROP TRIGGER IF EXISTS trg_config_unidade_updated_at ON public.configuracoes_unidade;
CREATE TRIGGER trg_config_unidade_updated_at BEFORE UPDATE ON public.configuracoes_unidade
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── Storage: bucket privado para PDFs de receitas assinadas ─────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('receitas', 'receitas', false)
ON CONFLICT (id) DO NOTHING;
