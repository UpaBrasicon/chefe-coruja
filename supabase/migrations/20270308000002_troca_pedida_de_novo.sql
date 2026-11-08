-- ════════════════════════════════════════════════════════════════════════════
-- Achado D P2-2 do teste da rede (D04.07, 07/11/2026): uma troca cancelada ou
-- recusada não podia ser pedida de novo; o erro de unicidade chegava cru à
-- tela. Decisão do RT em 08/11/2026: A em T1 e T2 (docs/teste-rede/README.md).
--
-- T1. A unicidade do par (plantao_a_id, plantao_b_id) passa a valer só para o
--     pedido pendente: cancelado, recusado, aprovado ou com erro não impedem
--     um pedido novo; cada tentativa fica guardada no histórico.
-- T2. Com um pedido pendente do par, solicitar_troca recusa outro com
--     "Já há um pedido de troca pendente para estes plantões.", nos dois
--     sentidos (X↔Y e Y↔X). O índice parcial segura o mesmo sentido também
--     contra dois cliques ao mesmo tempo.
--
-- Constraint trocada por índice único parcial; solicitar_troca recebe a
-- conferência por troca de texto reaplicável (se o trecho não for achado,
-- para). Nenhum dado muda (na produção, em 08/11/2026, não havia troca).
--
-- ROLLBACK (só funciona se não houver dois pedidos do mesmo par):
--   DROP INDEX IF EXISTS public.trocas_plantao_par_pendente;
--   ALTER TABLE public.trocas_plantao ADD CONSTRAINT trocas_plantao_plantao_a_id_plantao_b_id_key UNIQUE (plantao_a_id, plantao_b_id);
--   e tirar o trecho "T2" de public.solicitar_troca.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trocas_plantao DROP CONSTRAINT IF EXISTS trocas_plantao_plantao_a_id_plantao_b_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS trocas_plantao_par_pendente ON public.trocas_plantao (plantao_a_id, plantao_b_id)
  WHERE status = 'pendente';
-- a busca do par em qualquer sentido (T2) usa os índices de plantao_a_id e plantao_b_id
CREATE INDEX IF NOT EXISTS idx_trocas_plantao_plantao_a_id ON public.trocas_plantao (plantao_a_id);

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

SELECT pg_temp.trocar_uma_vez('public.solicitar_troca(uuid, uuid, text)'::regprocedure,
  $old$
  INSERT INTO public.trocas_plantao
    (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, mensagem, criado_por)$old$,
  $new$
  -- T2 (troca pedida de novo): um pedido pendente do par basta, nos dois sentidos
  IF EXISTS (SELECT 1 FROM public.trocas_plantao t
              WHERE t.status = 'pendente'
                AND ((t.plantao_a_id = v_a.id AND t.plantao_b_id = v_b.id) OR (t.plantao_a_id = v_b.id AND t.plantao_b_id = v_a.id))) THEN
    RAISE EXCEPTION 'Já há um pedido de troca pendente para estes plantões.';
  END IF;
  -- fim T2
  INSERT INTO public.trocas_plantao
    (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, mensagem, criado_por)$new$);
