-- Decisão do RT de 25/11/2026 (complemento do B-07 e do B-09 do teste de fluxo B):
-- para o NIR, "de plantão" conta o SETOR em que ele está escalado agora
-- (enfermaria, sala vermelha, UTI etc.), não a unidade inteira: o NIR só age
-- sobre pacientes do setor da sua escala ativa, como o médico.
-- Vale para: as ações da origem no pedido de regulação (20270426000020), o
-- lançamento na planilha de exames e a leitura dos exames (20270426000023 e 025).
-- Sem paciente na pergunta (ex.: antes de escolher o paciente) e para paciente
-- que já saiu da origem, vale a escala ativa na unidade. Gestor e regulador da
-- central seguem sem depender do plantão. Só funções e uma política; idempotente.

CREATE OR REPLACE FUNCTION private.regulacao_exigir_plantao(p_unidade uuid, p_paciente uuid, p_central uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_med boolean; v_nir boolean; v_escala boolean; v_aberto boolean;
BEGIN
  IF p_central IS NOT NULL AND coalesce(private.tenho_papel(p_central, 'regulador'), false) THEN RETURN; END IF;
  IF coalesce(private.tenho_papel(p_unidade, 'gestor'), false) THEN RETURN; END IF;
  v_med := coalesce(private.tenho_papel(p_unidade, 'plantonista'), false);
  v_nir := coalesce(private.sou_nir(p_unidade), false);
  -- quem não é médico nem NIR da origem é recusado pelo papel, na própria função
  IF NOT (v_med OR v_nir) THEN RETURN; END IF;
  v_escala := coalesce(private.na_escala_agora(p_unidade), false);
  v_aberto := p_paciente IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = p_paciente AND e.unidade_id = p_unidade AND e.encerrado_em IS NULL)
    OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.unidade_id = p_unidade AND i.data_alta IS NULL));
  -- médico e NIR: o paciente num setor da escala ativa da pessoa (RT, 25/11/2026)
  IF v_aberto AND coalesce(private.paciente_em_cuidado_no_plantao(p_paciente), false) THEN RETURN; END IF;
  IF NOT v_aberto AND v_escala THEN RETURN; END IF;
  RAISE EXCEPTION '%', CASE
      WHEN v_escala THEN 'Fora do plantão neste setor: o paciente não está num setor do seu plantão agora.'
      ELSE 'Fora do plantão: você não está de plantão agora nesta unidade (sem escala ativa ou com o check-out feito).' END
    USING ERRCODE = 'insufficient_privilege', HINT = 'fora_do_plantao';
END $$;

CREATE OR REPLACE FUNCTION private.pode_lancar_planilha(e public.exames_pedidos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT (coalesce(private.tenho_papel(e.unidade_id, 'plantonista'), false) OR coalesce(private.sou_nir(e.unidade_id), false))
     AND coalesce(private.paciente_em_cuidado_no_plantao(e.paciente_id), false)
$$;
CREATE OR REPLACE FUNCTION public.posso_lancar_planilha(p_internacao uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce((
    SELECT (coalesce(private.tenho_papel(i.unidade_id, 'plantonista'), false) OR coalesce(private.sou_nir(i.unidade_id), false))
       AND coalesce(private.paciente_em_cuidado_no_plantao(i.paciente_id), false)
      FROM public.internacoes i WHERE i.id = p_internacao), false)
$$;

-- leitura dos exames pelo NIR: só de paciente do setor da escala ativa
DO $m$
DECLARE def text; v_antigo constant text := 'OR (private.sou_nir(e.unidade_id) AND private.na_escala_agora(e.unidade_id))';
BEGIN
  def := replace(pg_get_functiondef('private.pode_ver_exame(public.exames_pedidos)'::regprocedure), E'\r', '');
  IF position(v_antigo IN def) > 0 THEN
    EXECUTE replace(def, v_antigo, 'OR (private.sou_nir(e.unidade_id) AND private.paciente_em_cuidado_no_plantao(e.paciente_id))');
  ELSIF position('private.sou_nir(e.unidade_id) AND private.paciente_em_cuidado_no_plantao(e.paciente_id)' IN def) = 0 THEN
    RAISE EXCEPTION 'private.pode_ver_exame mudou: a linha do NIR não foi encontrada';
  END IF;
END $m$;
DROP POLICY IF EXISTS exames_pedidos_nir_de_plantao ON public.exames_pedidos;
CREATE POLICY exames_pedidos_nir_de_plantao ON public.exames_pedidos
  FOR SELECT TO authenticated
  USING (private.sou_nir(unidade_id) AND private.paciente_em_cuidado_no_plantao(paciente_id));

-- ── Rollback ────────────────────────────────────────────────────────────────
-- private.regulacao_exigir_plantao como em 20270426000020; private.pode_lancar_planilha,
-- public.posso_lancar_planilha e a linha do NIR em private.pode_ver_exame como em
-- 20270426000023; a política exames_pedidos_nir_de_plantao como em 20270426000025.
