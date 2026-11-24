-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK das migrations 20270421000070 a 20270421000079 (ajustes da revisão
-- do RT, 24/11/2026). Rodar na ordem inversa (do item mais alto ao 070), numa
-- transação, primeiro na homologação.
--
-- As funções trocadas por texto voltam pela troca inversa (o mesmo
-- trocar_uma_vez das migrations), o que devolve o corpo anterior exato. As
-- funções reescritas inteiras voltam com o corpo anterior completo, copiado do
-- banco da homologação em 24/11/2026 (igual ao do master).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- @@ITENS_SEGUINTES@@

-- ── 070: painel_observacao volta a decidir o gestor por papel_na_unidade ─────
SELECT pg_temp.trocar_uma_vez('public.painel_observacao(uuid)'::regprocedure,
  $new$  -- conta com vários papéis (admin e gestor, por exemplo): vale o papel gestor (RT, 24/11/2026)
  v_gestor boolean := coalesce(private.eh_super_admin(), false) OR private.tenho_papel(p_unidade, 'gestor') IS TRUE;$new$,
  $old$  v_gestor boolean := private.papel_na_unidade(p_unidade) = 'gestor';$old$);

COMMIT;
