-- ════════════════════════════════════════════════════════════════════════════
-- Achado da conferência das telas de 08/11/2026 (CONFERENCIA-TELAS-08NOV.md,
-- achado 1): na chegada regulada (20270308000001) e no aceite pelo destino, a
-- lista oferecia todos os leitos livres da unidade, inclusive os da porta
-- (EST · Porta do Hospital), e a chegada internava em qualquer setor.
-- Pedido do RT em 08/11/2026 ("Sim, corrige").
--
-- A regulação só usa leito de setor de internação, UTI ou isolamento — a
-- mesma regra da internação pela porta (registrar_desfecho):
--   • regulacao_leitos_destino lista só esses leitos;
--   • regulacao_destino_aceitar só reserva esses leitos;
--   • private.regulacao_internar_chegada só interna nesses leitos.
-- Filtro por público ou sexo (ex.: obstetrícia) não entra: fica para o RT.
--
-- Trocas de texto reaplicáveis; se um trecho não for achado, para.
-- ROLLBACK: tirar a condição "st.tipo IN ('internacao', 'uti', 'isolamento')"
-- e devolver a mensagem "Leito não encontrado nesta unidade." nas três funções.
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

SELECT pg_temp.trocar_uma_vez('public.regulacao_leitos_destino(uuid)'::regprocedure,
  $old$WHERE st.unidade_id = s.destino_unidade_id AND st.ativo AND l.ativo AND l.status = 'livre'$old$,
  $new$WHERE st.unidade_id = s.destino_unidade_id AND st.ativo AND l.ativo AND l.status = 'livre'
       AND st.tipo IN ('internacao', 'uti', 'isolamento')$new$);

SELECT pg_temp.trocar_uma_vez('public.regulacao_destino_aceitar(uuid, uuid, text)'::regprocedure,
  $old$     WHERE l.id = p_leito AND st.unidade_id = s.destino_unidade_id AND l.ativo AND st.ativo;
    IF v_ident IS NULL THEN RAISE EXCEPTION 'Leito não encontrado nesta unidade.'; END IF;$old$,
  $new$     WHERE l.id = p_leito AND st.unidade_id = s.destino_unidade_id AND l.ativo AND st.ativo
       AND st.tipo IN ('internacao', 'uti', 'isolamento');
    IF v_ident IS NULL THEN RAISE EXCEPTION 'Escolha um leito de internação, UTI ou isolamento desta unidade.'; END IF;$new$);

SELECT pg_temp.trocar_uma_vez('private.regulacao_internar_chegada(public.regulacao_solicitacoes, uuid, uuid)'::regprocedure,
  $old$   WHERE l.id = p_leito AND st.unidade_id = s.destino_unidade_id AND l.ativo AND st.ativo;
  IF v_setor IS NULL THEN RAISE EXCEPTION 'Leito não encontrado nesta unidade.'; END IF;$old$,
  $new$   WHERE l.id = p_leito AND st.unidade_id = s.destino_unidade_id AND l.ativo AND st.ativo
     AND st.tipo IN ('internacao', 'uti', 'isolamento');
  IF v_setor IS NULL THEN RAISE EXCEPTION 'Escolha um leito de internação, UTI ou isolamento desta unidade.'; END IF;$new$);
