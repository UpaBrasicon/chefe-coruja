-- ════════════════════════════════════════════════════════════════════════════
-- Achado D P2-1 do teste da rede (D02.B1, 07/11/2026): o check-out não fechava
-- a porta; o plantão seguia aberto até 20 min depois do fim. Causa:
-- private.plantoes_agora e private.checkin_do_plantao olham só checkin_em.
-- Decisão: A em C1 e C2 (recomendação aplicada por delegação do RT em
-- 08/11/2026; docs/teste-rede/README.md, item 8).
--
-- C1. O check-out feito pela pessoa fecha a porta na hora: o plantão sai de
--     plantoes_agora (e, com ele, de setores_na_escala_agora), dentro do
--     horário e nos 20 min de tolerância. O check-out automático do fim
--     (fechar_presencas_vencidas, checkout_automatico = true) NÃO fecha a
--     tolerância: ele só registra o fim.
-- C2. Check-out por engano: um check-in novo reabre (registrar_checkin já
--     apaga o check-out da presença). Depois do fim, a liberação do gestor
--     continua valendo, como antes.
--
-- private.checkout_do_plantao é nova; private.plantoes_agora é recriada com o
-- mesmo corpo de 20261022000018, mais a condição do check-out.
--
-- ROLLBACK: rodar de novo o CREATE OR REPLACE FUNCTION private.plantoes_agora
-- de supabase/migrations/20261022000018_pos_plantao_20min_liberacao_gestor.sql;
-- DROP FUNCTION IF EXISTS private.checkout_do_plantao(uuid).
-- ════════════════════════════════════════════════════════════════════════════

-- o check-out feito pela pessoa no plantão (o automático do fim não conta)
CREATE OR REPLACE FUNCTION private.checkout_do_plantao(p_escala uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT min(x.checkout_em)
  FROM public.escala_plantao e
  JOIN public.presenca_plantonista x
    ON x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
   AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
        OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min)))
  WHERE e.id = p_escala AND x.checkout_em IS NOT NULL AND x.checkout_em <= now()
    AND x.checkout_automatico IS NOT TRUE;
$$;
REVOKE ALL ON FUNCTION private.checkout_do_plantao(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.plantoes_agora()
 RETURNS SETOF public.escala_plantao
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- dentro da janela do plantão (comportamento de sempre: tolerância de
  -- check-in ou check-in feito), menos quem já fez o check-out (C1)
  SELECT e.*
  FROM private.plantoes_na_janela() e
  WHERE (now() < e.inicio + private.tolerancia_checkin(e.unidade_id)
     OR EXISTS (
       SELECT 1 FROM public.presenca_plantonista x
        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
          AND x.checkin_em IS NOT NULL
          AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
               OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min)))))
    AND private.checkout_do_plantao(e.id) IS NULL
  UNION
  -- 20 minutos de tolerância depois do fim do plantão, só com check-in feito
  -- e sem check-out da pessoa (C1), OU enquanto houver liberação ativa do
  -- gestor (decisão do RT 03/10/2026)
  SELECT e.*
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND now() >= e.inicio + make_interval(mins => e.duracao_min)
    AND (
      (now() < e.inicio + make_interval(mins => e.duracao_min) + private.tolerancia_fim_plantao()
       AND private.checkin_do_plantao(e.id) IS NOT NULL
       AND private.checkout_do_plantao(e.id) IS NULL)
      OR private.liberacao_pos_plantao_ativa(e.unidade_id)
    )
    -- limita a plantões recentes, para a liberação não reabrir plantões antigos
    AND now() < e.inicio + make_interval(mins => e.duracao_min) + interval '12 hours';
$function$;
