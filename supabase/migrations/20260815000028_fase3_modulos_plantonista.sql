-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Módulos do plantonista (migração única 0028)
--
-- Implementa: check-in/check-out geolocalizado, extrato financeiro,
-- troca bilateral de plantões, histórico da escala, fracionamento de plantão,
-- chat/WhatsApp, e notificação de vagas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ===========================================================================
-- 1. Unidades: geolocalização + canal de comunicação
-- ===========================================================================
ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS raio_metros numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS canal_comunicacao text NOT NULL DEFAULT 'chat'
    CHECK (canal_comunicacao IN ('chat', 'whatsapp', 'nenhum')),
  ADD COLUMN IF NOT EXISTS whatsapp_numero text;

-- Setores ganham especialidade (para filtro de vagas)
ALTER TABLE public.setores
  ADD COLUMN IF NOT EXISTS especialidade text;

-- ===========================================================================
-- 2. Presença (check-in / check-out) geolocalizado
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.presenca_plantonista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  escala_plantao_id uuid REFERENCES public.escala_plantao(id) ON DELETE SET NULL,
  perfil_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  data date NOT NULL,
  turno text NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  checkin_em timestamptz,
  checkout_em timestamptz,
  checkin_lat double precision,
  checkin_lng double precision,
  checkout_lat double precision,
  checkout_lng double precision,
  checkin_dentro boolean,
  checkout_dentro boolean,
  observacao text,
  criado_por uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, unidade_id, data, turno)
);

CREATE INDEX IF NOT EXISTS idx_presenca_unidade ON public.presenca_plantonista (unidade_id, data);
CREATE INDEX IF NOT EXISTS idx_presenca_perfil ON public.presenca_plantonista (perfil_id);

DROP TRIGGER IF EXISTS trg_presenca_updated_at ON public.presenca_plantonista;
CREATE TRIGGER trg_presenca_updated_at
  BEFORE UPDATE ON public.presenca_plantonista
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.presenca_plantonista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presenca_select" ON public.presenca_plantonista;
CREATE POLICY "presenca_select" ON public.presenca_plantonista
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- helper: distância haversine (km)
CREATE OR REPLACE FUNCTION private.distancia_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision AS $$
DECLARE r double precision := 6371.0;
BEGIN
  RETURN 2 * r * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
END; $$ LANGUAGE plpgsql IMMUTABLE;

-- Check-in
CREATE OR REPLACE FUNCTION public.registrar_checkin(
  p_unidade uuid,
  p_lat double precision,
  p_lng double precision,
  p_observacao text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_hoje date := public.data_atual();
  v_turno text := public.turno_atual();
  v_escala uuid;
  v_unidade public.unidades%ROWTYPE;
  v_dentro boolean;
  v_reg uuid;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF NOT (public.na_escala_agora(p_unidade) OR public.tem_acesso_atendimento(p_unidade)) THEN
    RAISE EXCEPTION 'Você não está em escala ou não tem acesso de atendimento nesta unidade agora.';
  END IF;

  SELECT id INTO v_escala
    FROM public.escala_plantao
    WHERE perfil_id = v_perfil AND unidade_id = p_unidade
      AND data = v_hoje AND ativo
    ORDER BY created_at DESC LIMIT 1;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  IF v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_dentro := private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) <= (v_unidade.raio_metros / 1000.0);
  END IF;

  INSERT INTO public.presenca_plantonista
    (unidade_id, escala_plantao_id, perfil_id, data, turno,
     checkin_em, checkin_lat, checkin_lng, checkin_dentro, observacao, criado_por)
  VALUES
    (p_unidade, v_escala, v_perfil, v_hoje, v_turno,
     now(), p_lat, p_lng, v_dentro, p_observacao, v_perfil)
  ON CONFLICT (perfil_id, unidade_id, data, turno)
  DO UPDATE SET checkin_em = EXCLUDED.checkin_em,
    checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
    checkin_dentro = EXCLUDED.checkin_dentro, observacao = EXCLUDED.observacao
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check-out
CREATE OR REPLACE FUNCTION public.registrar_checkout(
  p_registro uuid,
  p_lat double precision,
  p_lng double precision
) RETURNS void AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade public.unidades%ROWTYPE;
  v_reg public.presenca_plantonista%ROWTYPE;
  v_dentro boolean;
BEGIN
  SELECT * INTO v_reg FROM public.presenca_plantonista WHERE id = p_registro;
  IF v_reg.id IS NULL THEN
    RAISE EXCEPTION 'Registro de presença não encontrado';
  END IF;
  IF v_reg.perfil_id <> v_perfil THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_reg.checkout_em IS NOT NULL THEN
    RAISE EXCEPTION 'Check-out já realizado';
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = v_reg.unidade_id;
  IF v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_dentro := private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) <= (v_unidade.raio_metros / 1000.0);
  END IF;

  UPDATE public.presenca_plantonista
    SET checkout_em = now(), checkout_lat = p_lat, checkout_lng = p_lng, checkout_dentro = v_dentro
    WHERE id = p_registro;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===========================================================================
-- 3. Histórico da escala (auditoria p/ gestor — "erros de passagem")
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.historico_escala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  plantao_id uuid,
  perfil_id uuid REFERENCES public.perfis(id),
  acao text NOT NULL,
  detalhe text,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_unidade ON public.historico_escala (unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historico_plantao ON public.historico_escala (plantao_id);

ALTER TABLE public.historico_escala ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historico_select" ON public.historico_escala;
CREATE POLICY "historico_select" ON public.historico_escala
  FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor');

-- helper para registrar histórico
CREATE OR REPLACE FUNCTION private.registrar_historico(
  p_unidade uuid, p_plantao uuid, p_acao text, p_detalhe text DEFAULT NULL, p_dados jsonb DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.historico_escala (unidade_id, plantao_id, perfil_id, acao, detalhe, dados)
  VALUES (p_unidade, p_plantao, private.meu_perfil_id(), p_acao, p_detalhe, p_dados);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger que captura toda alteração direta na escala_plantao
CREATE OR REPLACE FUNCTION private.registrar_historico_escala() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.historico_escala (unidade_id, plantao_id, perfil_id, acao, detalhe, dados)
  VALUES (
    COALESCE(NEW.unidade_id, OLD.unidade_id),
    COALESCE(NEW.id, OLD.id),
    private.meu_perfil_id(),
    CASE WHEN TG_OP = 'INSERT' THEN 'criar' WHEN TG_OP = 'UPDATE' THEN 'alterar' ELSE 'remover' END,
    NULL,
    jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW))
  );
  RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_escala_historico ON public.escala_plantao;
CREATE TRIGGER trg_escala_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.registrar_historico_escala();

-- ===========================================================================
-- 4. Fracionamento de plantão
-- ===========================================================================
ALTER TABLE public.escala_plantao
  ADD COLUMN IF NOT EXISTS fracionado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plantao_origem_id uuid REFERENCES public.escala_plantao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_escala_origem ON public.escala_plantao (plantao_origem_id);

CREATE OR REPLACE FUNCTION public.fracionar_plantao(
  p_plantao uuid,
  p_partes integer DEFAULT 2
) RETURNS integer AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_pl public.escala_plantao%ROWTYPE;
  v_i integer;
  v_criados integer := 0;
  v_gestor boolean;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = p_plantao AND ativo;
  IF v_pl.id IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado ou inativo';
  END IF;

  v_gestor := private.papel_na_unidade(v_pl.unidade_id) = 'gestor' OR private.eh_super_admin();
  IF NOT (v_gestor OR v_pl.perfil_id = v_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o plantonista escalado ou o gestor podem fracionar';
  END IF;

  IF p_partes < 2 OR p_partes > 4 THEN
    RAISE EXCEPTION 'O número de partes deve ser entre 2 e 4';
  END IF;

  IF EXISTS (SELECT 1 FROM public.escala_plantao WHERE plantao_origem_id = p_plantao AND ativo) THEN
    RAISE EXCEPTION 'Este plantão já foi fracionado';
  END IF;

  FOR v_i IN 1..p_partes LOOP
    INSERT INTO public.escala_plantao
      (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por,
       fracionado, plantao_origem_id)
    VALUES
      (v_pl.unidade_id, v_pl.setor_id, NULL, v_pl.data, v_pl.turno,
       format('Parte %s/%s de %s', v_i, p_partes, coalesce(v_pl.rotulo, 'plantão')), v_pl.quinzenal, true, v_perfil,
       true, v_pl.id);
    v_criados := v_criados + 1;
  END LOOP;

  UPDATE public.escala_plantao SET fracionado = true, ativo = false WHERE id = p_plantao;
  RETURN v_criados;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.remover_fracionamento(p_plantao uuid) RETURNS void AS $$
DECLARE v_pl public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = p_plantao;
  IF v_pl.id IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado';
  END IF;
  IF NOT (private.papel_na_unidade(v_pl.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Apenas o gestor pode remover fracionamentos';
  END IF;
  UPDATE public.escala_plantao SET fracionado = false, ativo = true WHERE id = p_plantao;
  UPDATE public.escala_plantao SET ativo = false WHERE plantao_origem_id = p_plantao;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===========================================================================
-- 5. Troca bilateral de plantões (A <-> B)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.trocas_plantao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  plantao_a_id uuid NOT NULL REFERENCES public.escala_plantao(id) ON DELETE CASCADE,
  perfil_a_id uuid NOT NULL REFERENCES public.perfis(id),
  plantao_b_id uuid NOT NULL REFERENCES public.escala_plantao(id) ON DELETE CASCADE,
  perfil_b_id uuid NOT NULL REFERENCES public.perfis(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelada', 'erro')),
  mensagem text,
  erro text,
  criado_por uuid REFERENCES public.perfis(id),
  decidido_por uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plantao_a_id, plantao_b_id)
);

CREATE INDEX IF NOT EXISTS idx_trocas_unidade ON public.trocas_plantao (unidade_id, status);
CREATE INDEX IF NOT EXISTS idx_trocas_perfil ON public.trocas_plantao (perfil_a_id);

ALTER TABLE public.trocas_plantao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trocas_select" ON public.trocas_plantao;
CREATE POLICY "trocas_select" ON public.trocas_plantao
  FOR SELECT TO authenticated
  USING (
    perfil_a_id = private.meu_perfil_id()
    OR perfil_b_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

DROP POLICY IF EXISTS "trocas_insert" ON public.trocas_plantao;
CREATE POLICY "trocas_insert" ON public.trocas_plantao
  FOR INSERT TO authenticated
  WITH CHECK (perfil_a_id = private.meu_perfil_id());

DROP POLICY IF EXISTS "trocas_update" ON public.trocas_plantao;
CREATE POLICY "trocas_update" ON public.trocas_plantao
  FOR UPDATE TO authenticated
  USING (
    perfil_b_id = private.meu_perfil_id()
    OR private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
  );

-- helper: conflito de horário (E3)
CREATE OR REPLACE FUNCTION private.tem_conflito_plantao(
  p_perfil uuid, p_unidade uuid, p_setor uuid, p_data date, p_turno text, p_ignorar uuid DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.escala_plantao
    WHERE perfil_id = p_perfil AND unidade_id = p_unidade AND setor_id = p_setor
      AND data = p_data AND turno = p_turno AND ativo
      AND (p_ignorar IS NULL OR id <> p_ignorar)
  );
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar a troca (valida conflitos)
CREATE OR REPLACE FUNCTION private.aplicar_troca(p_troca public.trocas_plantao) RETURNS void AS $$
DECLARE
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = p_troca.plantao_a_id AND ativo;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = p_troca.plantao_b_id AND ativo;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'Um dos plantões da troca não está mais ativo';
  END IF;

  -- conflito do B assumindo A
  IF private.tem_conflito_plantao(v_b.perfil_id, v_a.unidade_id, v_a.setor_id, v_a.data, v_a.turno, v_a.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o plantonista do plantão B já tem plantão no mesmo horário';
  END IF;
  -- conflito do A assumindo B
  IF private.tem_conflito_plantao(v_a.perfil_id, v_b.unidade_id, v_b.setor_id, v_b.data, v_b.turno, v_b.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o plantonista do plantão A já tem plantão no mesmo horário';
  END IF;

  UPDATE public.escala_plantao SET perfil_id = v_b.perfil_id, updated_at = now() WHERE id = v_a.id;
  UPDATE public.escala_plantao SET perfil_id = v_a.perfil_id, updated_at = now() WHERE id = v_b.id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Solicitar troca
CREATE OR REPLACE FUNCTION public.solicitar_troca(
  p_plantao_a uuid,
  p_plantao_b uuid,
  p_mensagem text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
  v_id uuid;
  v_aprovacao boolean;
  v_erro text;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = p_plantao_a AND ativo;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = p_plantao_b AND ativo;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'Plantões inválidos';
  END IF;
  IF v_a.unidade_id <> v_b.unidade_id THEN
    RAISE EXCEPTION 'Os plantões devem pertencer à mesma unidade';
  END IF;
  IF v_a.perfil_id <> v_perfil THEN
    RAISE EXCEPTION 'Você só pode oferecer seus próprios plantões';
  END IF;
  IF v_b.perfil_id IS NULL OR v_b.perfil_id = v_perfil THEN
    RAISE EXCEPTION 'O plantão B deve pertencer a outro plantonista';
  END IF;

  INSERT INTO public.trocas_plantao
    (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, mensagem, criado_por)
  VALUES
    (v_a.unidade_id, v_a.id, v_perfil, v_b.id, v_b.perfil_id, p_mensagem, v_perfil)
  RETURNING id INTO v_id;

  SELECT (valor = 'true') INTO v_aprovacao
    FROM public.configuracoes_unidade
    WHERE unidade_id = v_a.unidade_id AND chave = 'escala_passagem_exige_aprovacao';

  IF coalesce(v_aprovacao, false) IS FALSE THEN
    BEGIN
      PERFORM private.aplicar_troca((SELECT t FROM public.trocas_plantao t WHERE id = v_id));
      UPDATE public.trocas_plantao SET status = 'aprovado', decidido_por = v_perfil, updated_at = now() WHERE id = v_id;
      PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'troca_aprovada',
        format('Troca aprovada automaticamente: %s <-> %s', v_a.rotulo, v_b.rotulo),
        jsonb_build_object('troca_id', v_id));
    EXCEPTION WHEN OTHERS THEN
      v_erro := SQLERRM;
      UPDATE public.trocas_plantao SET status = 'erro', erro = v_erro, updated_at = now() WHERE id = v_id;
      PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'erro_passagem',
        v_erro, jsonb_build_object('troca_id', v_id, 'tipo', 'troca'));
      RAISE EXCEPTION '%', v_erro;
    END;
  ELSE
    PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'troca_solicitada',
      format('Troca solicitada: %s <-> %s', v_a.rotulo, v_b.rotulo),
      jsonb_build_object('troca_id', v_id));
  END IF;

  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aprovar troca (pelo plantonista B ou gestor)
CREATE OR REPLACE FUNCTION public.aprovar_troca(p_troca uuid) RETURNS void AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
  v_erro text;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Troca não encontrada';
  END IF;
  IF v_t.status <> 'pendente' THEN
    RAISE EXCEPTION 'Troca não está pendente';
  END IF;
  IF NOT (v_t.perfil_b_id = v_perfil OR private.papel_na_unidade(v_t.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  BEGIN
    PERFORM private.aplicar_troca(v_t);
    UPDATE public.trocas_plantao SET status = 'aprovado', decidido_por = v_perfil, updated_at = now() WHERE id = p_troca;
    PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_aprovada',
      'Troca aprovada', jsonb_build_object('troca_id', p_troca));
  EXCEPTION WHEN OTHERS THEN
    v_erro := SQLERRM;
    UPDATE public.trocas_plantao SET status = 'erro', erro = v_erro, updated_at = now() WHERE id = p_troca;
    PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'erro_passagem',
      v_erro, jsonb_build_object('troca_id', p_troca, 'tipo', 'troca'));
    RAISE EXCEPTION '%', v_erro;
  END;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recusar troca
CREATE OR REPLACE FUNCTION public.recusar_troca(p_troca uuid, p_motivo text DEFAULT NULL) RETURNS void AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Troca não encontrada';
  END IF;
  IF v_t.status <> 'pendente' THEN
    RAISE EXCEPTION 'Troca não está pendente';
  END IF;
  IF NOT (v_t.perfil_b_id = v_perfil OR private.papel_na_unidade(v_t.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.trocas_plantao SET status = 'recusado', decidido_por = v_perfil, updated_at = now() WHERE id = p_troca;
  PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_recusada',
    coalesce(p_motivo, 'sem justificativa'), jsonb_build_object('troca_id', p_troca));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Redefine passar_plantao p/ registrar erros de passagem no histórico
CREATE OR REPLACE FUNCTION public.passar_plantao(
  p_escala uuid,
  p_destino uuid,
  p_justificativa text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade uuid;
  v_aprovacao boolean;
  v_solic uuid;
BEGIN
  SELECT * INTO v_escala FROM public.escala_plantao WHERE id = p_escala AND ativo;
  IF v_escala.id IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado';
  END IF;
  IF v_escala.perfil_id <> v_perfil AND NOT (private.papel_na_unidade(v_escala.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_escala.perfil_id = p_destino THEN
    RAISE EXCEPTION 'O destino não pode ser o próprio plantonista';
  END IF;
  IF private.tem_conflito_plantao(p_destino, v_escala.unidade_id, v_escala.setor_id, v_escala.data, v_escala.turno, NULL) THEN
    PERFORM private.registrar_historico(v_escala.unidade_id, p_escala, 'erro_passagem',
      'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário',
      jsonb_build_object('destino', p_destino, 'tipo', 'passagem'));
    RAISE EXCEPTION 'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário';
  END IF;

  v_unidade := v_escala.unidade_id;

  SELECT (valor = 'true') INTO v_aprovacao
    FROM public.configuracoes_unidade
    WHERE unidade_id = v_unidade AND chave = 'escala_passagem_exige_aprovacao';

  IF coalesce(v_aprovacao, false) IS FALSE THEN
    UPDATE public.escala_plantao SET perfil_id = p_destino, observacao = p_justificativa, updated_at = now() WHERE id = p_escala;
    PERFORM private.registrar_historico(v_unidade, p_escala, 'passagem_aplicada',
      'Plantão passado automaticamente', jsonb_build_object('destino', p_destino, 'justificativa', p_justificativa));
    RETURN p_escala;
  END IF;

  INSERT INTO public.solicitacoes_escala
    (unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, criado_por)
  VALUES
    (v_unidade, p_escala, v_perfil, 'passar_plantao', 'pendente', p_destino, p_justificativa, v_perfil)
  RETURNING id INTO v_solic;

  PERFORM private.registrar_historico(v_unidade, p_escala, 'passagem_solicitada',
    'Passagem de plantão solicitada', jsonb_build_object('destino', p_destino, 'solicitacao', v_solic));

  RETURN v_solic;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===========================================================================
-- 6. Financeiro: remunerações + extrato
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.remuneracoes_plantao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id uuid REFERENCES public.setores(id) ON DELETE CASCADE,
  turno text CHECK (turno IN ('manha', 'tarde', 'noite')),
  valor numeric NOT NULL CHECK (valor >= 0),
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remuneracao_unidade ON public.remuneracoes_plantao (unidade_id);

ALTER TABLE public.remuneracoes_plantao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "remuneracoes_select" ON public.remuneracoes_plantao;
CREATE POLICY "remuneracoes_select" ON public.remuneracoes_plantao
  FOR SELECT TO authenticated
  USING (
    private.papel_na_unidade(unidade_id) IN ('gestor', 'plantonista', 'admin')
    OR private.eh_super_admin()
  );

DROP POLICY IF EXISTS "remuneracoes_insert" ON public.remuneracoes_plantao;
CREATE POLICY "remuneracoes_insert" ON public.remuneracoes_plantao
  FOR INSERT TO authenticated
  WITH CHECK (private.papel_na_unidade(unidade_id) = 'gestor' OR private.eh_super_admin());

DROP POLICY IF EXISTS "remuneracoes_update" ON public.remuneracoes_plantao;
CREATE POLICY "remuneracoes_update" ON public.remuneracoes_plantao
  FOR UPDATE TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.eh_super_admin());

-- helper: valor do plantão (precedência setor+turno -> setor -> turno -> geral)
CREATE OR REPLACE FUNCTION private.valor_plantao(
  p_unidade uuid, p_setor uuid, p_turno text
) RETURNS numeric AS $$
DECLARE v_valor numeric;
BEGIN
  SELECT valor INTO v_valor FROM public.remuneracoes_plantao
    WHERE unidade_id = p_unidade AND setor_id = p_setor AND turno = p_turno AND ativo ORDER BY created_at DESC LIMIT 1;
  IF v_valor IS NOT NULL THEN RETURN v_valor; END IF;
  SELECT valor INTO v_valor FROM public.remuneracoes_plantao
    WHERE unidade_id = p_unidade AND setor_id = p_setor AND turno IS NULL AND ativo ORDER BY created_at DESC LIMIT 1;
  IF v_valor IS NOT NULL THEN RETURN v_valor; END IF;
  SELECT valor INTO v_valor FROM public.remuneracoes_plantao
    WHERE unidade_id = p_unidade AND setor_id IS NULL AND turno = p_turno AND ativo ORDER BY created_at DESC LIMIT 1;
  IF v_valor IS NOT NULL THEN RETURN v_valor; END IF;
  SELECT valor INTO v_valor FROM public.remuneracoes_plantao
    WHERE unidade_id = p_unidade AND setor_id IS NULL AND turno IS NULL AND ativo ORDER BY created_at DESC LIMIT 1;
  RETURN coalesce(v_valor, 0);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Extrato: plantonista vê o próprio; gestor vê todos
CREATE OR REPLACE FUNCTION public.gerar_extrato_plantonista(
  p_unidade uuid,
  p_inicio date,
  p_fim date
) RETURNS TABLE (
  plantao_id uuid,
  data date,
  turno text,
  setor_id uuid,
  setor_nome text,
  perfil_id uuid,
  nome_completo text,
  valor numeric
) AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_gestor boolean;
BEGIN
  v_gestor := private.papel_na_unidade(p_unidade) = 'gestor' OR private.eh_super_admin();
  RETURN QUERY
    SELECT
      e.id AS plantao_id,
      e.data,
      e.turno,
      e.setor_id,
      s.nome AS setor_nome,
      e.perfil_id,
      p.nome_completo,
      private.valor_plantao(e.unidade_id, e.setor_id, e.turno) AS valor
    FROM public.escala_plantao e
    JOIN public.setores s ON s.id = e.setor_id
    JOIN public.perfis p ON p.id = e.perfil_id
    WHERE e.unidade_id = p_unidade
      AND e.ativo
      AND e.data BETWEEN p_inicio AND p_fim
      AND e.perfil_id IS NOT NULL
      AND (v_gestor OR e.perfil_id = v_perfil)
    ORDER BY e.data, e.turno;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===========================================================================
-- 7. Chat (ou link WhatsApp) entre plantonista e gestor
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.mensagens_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  remetente_id uuid NOT NULL REFERENCES public.perfis(id),
  destinatario_id uuid REFERENCES public.perfis(id),
  conteudo text NOT NULL,
  lida_em timestamptz,
  criado_por uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_unidade ON public.mensagens_chat (unidade_id, created_at);

ALTER TABLE public.mensagens_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensagens_select" ON public.mensagens_chat;
CREATE POLICY "mensagens_select" ON public.mensagens_chat
  FOR SELECT TO authenticated
  USING (
    unidade_id IN (SELECT private.unidades_gestor_plantonista())
    OR private.eh_super_admin()
  );

DROP POLICY IF EXISTS "mensagens_insert" ON public.mensagens_chat;
CREATE POLICY "mensagens_insert" ON public.mensagens_chat
  FOR INSERT TO authenticated
  WITH CHECK (
    remetente_id = private.meu_perfil_id()
    AND unidade_id IN (SELECT private.unidades_gestor_plantonista())
  );

DROP POLICY IF EXISTS "mensagens_update_lida" ON public.mensagens_chat;
CREATE POLICY "mensagens_update_lida" ON public.mensagens_chat
  FOR UPDATE TO authenticated
  USING (destinatario_id = private.meu_perfil_id());

-- ===========================================================================
-- 8. Notificação automática de vagas abertas (escala_plantao sem perfil)
-- ===========================================================================
CREATE OR REPLACE FUNCTION private.notificar_vaga() RETURNS trigger AS $$
DECLARE v_perfil uuid;
BEGIN
  IF NEW.perfil_id IS NULL AND NEW.ativo THEN
    FOR v_perfil IN
      SELECT v.perfil_id FROM public.vinculos v
      WHERE v.unidade_id = NEW.unidade_id AND v.papel = 'plantonista' AND v.ativo
    LOOP
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (
        v_perfil,
        NEW.unidade_id,
        NEW.data,
        'vaga_' || NEW.id,
        'Nova vaga de plantão em ' ||
          coalesce((SELECT nome FROM public.setores WHERE id = NEW.setor_id), 'setor') ||
          ' em ' || to_char(NEW.data, 'DD/MM') || ' (' || NEW.turno || ')'
      )
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_escala_vaga ON public.escala_plantao;
CREATE TRIGGER trg_escala_vaga
  AFTER INSERT OR UPDATE ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.notificar_vaga();

-- ===========================================================================
-- 9. Notificações: marca como lidas ao marcar
-- (compatível com o módulo existente)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_id uuid) RETURNS void AS $$
BEGIN
  UPDATE public.notificacoes_plantonista
    SET lida_em = now()
    WHERE id = p_id AND perfil_id = private.meu_perfil_id();
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
