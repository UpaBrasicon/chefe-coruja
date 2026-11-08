-- ════════════════════════════════════════════════════════════════════════════
-- Achado C P2-C2 do teste da rede (C03.08, 07/11/2026): a execução de APAC
-- aceitava competência e data de ocorrência no futuro; a glosa depois herdava
-- uma competência que ainda não existe. Decisão: A em F1 e F2 (recomendação
-- aplicada por delegação do RT em 08/11/2026;
-- docs/teste-rede/fila/ITEM-10-apac-sem-futuro.md).
--
-- F1. registrar_execucao_apac recusa competência depois da atual (mês de
--     Brasília): "Competência no futuro".
-- F2. recusa data de ocorrência depois de hoje (Brasília): "Data de
--     ocorrência no futuro", como registrar_procedimento já faz com a data.
-- O que já foi gravado não muda.
--
-- Troca de texto reaplicável em public.registrar_execucao_apac; se o trecho
-- não for achado, para.
--
-- ROLLBACK: tirar o trecho "F1/F2" de public.registrar_execucao_apac:
--   DO $$ DECLARE d text; BEGIN
--     d := replace(pg_get_functiondef('public.registrar_execucao_apac(uuid, text, text, text, date, uuid, jsonb)'::regprocedure), E'\r', '');
--     EXECUTE regexp_replace(d, '\n  -- F1/F2 \(APAC sem futuro\).*?-- fim F1/F2\n', E'\n', 's');
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

SELECT pg_temp.trocar_uma_vez('public.registrar_execucao_apac(uuid, text, text, text, date, uuid, jsonb)'::regprocedure,
  $old$
  IF coalesce(p_tipo_atendimento, '') !~ '^[0-9]{2}$' THEN RAISE EXCEPTION 'Tipo de atendimento: código de 2 dígitos.'; END IF;$old$,
  $new$
  -- F1/F2 (APAC sem futuro): nada de competência nem de data que ainda não chegaram
  IF p_competencia > to_char(private.data_atual(), 'YYYYMM') THEN
    RAISE EXCEPTION 'Competência no futuro: a produção de % só é registrada a partir desse mês.', p_competencia;
  END IF;
  IF p_data_ocorrencia IS NOT NULL AND p_data_ocorrencia > private.data_atual() THEN
    RAISE EXCEPTION 'Data de ocorrência no futuro (%).', to_char(p_data_ocorrencia, 'DD/MM/YYYY');
  END IF;
  -- fim F1/F2
  IF coalesce(p_tipo_atendimento, '') !~ '^[0-9]{2}$' THEN RAISE EXCEPTION 'Tipo de atendimento: código de 2 dígitos.'; END IF;$new$);
