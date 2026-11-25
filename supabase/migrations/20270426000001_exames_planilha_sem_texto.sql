-- Teste de fluxo B (25/11/2026), achado B-01: o lançamento à mão da planilha de
-- exames (registrar_resultado_estruturado, EXM10) falhava sempre que vinha sem
-- texto livre, e a tela nunca manda texto. O CHECK exame_resultados_conteudo
-- pede texto ou PDF no resultado de origem "manual", e a função passava texto
-- nulo: "new row for relation exame_resultados violates check constraint".
--
-- Conserto: sem texto livre, o texto do resultado é o resumo dos valores
-- lançados ("Creatinina 0,9; Potássio 4,1"), o mesmo resumo que
-- private.gravar_resultado_exame já grava em exames_pedidos.resultado.
-- Sem mudança de regra: quem lança, o que entra (só nome e valor) e o crítico
-- (só do laboratório) seguem iguais. Não mexe em tabela nem no CHECK.
-- Idempotente: a troca não se repete.

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

SELECT pg_temp.trocar('public.registrar_resultado_estruturado(uuid, timestamptz, jsonb, text)'::regprocedure,
  'v_res := private.gravar_resultado_exame(e.id, ''manual'', nullif(btrim(coalesce(p_texto, '''')), ''''), NULL, NULL, v_itens,',
  'v_res := private.gravar_resultado_exame(e.id, ''manual'','
  || E'\n    -- sem texto livre, o resumo dos valores (o CHECK exame_resultados_conteudo pede texto no resultado manual)'
  || E'\n    coalesce(nullif(btrim(coalesce(p_texto, '''')), ''''),'
  || E'\n             (SELECT string_agg((x ->> ''analito'') || '' '' || (x ->> ''valor''), ''; '' ORDER BY o) FROM jsonb_array_elements(v_itens) WITH ORDINALITY t(x, o))),'
  || E'\n    NULL, NULL, v_itens,');

-- ── Rollback ────────────────────────────────────────────────────────────────
-- A troca inversa do trecho acima em public.registrar_resultado_estruturado
-- (voltar a passar nullif(btrim(coalesce(p_texto, '')), '') como texto). Os
-- resultados já lançados ficam com o resumo no texto; nada a desfazer neles.
