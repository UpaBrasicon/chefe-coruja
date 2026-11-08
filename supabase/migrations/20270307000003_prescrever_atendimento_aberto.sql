-- ════════════════════════════════════════════════════════════════════════════
-- Achado A P2-2 do teste da rede (A03, 06/11/2026): prescrição, dispensação e
-- checagem eram aceitas com o paciente ainda na triagem. Decisão do RT em
-- 07/11/2026: A (docs/teste-rede/README.md, "Decisões do RT e fila").
--
-- Na porta (prescrição sem internação), prescrever exige o atendimento aberto
-- pelo médico, a mesma condição de registrar_soap: episódio em "atendimento"
-- com atendimento_iniciado_em preenchido. Vale para medicamento e cuidado, e
-- para a alteração do item (alterar_item_prescricao grava a nova versão por
-- prescrever). Dispensação e checagem dependem do item, então também só
-- acontecem depois. Na observação e na internação nada muda: a prescrição é
-- da internação.
--
-- Só troca de texto reaplicável em public.prescrever (como a 20270301000001
-- e a 20270307000002); se o trecho não for achado, para. Nenhuma tabela muda.
--
-- ROLLBACK (em homologação antes; nada aqui apaga dado):
--   DO $$
--   DECLARE d text;
--   BEGIN
--     d := replace(pg_get_functiondef('public.prescrever(uuid, jsonb)'::regprocedure), E'\r', '');
--     EXECUTE regexp_replace(d, '\n  -- Q2 \(atendimento aberto\).*?-- fim Q2\n', E'\n', 's');
--   END $$;
-- ════════════════════════════════════════════════════════════════════════════

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

SELECT pg_temp.trocar_uma_vez('public.prescrever(uuid, jsonb)'::regprocedure,
  $old$
  -- F1 (frequência da porta): na porta, só frequência que o servidor entende
$old$,
  $new$
  -- Q2 (atendimento aberto): na porta, só depois de o médico abrir o
  -- atendimento, como no registro da consulta (registrar_soap)
  IF (SELECT pr.internacao_id FROM public.prescricoes pr WHERE pr.id = v_presc) IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.prescricoes pr JOIN public.episodios e ON e.id = pr.episodio_id
                      WHERE pr.id = v_presc AND e.etapa = 'atendimento' AND e.atendimento_iniciado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Abra o atendimento antes de prescrever.';
  END IF;
  -- fim Q2
  -- F1 (frequência da porta): na porta, só frequência que o servidor entende
$new$);
