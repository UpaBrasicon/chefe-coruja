-- ════════════════════════════════════════════════════════════════════════════
-- Bug baixo B4 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- no check-in, a justificativa vazia era aceita onde não é pedida (unidade sem
-- coordenadas, ou dentro do raio), mas a justificativa curta ("Trânsito") era
-- recusada com CHECKIN_JUSTIFICATIVA_CURTA: escrever pouco era pior que nada.
-- Regra do RT: a localização registra mas não exige; a justificativa de 10
-- letras (decisão de 26/09/2026) é pedida quando o GPS falha ou está fora do raio.
--
-- Correção: a conferência das 10 letras sai do começo e vai para os dois pontos
-- em que a justificativa libera o check-in (sem localização; fora do raio).
-- Corpo de 20261014000001_checkin_tolerancia_porta.sql; só isso muda.
-- Mesma assinatura (CREATE OR REPLACE, as permissões ficam). Idempotente.
-- Teste: supabase/tests/checkin_justificativa_curta.sql
--
-- Rollback: reaplicar public.registrar_checkin de 20261014000001_checkin_tolerancia_porta.sql.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.registrar_checkin(p_unidade uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_observacao text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_remoto boolean := private.papel_na_unidade(p_unidade) = 'telemedicina';
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_escala FROM private.plantoes_na_janela() p
   WHERE p.unidade_id = p_unidade
   ORDER BY (private.checkin_do_plantao(p.id) IS NOT NULL), p.inicio
   LIMIT 1;
  IF v_escala.id IS NULL AND (private.tem_acesso_atendimento(p_unidade) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Você não está em escala ou não tem acesso de atendimento nesta unidade agora.';
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  -- Telemedicina é remota por definição; sem cerca geográfica.
  IF NOT v_remoto AND v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      IF v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_SEM_LOCALIZACAO: não foi possível obter a sua localização.';
      END IF;
      -- B4: a justificativa só é conferida quando é ela que libera o check-in
      IF length(v_just) < 10 THEN
        RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
      END IF;
    ELSE
      v_distancia_m := round(private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) * 1000);
      v_dentro := v_distancia_m <= v_unidade.raio_metros;
      IF NOT v_dentro AND v_just IS NULL THEN
        RAISE EXCEPTION 'CHECKIN_FORA_DO_RAIO: você está a % m da unidade; o raio é de % m.', v_distancia_m, v_unidade.raio_metros;
      END IF;
      IF NOT v_dentro AND length(v_just) < 10 THEN
        RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
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
     now(), CASE WHEN v_remoto THEN NULL ELSE p_lat END, CASE WHEN v_remoto THEN NULL ELSE p_lng END,
     v_dentro, v_distancia_m, CASE WHEN v_dentro IS TRUE OR v_remoto THEN NULL ELSE v_just END,
     CASE WHEN v_remoto THEN left('Telemedicina (remoto)' || coalesce(' · ' || p_observacao, ''), 500) ELSE p_observacao END, v_perfil)
  ON CONFLICT (perfil_id, unidade_id, data, turno)
  DO UPDATE SET checkin_em = EXCLUDED.checkin_em,
    checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
    checkin_dentro = EXCLUDED.checkin_dentro, checkin_distancia_m = EXCLUDED.checkin_distancia_m,
    checkin_justificativa = EXCLUDED.checkin_justificativa, observacao = EXCLUDED.observacao
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $function$;
