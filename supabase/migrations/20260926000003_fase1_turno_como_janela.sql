-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — o turno é uma janela (início + duração), não um rótulo com data.
-- ADR 0003 (produto/docs/adr).
--
-- O defeito: "estar de plantão agora" era `data = data_atual() AND turno =
-- turno_atual()`. À meia-noite a data vira; quem estava na noite perdia o
-- acesso até as 07h, e quem estava escalado para a noite SEGUINTE ganhava.
--
-- Padrão expandir → migrar → contrair: o app antigo continua gravando
-- (data, turno); um gatilho mantém `inicio` e `duracao_min` em sincronia, e
-- toda regra de acesso passa a olhar só a janela. As assinaturas das funções
-- públicas não mudam — o app antigo herda a correção sem deploy.
--
-- Grade da unidade (hora de Brasília):
--   12 h: diurno 07–19 · noturno 19–07
--    6 h: 07–13 (manha) · 13–19 (tarde) · 19–01 (noite, 360) · 01–07 (madrugada)
-- Legado: 'noite' sem duração explícita é 19–07 (720 min).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Colunas novas e rótulo 'madrugada' ───────────────────────────────────
ALTER TABLE public.escala_plantao
  ADD COLUMN IF NOT EXISTS inicio timestamptz,
  ADD COLUMN IF NOT EXISTS duracao_min integer;

ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_turno_check;
ALTER TABLE public.escala_plantao
  ADD CONSTRAINT escala_plantao_turno_check CHECK (turno IN ('manha', 'tarde', 'noite', 'madrugada'));
ALTER TABLE public.escala_plantao DROP CONSTRAINT IF EXISTS escala_plantao_duracao_check;
ALTER TABLE public.escala_plantao
  ADD CONSTRAINT escala_plantao_duracao_check CHECK (duracao_min IN (360, 720));

ALTER TABLE public.presenca_plantonista DROP CONSTRAINT IF EXISTS presenca_plantonista_turno_check;
ALTER TABLE public.presenca_plantonista
  ADD CONSTRAINT presenca_plantonista_turno_check CHECK (turno IN ('manha', 'tarde', 'noite', 'madrugada'));

-- ── 2. Início do turno a partir de (data, rótulo), em America/Sao_Paulo ─────
CREATE OR REPLACE FUNCTION private.inicio_do_turno(p_data date, p_turno text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (p_data + CASE p_turno
            WHEN 'manha'     THEN time '07:00'
            WHEN 'tarde'     THEN time '13:00'
            WHEN 'noite'     THEN time '19:00'
            WHEN 'madrugada' THEN time '01:00'
          END) AT TIME ZONE 'America/Sao_Paulo';
$$;

CREATE OR REPLACE FUNCTION private.duracao_padrao(p_turno text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_turno WHEN 'noite' THEN 720 ELSE 360 END;
$$;

-- A janela sai sempre de (data, turno): uma fonte só, nenhuma divergência.
CREATE OR REPLACE FUNCTION private.escala_janela()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.inicio := private.inicio_do_turno(NEW.data, NEW.turno);
  NEW.duracao_min := coalesce(NEW.duracao_min, private.duracao_padrao(NEW.turno));
  IF NEW.turno IN ('manha', 'tarde', 'madrugada') AND NEW.duracao_min <> 360 THEN
    RAISE EXCEPTION 'O turno % tem 6 horas.', NEW.turno;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_escala_janela ON public.escala_plantao;
CREATE TRIGGER trg_escala_janela
  BEFORE INSERT OR UPDATE OF data, turno, duracao_min ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.escala_janela();

UPDATE public.escala_plantao
SET inicio = private.inicio_do_turno(data, turno),
    duracao_min = coalesce(duracao_min, private.duracao_padrao(turno))
WHERE inicio IS NULL OR duracao_min IS NULL;

ALTER TABLE public.escala_plantao ALTER COLUMN inicio SET NOT NULL;
ALTER TABLE public.escala_plantao ALTER COLUMN duracao_min SET NOT NULL;

CREATE INDEX IF NOT EXISTS escala_plantao_perfil_janela
  ON public.escala_plantao (perfil_id, inicio) WHERE ativo;

-- ── 3. "De plantão agora" = dentro da janela ────────────────────────────────

-- Plantões ativos do usuário neste instante (setor da própria unidade).
CREATE OR REPLACE FUNCTION private.plantoes_agora()
RETURNS SETOF public.escala_plantao LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.*
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.inicio <= now()
    AND now() < e.inicio + make_interval(mins => e.duracao_min);
$$;

CREATE OR REPLACE FUNCTION private.na_escala_agora(unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.plantoes_agora() p WHERE p.unidade_id = unidade);
$$;

CREATE OR REPLACE FUNCTION private.setores_na_escala_agora()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT p.setor_id FROM private.plantoes_agora() p;
$$;

-- A porta setor a setor (ADR 0003): usada pelas regras novas e pelas RPCs.
CREATE OR REPLACE FUNCTION private.tem_plantao_agora(p_setor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(EXISTS (SELECT 1 FROM private.plantoes_agora() p WHERE p.setor_id = p_setor), false);
$$;

-- Para a interface: o plantão de agora, com fim, sem calcular no aparelho.
CREATE OR REPLACE FUNCTION public.meu_plantao_agora()
RETURNS TABLE(escala_id uuid, unidade_id uuid, setor_id uuid, setor_nome text, turno text, inicio timestamptz, fim timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.unidade_id, p.setor_id, s.nome, p.turno, p.inicio,
         p.inicio + make_interval(mins => p.duracao_min)
  FROM private.plantoes_agora() p
  JOIN public.setores s ON s.id = p.setor_id
  ORDER BY p.inicio;
$$;

REVOKE EXECUTE ON FUNCTION private.plantoes_agora(), private.tem_plantao_agora(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION private.plantoes_agora(), private.tem_plantao_agora(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.meu_plantao_agora() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.meu_plantao_agora() TO authenticated;

-- ── 4. Funções que conferiam data/turno do calendário ──────────────────────

-- Check-in: acha o plantão ATIVO pela janela; a presença herda a data e o
-- rótulo do plantão (a noite que começou ontem continua sendo "ontem, noite").
CREATE OR REPLACE FUNCTION public.registrar_checkin(p_unidade uuid, p_lat double precision, p_lng double precision, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade public.unidades%ROWTYPE;
  v_dentro boolean;
  v_reg uuid;
  v_data date;
  v_turno text;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_escala FROM private.plantoes_agora() p WHERE p.unidade_id = p_unidade ORDER BY p.inicio LIMIT 1;
  IF v_escala.id IS NULL AND (private.tem_acesso_atendimento(p_unidade) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Você não está em escala ou não tem acesso de atendimento nesta unidade agora.';
  END IF;

  -- Acesso de atendimento sem escala: registra no rótulo do relógio.
  v_data := coalesce(v_escala.data, private.data_atual());
  v_turno := coalesce(v_escala.turno, private.turno_atual());

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  IF v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_dentro := private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) <= (v_unidade.raio_metros / 1000.0);
  END IF;

  INSERT INTO public.presenca_plantonista
    (unidade_id, escala_plantao_id, perfil_id, data, turno,
     checkin_em, checkin_lat, checkin_lng, checkin_dentro, observacao, criado_por)
  VALUES
    (p_unidade, v_escala.id, v_perfil, v_data, v_turno,
     now(), p_lat, p_lng, v_dentro, p_observacao, v_perfil)
  ON CONFLICT (perfil_id, unidade_id, data, turno)
  DO UPDATE SET checkin_em = EXCLUDED.checkin_em,
    checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
    checkin_dentro = EXCLUDED.checkin_dentro, observacao = EXCLUDED.observacao
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $$;

-- Transferência entre setores: a escala conferida é a do setor de ORIGEM.
CREATE OR REPLACE FUNCTION public.transferir_paciente(p_paciente uuid, p_destino uuid, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade  uuid;
  v_origem   uuid;
  v_destino  public.setores%ROWTYPE;
  v_reg      uuid;
BEGIN
  SELECT unidade_id, setor_id INTO v_unidade, v_origem
  FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  SELECT * INTO v_destino FROM public.setores WHERE id = p_destino AND ativo;
  IF v_destino.id IS NULL THEN RAISE EXCEPTION 'Setor de destino não encontrado.'; END IF;
  IF v_destino.unidade_id <> v_unidade THEN RAISE EXCEPTION 'Setor de destino pertence a outra unidade.'; END IF;

  IF (private.eh_super_admin()
      OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR private.tem_plantao_agora(v_origem)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala do setor de origem deste paciente.';
  END IF;

  IF v_destino.tipo = 'observacao'
     AND position('verm' in lower(v_destino.nome)) = 0
     AND NOT private.paciente_tem_prescricao_ativa(p_paciente) THEN
    RAISE EXCEPTION 'Para encaminhar à observação, o paciente precisa ter uma prescrição médica registrada.';
  END IF;

  UPDATE public.pacientes SET setor_id = p_destino WHERE id = p_paciente;

  INSERT INTO public.transferencias_paciente
    (paciente_id, unidade_id, setor_origem_id, setor_destino_id, transferido_por, motivo)
  VALUES (p_paciente, v_unidade, v_origem, p_destino, auth.uid(), p_motivo)
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $$;

CREATE OR REPLACE FUNCTION public.transferir_internado(p_paciente uuid, p_destino uuid, p_motivo text DEFAULT NULL,
  p_tipo_evento text DEFAULT 'transferencia_setor')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_setor uuid;
  v_ep uuid;
  v_tipo text;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT unidade_id, setor_id INTO v_unidade, v_setor FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  IF (private.eh_super_admin()
      OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR private.tem_plantao_agora(v_setor)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala do setor de origem deste paciente.';
  END IF;

  v_ep := private.internacao_ativa(p_paciente);
  IF v_ep IS NULL THEN
    v_ep := public.abrir_internacao(p_paciente, v_unidade, 'urgencia', 'emergencia', v_setor, NULL);
    v_tipo := CASE WHEN p_tipo_evento = 'transferencia_setor' THEN 'internacao' ELSE p_tipo_evento END;
  ELSE
    v_tipo := p_tipo_evento;
  END IF;

  PERFORM public.registrar_evento_adt(v_ep, v_tipo, p_destino, NULL, p_motivo);
  UPDATE public.pacientes SET setor_id = p_destino, updated_at = now() WHERE id = p_paciente;
  RETURN v_ep;
END; $$;

-- Chat: "de plantão agora" pela janela.
CREATE OR REPLACE FUNCTION public.contatos_chat()
RETURNS TABLE(perfil_id uuid, nome text, foto text, papel text, setor_nome text, em_plantao boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, p.foto_url, 'plantonista'::text, s.nome, true
  FROM public.escala_plantao e
  JOIN public.perfis p ON p.id = e.perfil_id
  JOIN public.setores s ON s.id = e.setor_id
  JOIN public.vinculos v ON v.perfil_id = p.id AND v.unidade_id = e.unidade_id AND v.ativo
  WHERE e.ativo
    AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
    AND e.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2 WHERE v2.perfil_id = v_perfil AND v2.ativo)
  UNION ALL
  SELECT DISTINCT p.id, p.nome_completo, p.foto_url, 'gestor'::text, NULL::text, false
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  WHERE v.papel = 'gestor' AND v.ativo
    AND v.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2 WHERE v2.perfil_id = v_perfil AND v2.ativo)
    AND p.id <> v_perfil
  ORDER BY 2;
END; $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
