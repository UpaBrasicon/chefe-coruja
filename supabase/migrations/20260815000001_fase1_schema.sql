-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — Plataforma de Gestão Hospitalar
-- Schema base: organizações, unidades, perfis, vínculos, setores, leitos,
-- log de auditoria e super admins.
-- Nome da tabela/coluna: português, snake_case. RLS habilitado em tudo.
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensões usadas pelas migrations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schema privado para funções auxiliares (não exposto via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_unidade') THEN
    CREATE TYPE public.tipo_unidade AS ENUM ('hospital', 'upa', 'clinica');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'papel') THEN
    CREATE TYPE public.papel AS ENUM ('admin', 'gestor', 'plantonista');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_setor') THEN
    CREATE TYPE public.tipo_setor AS ENUM ('emergencia', 'observacao', 'internacao', 'isolamento', 'uti', 'outro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_leito') THEN
    CREATE TYPE public.tipo_leito AS ENUM ('clinico', 'isolamento', 'estabilizacao', 'observacao');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_leito') THEN
    CREATE TYPE public.status_leito AS ENUM ('livre', 'ocupado', 'bloqueado', 'higienizacao');
  END IF;
END $$;

-- ── organizacoes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  cnpj        text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizacoes_cnpj_idx ON public.organizacoes (cnpj) WHERE cnpj IS NOT NULL;

-- ── unidades ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  tipo            public.tipo_unidade NOT NULL,
  cnes            text,
  municipio       text,
  uf              text,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unidades_organizacao_idx ON public.unidades (organizacao_id);

-- ── perfis (1:1 com auth.users) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perfis (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo  text NOT NULL,
  cpf            text,
  crm            text,
  uf_crm         text,
  telefone       text,
  email          text,
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS perfis_email_idx ON public.perfis (email);

-- ── vinculos (papel POR UNIDADE) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vinculos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  papel       public.papel NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  criado_por  uuid REFERENCES public.perfis(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, unidade_id, papel)
);

CREATE INDEX IF NOT EXISTS vinculos_perfil_idx  ON public.vinculos (perfil_id, ativo);
CREATE INDEX IF NOT EXISTS vinculos_unidade_idx ON public.vinculos (unidade_id);

-- ── setores ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  tipo        public.tipo_setor NOT NULL,
  ordem       integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS setores_unidade_idx ON public.setores (unidade_id, ordem);

-- ── leitos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leitos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id        uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  identificador   text NOT NULL,
  tipo            public.tipo_leito NOT NULL DEFAULT 'clinico',
  status          public.status_leito NOT NULL DEFAULT 'livre',
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setor_id, identificador)
);

CREATE INDEX IF NOT EXISTS leitos_setor_idx ON public.leitos (setor_id, status);

-- ── log_auditoria (append-only) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.log_auditoria (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id      uuid REFERENCES public.perfis(id),
  acao         text NOT NULL,
  entidade     text NOT NULL,
  entidade_id  uuid,
  unidade_id   uuid REFERENCES public.unidades(id),
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS log_auditoria_unidade_idx ON public.log_auditoria (unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS log_auditoria_entidade_idx ON public.log_auditoria (entidade, entidade_id);

-- ── super_admins ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.super_admins (
  perfil_id   uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger: updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizacoes_updated_at ON public.organizacoes;
CREATE TRIGGER trg_organizacoes_updated_at
  BEFORE UPDATE ON public.organizacoes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_unidades_updated_at ON public.unidades;
CREATE TRIGGER trg_unidades_updated_at
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_perfis_updated_at ON public.perfis;
CREATE TRIGGER trg_perfis_updated_at
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_vinculos_updated_at ON public.vinculos;
CREATE TRIGGER trg_vinculos_updated_at
  BEFORE UPDATE ON public.vinculos
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_setores_updated_at ON public.setores;
CREATE TRIGGER trg_setores_updated_at
  BEFORE UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS trg_leitos_updated_at ON public.leitos;
CREATE TRIGGER trg_leitos_updated_at
  BEFORE UPDATE ON public.leitos
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ── Trigger: perfil criado junto com auth.users ──────────────────────────────
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE OR REPLACE FUNCTION private.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.perfis SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_user_email_update();
