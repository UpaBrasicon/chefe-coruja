-- Auditoria do frontend (03/10/2026), defeito 2 / decisão do RT: fim do plantão.
-- Regra do RT: 20 minutos de tolerância depois do fim do plantão para terminar
-- o que está em curso; passados os 20 min a sessão fecha mesmo em uso, e só o
-- gestor libera a continuidade. Antes a tolerância do servidor era de 15 min e
-- a casca fechava por ociosidade (5 min) — não batia com a decisão.
--
-- Ponto de injeção único: private.plantoes_agora(). Todas as portas de escrita
-- passam por private.setores_na_escala_agora() → plantoes_agora(), e o portão
-- da casca (public.situacao_checkin) também. Mudar aqui vale para tudo.

-- ── 1. tolerância pós-plantão: 15 → 20 min ──────────────────────────────────
CREATE OR REPLACE FUNCTION private.tolerancia_fim_plantao() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '20 minutes' $$;

-- ── 2. liberação do gestor para continuar depois da tolerância ──────────────
CREATE TABLE IF NOT EXISTS public.liberacao_pos_plantao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  perfil_id      uuid NOT NULL REFERENCES public.perfis(id),
  concedido_por  uuid NOT NULL REFERENCES public.perfis(id),
  concedido_em   timestamptz NOT NULL DEFAULT now(),
  expira_em      timestamptz NOT NULL,
  motivo         text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  CONSTRAINT liberacao_pos_plantao_janela CHECK (expira_em > concedido_em)
);
CREATE INDEX IF NOT EXISTS liberacao_pos_plantao_ativa
  ON public.liberacao_pos_plantao (unidade_id, perfil_id, expira_em DESC);
ALTER TABLE public.liberacao_pos_plantao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.liberacao_pos_plantao FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS liberacao_pos_plantao_select ON public.liberacao_pos_plantao;
CREATE POLICY liberacao_pos_plantao_select ON public.liberacao_pos_plantao FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.gestao_da_unidade(unidade_id) IS TRUE);

-- liberação ativa do próprio usuário na unidade (lida pelas portas)
CREATE OR REPLACE FUNCTION private.liberacao_pos_plantao_ativa(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.liberacao_pos_plantao l
     WHERE l.unidade_id = p_unidade AND l.perfil_id = private.meu_perfil_id()
       AND l.expira_em > now());
$$;
REVOKE ALL ON FUNCTION private.liberacao_pos_plantao_ativa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.liberacao_pos_plantao_ativa(uuid) TO authenticated;

-- gestor concede continuidade a um plantonista depois da tolerância
CREATE OR REPLACE FUNCTION public.liberar_pos_plantao(
  p_unidade uuid, p_perfil uuid, p_minutos int, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a liberação é do gestor da unidade.';
  END IF;
  IF p_minutos IS NULL OR p_minutos NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'A liberação vale de 5 a 120 minutos.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Informe o motivo da liberação (pelo menos 10 letras).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Este profissional não tem vínculo ativo na unidade.';
  END IF;
  INSERT INTO public.liberacao_pos_plantao (unidade_id, perfil_id, concedido_por, expira_em, motivo)
  VALUES (p_unidade, p_perfil, private.meu_perfil_id(), now() + make_interval(mins => p_minutos), btrim(p_motivo))
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('liberar_pos_plantao', 'liberacao_pos_plantao', v_id, p_unidade,
    jsonb_build_object('perfil', p_perfil, 'minutos', p_minutos));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.liberar_pos_plantao(uuid, uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_pos_plantao(uuid, uuid, int, text) TO authenticated;

-- ── 3. plantoes_agora: janela + 20 min de tolerância + liberação ────────────
CREATE OR REPLACE FUNCTION private.plantoes_agora()
RETURNS SETOF public.escala_plantao LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- dentro da janela do plantão (comportamento de sempre: tolerância de
  -- check-in ou check-in feito)
  SELECT e.*
  FROM private.plantoes_na_janela() e
  WHERE now() < e.inicio + private.tolerancia_checkin(e.unidade_id)
     OR EXISTS (
       SELECT 1 FROM public.presenca_plantonista x
        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
          AND x.checkin_em IS NOT NULL
          AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
               OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min))))
  UNION
  -- 20 minutos de tolerância depois do fim do plantão, só com check-in feito,
  -- OU enquanto houver liberação ativa do gestor (decisão do RT 03/10/2026)
  SELECT e.*
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND now() >= e.inicio + make_interval(mins => e.duracao_min)
    AND (
      (now() < e.inicio + make_interval(mins => e.duracao_min) + private.tolerancia_fim_plantao()
       AND private.checkin_do_plantao(e.id) IS NOT NULL)
      OR private.liberacao_pos_plantao_ativa(e.unidade_id)
    )
    -- limita a plantões recentes, para a liberação não reabrir plantões antigos
    AND now() < e.inicio + make_interval(mins => e.duracao_min) + interval '12 hours';
$$;
REVOKE ALL ON FUNCTION private.plantoes_agora() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.plantoes_agora() TO authenticated;

-- ── 4. o gestor enxerga a liberação ativa na lista de presenças ─────────────
DROP FUNCTION IF EXISTS public.presencas_do_dia_gestor(uuid);
CREATE FUNCTION public.presencas_do_dia_gestor(p_unidade uuid)
RETURNS TABLE(perfil_id uuid, nome text, papel text, em_escala boolean, checkin_em timestamptz,
  checkout_em timestamptz, checkin_dentro boolean, checkout_dentro boolean, observacao text,
  checkin_justificativa text, checkin_distancia_m integer, checkout_automatico boolean,
  liberado_pos_ate timestamptz)
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
    pr.checkin_justificativa, pr.checkin_distancia_m, coalesce(pr.checkout_automatico, false),
    (SELECT max(l.expira_em) FROM public.liberacao_pos_plantao l
      WHERE l.perfil_id = p.id AND l.unidade_id = p_unidade AND l.expira_em > now())
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
