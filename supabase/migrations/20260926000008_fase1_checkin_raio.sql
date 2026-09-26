-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — check-in fora do raio é bloqueado (ADR 0003, decisão de 26/09/2026).
--
-- Fora do raio, ou sem localização, o check-in é recusado com um código que
-- a interface reconhece. A pessoa tenta de novo; se continuar, a interface
-- pergunta se o GPS está com problema e reenvia com uma justificativa
-- escrita (mín. 10 caracteres). O check-in então passa, registrado como fora
-- do raio (ou sem localização), com a justificativa e a distância medida —
-- visível ao gestor em Presenças.
--
-- Unidade sem coordenadas cadastradas: não há o que conferir; o check-in
-- segue como antes (é configuração do gestor, não falha do plantonista).
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.presenca_plantonista
  ADD COLUMN IF NOT EXISTS checkin_justificativa text,
  ADD COLUMN IF NOT EXISTS checkin_distancia_m integer;

DROP FUNCTION IF EXISTS public.registrar_checkin(uuid, double precision, double precision, text);

CREATE FUNCTION public.registrar_checkin(p_unidade uuid, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL,
  p_observacao text DEFAULT NULL, p_justificativa text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade public.unidades%ROWTYPE;
  v_dentro boolean;
  v_distancia_m integer;
  v_just text := nullif(trim(coalesce(p_justificativa, '')), '');
  v_reg uuid;
  v_data date;
  v_turno text;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_escala FROM private.plantoes_agora() p WHERE p.unidade_id = p_unidade ORDER BY p.inicio LIMIT 1;
  IF v_escala.id IS NULL AND (private.tem_acesso_atendimento(p_unidade) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Você não está em escala ou não tem acesso de atendimento nesta unidade agora.';
  END IF;

  IF v_just IS NOT NULL AND length(v_just) < 10 THEN
    RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  IF v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      IF v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_SEM_LOCALIZACAO: não foi possível obter a sua localização.';
      END IF;
    ELSE
      v_distancia_m := round(private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) * 1000);
      v_dentro := v_distancia_m <= v_unidade.raio_metros;
      IF NOT v_dentro AND v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_FORA_DO_RAIO: você está a % m da unidade; o raio é de % m.', v_distancia_m, v_unidade.raio_metros;
      END IF;
    END IF;
  END IF;

  v_data := coalesce(v_escala.data, private.data_atual());
  v_turno := coalesce(v_escala.turno, private.turno_atual());

  INSERT INTO public.presenca_plantonista
    (unidade_id, escala_plantao_id, perfil_id, data, turno,
     checkin_em, checkin_lat, checkin_lng, checkin_dentro, checkin_distancia_m, checkin_justificativa,
     observacao, criado_por)
  VALUES
    (p_unidade, v_escala.id, v_perfil, v_data, v_turno,
     now(), p_lat, p_lng, v_dentro, v_distancia_m, CASE WHEN v_dentro IS TRUE THEN NULL ELSE v_just END,
     p_observacao, v_perfil)
  ON CONFLICT (perfil_id, unidade_id, data, turno)
  DO UPDATE SET checkin_em = EXCLUDED.checkin_em,
    checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
    checkin_dentro = EXCLUDED.checkin_dentro, checkin_distancia_m = EXCLUDED.checkin_distancia_m,
    checkin_justificativa = EXCLUDED.checkin_justificativa, observacao = EXCLUDED.observacao
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $$;

REVOKE EXECUTE ON FUNCTION public.registrar_checkin(uuid, double precision, double precision, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_checkin(uuid, double precision, double precision, text, text) TO authenticated;

-- Presenças do gestor passam a mostrar a justificativa e a distância.
DROP FUNCTION IF EXISTS public.presencas_do_dia_gestor(uuid);
CREATE FUNCTION public.presencas_do_dia_gestor(p_unidade uuid)
RETURNS TABLE(perfil_id uuid, nome text, papel text, em_escala boolean, checkin_em timestamptz,
  checkout_em timestamptz, checkin_dentro boolean, checkout_dentro boolean, observacao text,
  checkin_justificativa text, checkin_distancia_m integer, checkout_automatico boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: presenças são do gestor da unidade.';
  END IF;
  RETURN QUERY
  SELECT
    p.id, p.nome_completo, v.papel::text,
    EXISTS (SELECT 1 FROM public.escala_plantao e
            WHERE e.perfil_id = p.id AND e.unidade_id = p_unidade AND e.ativo
              AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)),
    pr.checkin_em, pr.checkout_em, pr.checkin_dentro, pr.checkout_dentro, pr.observacao,
    pr.checkin_justificativa, pr.checkin_distancia_m, coalesce(pr.checkout_automatico, false)
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  LEFT JOIN LATERAL (
    SELECT x.* FROM public.presenca_plantonista x
    WHERE x.perfil_id = p.id AND x.unidade_id = p_unidade
    ORDER BY x.checkin_em DESC NULLS LAST LIMIT 1
  ) pr ON true
  WHERE v.unidade_id = p_unidade
    AND v.ativo
    AND v.papel::text = ANY (ARRAY['plantonista', 'enfermeiro', 'tecnico_enfermagem', 'recepcao', 'telemedicina'])
    AND p.ativo
  ORDER BY pr.checkin_em NULLS LAST, p.nome_completo;
END; $$;

REVOKE EXECUTE ON FUNCTION public.presencas_do_dia_gestor(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.presencas_do_dia_gestor(uuid) TO authenticated;

-- Check-out com posição opcional: sem GPS vai vazio, nunca (0, 0).
DROP FUNCTION IF EXISTS public.registrar_checkout(uuid, double precision, double precision);
CREATE FUNCTION public.registrar_checkout(p_registro uuid, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade public.unidades%ROWTYPE;
  v_reg public.presenca_plantonista%ROWTYPE;
  v_dentro boolean;
BEGIN
  SELECT * INTO v_reg FROM public.presenca_plantonista WHERE id = p_registro;
  IF v_reg.id IS NULL THEN RAISE EXCEPTION 'Registro de presença não encontrado'; END IF;
  IF v_reg.perfil_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_reg.checkout_em IS NOT NULL THEN RAISE EXCEPTION 'Check-out já realizado'; END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = v_reg.unidade_id;
  IF v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_dentro := private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) <= (v_unidade.raio_metros / 1000.0);
  END IF;

  UPDATE public.presenca_plantonista
    SET checkout_em = now(), checkout_lat = p_lat, checkout_lng = p_lng, checkout_dentro = v_dentro
    WHERE id = p_registro;
END; $$;

REVOKE EXECUTE ON FUNCTION public.registrar_checkout(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_checkout(uuid, double precision, double precision) TO authenticated;
