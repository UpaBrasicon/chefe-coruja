-- RO3 da revisão unslop das telas novas (decisão do RT de 25/11/2026: "a
-- origem e a central mostram o mesmo isolamento do pedido").
--
-- Causa do dado divergente: a situação (suspeito/confirmado) e o agente do
-- isolamento ficam em regulacao_solicitacoes (migration 20270425000020), mas
-- só a regulacao_fila_extras os devolvia, e ela é da central. O dossiê lia
-- regulacao_detalhe e regulacao_lista (as duas montam o JSON em
-- private.regulacao_json), que não traziam os dois campos; na central a tela
-- completava com o extra da fila, na origem não havia de onde ler e a faixa
-- dizia "situação não informada" para o mesmo pedido.
--
-- Correção: private.regulacao_json devolve isolamento_situacao e
-- isolamento_agente. Quem já vê o pedido (private.regulacao_pode_ver na
-- regulacao_detalhe; o acesso da regulacao_lista) passa a ver também os dois
-- campos, como já via o tipo. Nenhuma regra de acesso muda; nenhuma coluna
-- muda. Idempotente: a troca só acontece uma vez.

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- no segundo objeto do JSON: o primeiro já está perto do limite de 100 argumentos do jsonb_build_object
SELECT pg_temp.trocar('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure,
  E'''vulnerabilidades'', to_jsonb(s.vulnerabilidades))',
  E'''vulnerabilidades'', to_jsonb(s.vulnerabilidades),\n'
  || E'    ''isolamento_situacao'', s.isolamento_situacao, ''isolamento_agente'', s.isolamento_agente)');

-- ── Rollback ────────────────────────────────────────────────────────────────
-- SELECT pg_temp.trocar('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure,
--   E'''vulnerabilidades'', to_jsonb(s.vulnerabilidades),\n    ''isolamento_situacao'', s.isolamento_situacao, ''isolamento_agente'', s.isolamento_agente)',
--   E'''vulnerabilidades'', to_jsonb(s.vulnerabilidades))');
-- (com a mesma pg_temp.trocar acima). A tela volta a ler a situação só do extra da fila na central.
