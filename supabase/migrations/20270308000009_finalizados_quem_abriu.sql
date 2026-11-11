-- ════════════════════════════════════════════════════════════════════════════
-- Achado 3 da conferência das telas de 07/11/2026 (CONFERENCIA-TELAS.md): a
-- observação encerrada por "Observações que você abriu" não aparecia em
-- "Finalizados no plantão" para quem a abriu, porque painel_observacao só
-- lista os setores de observação da escala de agora. Decisão do RT em
-- 08/11/2026: A, a observação aparece só para quem abriu, nas 24 h depois do
-- encerramento.
--
-- painel_observacao(p_unidade), para quem não é gestor:
--   • sem setor de observação na escala, não sai mais na hora (a lista dos
--     setores fica vazia);
--   • entra também a observação que a pessoa abriu pela porta (autor do
--     desfecho "observação" do episódio) e que terminou nas últimas 24 h. Só
--     a finalizada: a aberta continua em "Observações que você abriu".
-- O médico escalado na observação e o gestor não mudam.
--
-- Trocas de texto reaplicáveis; se um trecho não for achado, para.
-- ROLLBACK: devolver "IF v_setores IS NULL THEN RETURN; END IF;" e tirar o
-- bloco marcado "quem abriu a observação pela porta".
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

SELECT pg_temp.trocar_uma_vez('public.painel_observacao(uuid)'::regprocedure,
  $old$  IF v_setores IS NULL THEN RETURN; END IF;$old$,
  $new$  -- sem setor de observação na escala, a lista dos setores fica vazia: quem
  -- abriu pela porta ainda vê as que terminaram (RT, 08/11/2026)
  IF v_setores IS NULL THEN
    IF v_gestor THEN RETURN; END IF;
    v_setores := '{}'::uuid[];
  END IF;$new$);

SELECT pg_temp.trocar_uma_vez('public.painel_observacao(uuid)'::regprocedure,
  $old$       AND NOT (i.status IN ('admitido', 'em_observacao', 'internado') AND private.setor_de_observacao(i.setor_atual_id))
  ), base AS ($old$,
  $new$       AND NOT (i.status IN ('admitido', 'em_observacao', 'internado') AND private.setor_de_observacao(i.setor_atual_id))
    UNION
    -- quem abriu a observação pela porta vê a que terminou nas últimas 24 h (RT, 08/11/2026)
    SELECT i.id, coalesce(ent.setor, i.setor_atual_id)
      FROM public.episodios ep0
      JOIN public.internacoes i ON i.id = (ep0.desfecho_detalhes ->> 'internacao_id')::uuid
      JOIN public.pendencias pe ON pe.internacao_id = i.id AND pe.tipo = 'observacao' AND pe.situacao <> 'aberta'
      LEFT JOIN LATERAL (
        SELECT (e.estado_depois ->> 'setor')::uuid AS setor FROM public.eventos_adt e
         WHERE e.internacao_id = i.id AND e.estado_depois ->> 'status' = 'em_observacao'
         ORDER BY e.seq DESC LIMIT 1) ent ON true
     WHERE NOT v_gestor
       AND ep0.unidade_id = p_unidade AND ep0.desfecho = 'observacao'
       AND ep0.desfecho_por = private.meu_perfil_id()
       AND i.unidade_id = p_unidade
       AND pe.resolvida_em >= now() - interval '24 hours'
       AND NOT (i.status IN ('admitido', 'em_observacao', 'internado') AND private.setor_de_observacao(i.setor_atual_id))
  ), base AS ($new$);
