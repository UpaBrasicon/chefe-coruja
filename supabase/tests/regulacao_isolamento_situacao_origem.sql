-- RO3 da revisão unslop (RT, 25/11/2026) — migration
-- 20270426000044_regulacao_isolamento_situacao_na_origem.sql.
-- O JSON do pedido (regulacao_detalhe e regulacao_lista) traz a situação e o
-- agente do isolamento, para a origem mostrar o mesmo que a central.
-- ROLLBACK no fim (nada é gravado).
BEGIN;
DO $$
DECLARE j jsonb;
BEGIN
  j := private.regulacao_json(jsonb_populate_record(NULL::public.regulacao_solicitacoes, jsonb_build_object(
    'id', gen_random_uuid(), 'numero', 1, 'status', 'enviada', 'tipo', 'leito', 'prioridade', 'urgencia',
    'isolamento', true, 'isolamento_tipo', 'goticula', 'isolamento_tipos', '{goticula}',
    'isolamento_situacao', 'suspeito', 'isolamento_agente', 'Influenza a confirmar', 'criada_em', now())));
  IF j->>'isolamento_situacao' IS DISTINCT FROM 'suspeito' THEN
    RAISE EXCEPTION 'RO3: situação do isolamento fora do JSON do pedido (veio %)', j->>'isolamento_situacao';
  END IF;
  IF j->>'isolamento_agente' IS DISTINCT FROM 'Influenza a confirmar' THEN
    RAISE EXCEPTION 'RO3: agente do isolamento fora do JSON do pedido (veio %)', j->>'isolamento_agente';
  END IF;
  -- o que já vinha continua vindo
  IF j->>'isolamento_tipo' IS DISTINCT FROM 'goticula' OR NOT (j ? 'vulnerabilidades') OR NOT (j ? 'pendencia_pergunta') THEN
    RAISE EXCEPTION 'RO3: o JSON do pedido perdeu campos que já trazia';
  END IF;
END $$;
ROLLBACK;
