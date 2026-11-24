-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes da revisão (RT, 24/11/2026), item 1: observação do gestor.
--
-- painel_observacao decidia "é gestor" com papel_na_unidade(p_unidade) =
-- 'gestor'. papel_na_unidade devolve só o papel mais forte do vínculo: a conta
-- com admin e gestor na mesma unidade (a do RT) recebia 'admin', caía no filtro
-- da escala e via 0 pacientes. Agora o gestor é quem TEM o papel gestor na
-- unidade (tenho_papel), ou o administrador geral. Ele vê todos os pacientes em
-- observação da unidade, como já era para o gestor de papel único.
-- Quem não é gestor continua pelo filtro da escala, sem mudança.
--
-- Troca de texto reaplicável; se o trecho não for achado, para.
-- ROLLBACK: docs/banco/ROLLBACK-20270421000070-079.sql (troca de volta).
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
  $old$  v_gestor boolean := private.papel_na_unidade(p_unidade) = 'gestor';$old$,
  $new$  -- conta com vários papéis (admin e gestor, por exemplo): vale o papel gestor (RT, 24/11/2026)
  v_gestor boolean := coalesce(private.eh_super_admin(), false) OR private.tenho_papel(p_unidade, 'gestor') IS TRUE;$new$);
