-- ════════════════════════════════════════════════════════════════════════════
-- VD13 do lote "Virada de data" (BACKLOG.md, P1): check-in que reabre a
-- presença sem limpar o check-out.
--
-- Um segundo check-in no mesmo plantão (perfil, unidade, data, turno) cai na
-- linha que já existe: o ON CONFLICT ... DO UPDATE de registrar_checkin troca
-- os dados do check-in e deixa o check-out antigo. A presença reaberta já
-- nasce fechada e registrar_checkout recusa o novo check-out ("Check-out já
-- realizado"). Vale também para a presença fechada pelo fechamento automático
-- (checkout_automatico = true).
--
-- Correção: o DO UPDATE limpa checkout_em, checkout_lat, checkout_lng,
-- checkout_dentro e volta checkout_automatico para false. Corpo de
-- registrar_checkin de 20270209000004_checkin_madrugada.sql (conferido por md5
-- com a produção), só com essa troca.
-- Expand: mesma assinatura; sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/vd13_checkin_reabre.sql
--
-- Rollback:
--   reaplicar public.registrar_checkin de 20270209000004_checkin_madrugada.sql
--   (só a função; private.data_do_turno fica).
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

  -- VD5: sem escala, a data é a do plantão em curso (a noite de 00h às 6h59 começou ontem)
  v_data := coalesce(v_escala.data, private.data_do_turno());
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
    checkin_justificativa = EXCLUDED.checkin_justificativa, observacao = EXCLUDED.observacao,
    -- VD13: a presença reaberta não herda o check-out anterior
    checkout_em = NULL, checkout_lat = NULL, checkout_lng = NULL,
    checkout_dentro = NULL, checkout_automatico = false
  RETURNING id INTO v_reg;

  RETURN v_reg;
END; $function$;
