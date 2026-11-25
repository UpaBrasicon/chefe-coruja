-- RO2 da revisão unslop (RT, 25/11/2026), defeito da conferência com login:
-- no lado da origem, o atalho "A central perguntou" e a pergunta no topo do
-- dossiê olhavam só status = 'pendencia'. O pedido nº 414 (em_analise) tinha
-- na conversa uma pergunta e um pedido de exame da central sem resposta da
-- origem, e o NIR ("O regulador pede: …") e a lista do médico já os davam
-- como pendentes: a regra do app é a de private.regulacao_conversa_estado
-- (mensagens da central depois da última mensagem da origem = "aguardando";
-- src/lib/regulacaoPaciente.ts, esperaAOrigem), somada à pendência formal.
--
-- Correção: private.regulacao_json devolve também 'conversa' (o mesmo estado
-- que regulacao_pacientes e regulacao_do_paciente já devolvem pelo
-- regulacao_resumo). Assim regulacao_lista e regulacao_detalhe dão à fila e
-- ao dossiê da origem a mesma regra. Nenhuma regra de acesso muda (quem vê o
-- pedido já via a conversa pela regulacao_conversa); nenhuma coluna muda.
-- Idempotente.

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- depende da 20270426000044 (situação e agente do isolamento no mesmo objeto)
SELECT pg_temp.trocar('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure,
  E'''isolamento_situacao'', s.isolamento_situacao, ''isolamento_agente'', s.isolamento_agente)',
  E'''isolamento_situacao'', s.isolamento_situacao, ''isolamento_agente'', s.isolamento_agente,\n'
  || E'    ''conversa'', private.regulacao_conversa_estado(s))');

-- ── Rollback ────────────────────────────────────────────────────────────────
-- Com a mesma pg_temp.trocar:
-- SELECT pg_temp.trocar('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure,
--   E'''isolamento_situacao'', s.isolamento_situacao, ''isolamento_agente'', s.isolamento_agente,\n    ''conversa'', private.regulacao_conversa_estado(s))',
--   E'''isolamento_situacao'', s.isolamento_situacao, ''isolamento_agente'', s.isolamento_agente)');
-- A fila da origem volta a contar só a pendência formal.
