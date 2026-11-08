-- ════════════════════════════════════════════════════════════════════════════
-- Achado A P2-3 do teste da rede (A05, 06/11/2026): a enfermagem retirava o
-- medicamento com justificativa mesmo com o farmacêutico de plantão.
-- Decisão do RT em 07/11/2026: A (docs/teste-rede/README.md, "Decisões do RT
-- e fila").
--
-- A retirada sem farmacêutico (enfermagem, com justificativa, conferida
-- depois) só vale com a farmácia fechada. Com farmacêutico em check-in na
-- unidade agora, public.dispensar_item recusa a retirada pela enfermagem:
-- "Há farmacêutico de plantão na unidade: peça a dispensação a ele."
--
-- "Em check-in" = presença com check-in e sem check-out, de um plantão do
-- farmacêutico (vínculo ativo de farmacêutico na unidade) que está em curso
-- agora. Escalado sem check-in, ou depois do check-out, conta como farmácia
-- fechada (regra de antes).
--
-- private.farmaceutico_de_plantao(p_unidade) é nova. dispensar_item recebe o
-- trecho por troca de texto reaplicável; se o trecho não for achado, para.
--
-- ROLLBACK (em homologação antes; nada aqui apaga dado):
--   DO $$
--   DECLARE d text;
--   BEGIN
--     d := replace(pg_get_functiondef('public.dispensar_item(uuid, integer, text)'::regprocedure), E'\r', '');
--     EXECUTE regexp_replace(d, '\n    -- Q3 \(farmacêutico de plantão\).*?-- fim Q3\n', E'\n', 's');
--   END $$;
--   DROP FUNCTION IF EXISTS private.farmaceutico_de_plantao(uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.farmaceutico_de_plantao(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.presenca_plantonista x
      JOIN public.escala_plantao e ON e.id = x.escala_plantao_id AND e.ativo
      JOIN public.vinculos v ON v.perfil_id = x.perfil_id AND v.unidade_id = p_unidade AND v.ativo AND v.papel::text = 'farmaceutico'
     WHERE x.unidade_id = p_unidade
       AND x.checkin_em IS NOT NULL AND x.checkout_em IS NULL
       AND now() >= e.inicio AND now() < e.inicio + make_interval(mins => e.duracao_min))
$$;
REVOKE ALL ON FUNCTION private.farmaceutico_de_plantao(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  -- sem \r: o corpo gravado e este arquivo podem ter fim de linha do Windows
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

SELECT pg_temp.trocar_uma_vez('public.dispensar_item(uuid, integer, text)'::regprocedure,
  $old$
    IF length(coalesce(v_just, '')) < 10 THEN
      RAISE EXCEPTION 'Retirada sem farmacêutico: escreva a justificativa (mínimo de 10 letras).';
$old$,
  $new$
    -- Q3 (farmacêutico de plantão): a retirada pela enfermagem é só com a
    -- farmácia fechada
    IF private.farmaceutico_de_plantao(pr.unidade_id) THEN
      RAISE EXCEPTION 'Há farmacêutico de plantão na unidade: peça a dispensação a ele.';
    END IF;
    -- fim Q3
    IF length(coalesce(v_just, '')) < 10 THEN
      RAISE EXCEPTION 'Retirada sem farmacêutico: escreva a justificativa (mínimo de 10 letras).';
$new$);
