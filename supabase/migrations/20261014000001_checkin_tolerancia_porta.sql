-- ════════════════════════════════════════════════════════════════════════════
-- A escala é a porta — e o check-in fecha a porta depois da tolerância
-- (ADR 0003; decisão de 30/09/2026).
--
-- Todo papel que entra pela escala (plantonista, enfermeiro, técnico de
-- enfermagem, recepção, telemedicina) tem até a TOLERÂNCIA da unidade
-- (padrão 30 min) depois do início do plantão para fazer o check-in.
--
--  * Um plantão só conta como "agora" (private.plantoes_agora, e com ele
--    setores_na_escala_agora, tem_plantao_agora, na_escala_agora e toda a
--    RLS que se apoia neles) se está dentro da janela E (ainda dentro da
--    tolerância OU já tem check-in registrado para ele).
--  * Passada a tolerância sem check-in, o acesso fica bloqueado até o
--    check-in. Feito o check-in (atrasado, e o atraso aparece na auditoria de
--    check-in do gestor), o acesso volta na hora — sem liberação do gestor.
--  * O próprio check-in não depende da porta que ele destrava: a RPC olha a
--    janela crua (private.plantoes_na_janela).
--  * Localização: o check-in registra dentro/fora do raio (com justificativa
--    quando fora ou sem GPS, como decidido em 26/09), mas não exige estar no
--    raio; o bloqueio é só por falta de check-in.
--
-- Presença "do plantão": a de escala_plantao_id = plantão, a do mesmo
-- (perfil, unidade, data, turno) — a chave do ON CONFLICT do check-in — ou
-- um check-in feito DENTRO da janela dele (dois setores ao mesmo tempo: a
-- pessoa chega uma vez só). Turnos seguidos têm cada um o seu check-in.
--
-- Configuração: public.configuracoes_unidade, chave 'checkin_tolerancia_min'
-- (minutos inteiros de 0 a 120; ausente ou inválida = 30), a mesma que o
-- gestor edita nos limites da unidade (20261012000001).
--
-- Reaplicável: CREATE OR REPLACE, DROP ... IF EXISTS, ON CONFLICT DO NOTHING.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tolerância do check-in por unidade ───────────────────────────────────
-- A chave é a mesma dos "limites da unidade" (20261012000001: o gestor grava
-- por public.salvar_limites_unidade, 0 a 120 min). Mesma leitura daquela
-- migration: ausente ou fora da faixa vale o padrão, 30.
ALTER TABLE public.configuracoes_unidade DROP CONSTRAINT IF EXISTS configuracoes_unidade_checkin_tolerancia_check;

CREATE OR REPLACE FUNCTION private.tolerancia_checkin(p_unidade uuid)
RETURNS interval LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT make_interval(mins => coalesce(
    (SELECT CASE WHEN btrim(c.valor) ~ '^\d{1,6}$' AND btrim(c.valor)::integer BETWEEN 0 AND 120
                 THEN btrim(c.valor)::integer END
       FROM public.configuracoes_unidade c
      WHERE c.unidade_id = p_unidade AND c.chave = 'checkin_tolerancia_min'),
    30));
$$;

-- ── 2. A janela crua (o que plantoes_agora era até aqui) ────────────────────
CREATE OR REPLACE FUNCTION private.plantoes_na_janela()
RETURNS SETOF public.escala_plantao LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.*
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.inicio <= now()
    AND now() < e.inicio + make_interval(mins => e.duracao_min);
$$;

-- Hora do check-in do plantão (NULL = sem check-in).
CREATE OR REPLACE FUNCTION private.checkin_do_plantao(p_escala uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT min(x.checkin_em)
  FROM public.escala_plantao e
  JOIN public.presenca_plantonista x
    ON x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
   AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
        OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min)))
  WHERE e.id = p_escala AND x.checkin_em IS NOT NULL;
$$;

-- ── 3. A porta: janela E (tolerância OU check-in) ───────────────────────────
CREATE OR REPLACE FUNCTION private.plantoes_agora()
RETURNS SETOF public.escala_plantao LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.*
  FROM private.plantoes_na_janela() e
  WHERE now() < e.inicio + private.tolerancia_checkin(e.unidade_id)
     OR EXISTS (
       SELECT 1 FROM public.presenca_plantonista x
        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
          AND x.checkin_em IS NOT NULL
          AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
               OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min))));
$$;

-- ── 4. Check-in: pela janela crua, nunca pela porta ─────────────────────────
-- Com mais de um plantão na janela, o check-in vai primeiro para o que ainda
-- não tem (dois setores no mesmo turno dividem a mesma presença pela chave
-- data/turno; turnos seguidos têm cada um o seu).
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

  IF v_just IS NOT NULL AND length(v_just) < 10 THEN
    RAISE EXCEPTION 'CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres.';
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade;
  -- Telemedicina é remota por definição; sem cerca geográfica.
  IF NOT v_remoto AND v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL THEN
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

-- ── 5. Para a interface: a situação do check-in, pelo relógio do servidor ───
-- liberado: há plantão que conta como "agora" nesta unidade (a porta aberta).
-- pendente: o primeiro plantão da janela ainda sem check-in, com o prazo.
-- bloqueado: está na janela, mas nenhum plantão conta (tolerância vencida sem
-- check-in) — a interface mostra só a tela de check-in.
CREATE OR REPLACE FUNCTION public.situacao_checkin(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tol interval := private.tolerancia_checkin(p_unidade);
  v_liberado boolean;
  v_janela boolean;
  v_pend jsonb;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  v_liberado := EXISTS (SELECT 1 FROM private.plantoes_agora() p WHERE p.unidade_id = p_unidade);
  v_janela := EXISTS (SELECT 1 FROM private.plantoes_na_janela() p WHERE p.unidade_id = p_unidade);

  SELECT jsonb_build_object(
           'escala_id', p.id, 'setor_nome', s.nome, 'turno', p.turno,
           'inicio', p.inicio, 'fim', p.inicio + make_interval(mins => p.duracao_min),
           'prazo', p.inicio + v_tol)
    INTO v_pend
    FROM private.plantoes_na_janela() p
    JOIN public.setores s ON s.id = p.setor_id
   WHERE p.unidade_id = p_unidade AND private.checkin_do_plantao(p.id) IS NULL
   ORDER BY p.inicio
   LIMIT 1;

  RETURN jsonb_build_object(
    'servidor', now(),
    'tolerancia_min', round(extract(epoch FROM v_tol) / 60)::integer,
    'na_janela', v_janela,
    'liberado', v_liberado,
    'bloqueado', v_janela AND NOT v_liberado,
    'pendente', v_pend);
END; $$;

-- ── 6. Permissões ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.tolerancia_checkin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tolerancia_checkin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.plantoes_na_janela() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.plantoes_na_janela() TO authenticated;
REVOKE ALL ON FUNCTION private.checkin_do_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.checkin_do_plantao(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.plantoes_agora() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.plantoes_agora() TO authenticated;
REVOKE ALL ON FUNCTION public.registrar_checkin(uuid, double precision, double precision, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_checkin(uuid, double precision, double precision, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.situacao_checkin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.situacao_checkin(uuid) TO authenticated;
