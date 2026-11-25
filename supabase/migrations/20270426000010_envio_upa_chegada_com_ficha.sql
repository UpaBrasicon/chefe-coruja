-- ════════════════════════════════════════════════════════════════════════════
-- Envio da UBS à UPA: a chegada (decisões do RT em 25/11/2026, teste de fluxo A).
--
-- A-3: "Chegou" exige a ficha aberta, sempre ("para não ter atendimento sem
--      ficha"). A tela já pedia a ficha; a RPC aceitava p_episodio nulo.
-- A-14: "Não chegou" não tem volta, até abrir a ficha: se a recepção da UPA
--      depois abre a ficha desse paciente, o envio passa a "chegou". Antes só o
--      "não chegou" do prazo (12 h) voltava; o marcado pela recepção ficava
--      preso. Vale pela ficha que casa sozinha (gatilho) e pelo "Chegou" do
--      painel, que agora sempre leva a ficha. Não há outro jeito de desfazer.
--
-- Expand/contract: só troca trechos do corpo de duas funções. Idempotente
-- (trecho já trocado é pulado; trecho não achado aborta).
--
-- Rollback: as mesmas trocas com os pares invertidos; nenhum dado muda.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.fa_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. o painel: "chegou" só com a ficha; o "não chegou" volta com a ficha ───
SELECT pg_temp.fa_trocar('public.encaminhamento_upa_marcar_chegada(uuid, boolean, uuid, text)',
$a$  IF NOT (x.situacao = 'enviado' OR (x.situacao = 'nao_chegou' AND p_chegou AND x.chegada_por IS NULL)) THEN
    RAISE EXCEPTION 'Este envio não está esperando a chegada.';
  END IF;$a$,
$b$  IF NOT (x.situacao = 'enviado' OR (x.situacao = 'nao_chegou' AND p_chegou)) THEN
    RAISE EXCEPTION 'Este envio não está esperando a chegada.';
  END IF;
  IF p_chegou AND p_episodio IS NULL THEN
    RAISE EXCEPTION 'Abra a ficha do paciente em Nova ficha e escolha-a para registrar a chegada.';
  END IF;$b$);

-- ── 2. a ficha aberta depois também corrige o "não chegou" da recepção ──────
SELECT pg_temp.fa_trocar('private.encaminhamento_upa_chegada_pela_ficha()',
$a$       AND (u.situacao = 'enviado' OR (u.situacao = 'nao_chegou' AND u.chegada_por IS NULL))$a$,
$b$       AND u.situacao IN ('enviado', 'nao_chegou')$b$);

DROP FUNCTION pg_temp.fa_trocar(regprocedure, text[]);
