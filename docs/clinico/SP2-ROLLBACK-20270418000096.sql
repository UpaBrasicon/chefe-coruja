-- Rollback da migration 20270418000096 (SP2: laboratório do parceiro para a sepse).
-- Tira a referência dos exames da sepse, a leitura nova do número, a contagem
-- de recusas e volta private.sofa_janela à versão do SP1 (hora da liberação).
-- Os exames já aplicados ao catálogo das unidades ficam (são do gestor).
-- A coluna comparador sai; o valor_num já gravado fica como está.
BEGIN;
DROP TRIGGER IF EXISTS trg_exame_resultado_itens_valor ON public.exame_resultado_itens;
DROP FUNCTION IF EXISTS private.trg_valor_do_laudo();
DROP FUNCTION IF EXISTS private.valor_do_laudo(text);
DROP FUNCTION IF EXISTS public.recusas_laboratorio_sem_pedido(uuid, int);
DROP FUNCTION IF EXISTS public.aplicar_exames_sepse(uuid);
DROP TABLE IF EXISTS public.exames_referencia_sepse;
ALTER TABLE public.exame_resultado_itens DROP CONSTRAINT IF EXISTS exame_resultado_itens_comparador;
ALTER TABLE public.exame_resultado_itens DROP COLUMN IF EXISTS comparador;

-- private.sofa_janela como na migration 20270418000095 (SP1)
CREATE OR REPLACE FUNCTION private.sofa_janela(p_paciente uuid, p_de timestamptz, p_ate timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plaq numeric; v_creat numeric; v_bili numeric; v_pf numeric; v_suporte boolean;
  v_pam numeric; v_glasgow numeric; v_vaso int;
  p_resp int; p_coag int; p_hep int; p_cv int; p_snc int; p_renal int;
BEGIN
  -- exames com resultado vigente liberado na janela
  WITH it AS (
    SELECT i.loinc, private.norm(i.analito) AS an, i.valor_num AS v, lower(coalesce(i.unidade, '')) AS un, r.liberado_em AS em
      FROM public.exame_resultado_itens i
      JOIN public.exame_resultados r ON r.id = i.resultado_id AND r.vigente
      JOIN public.exames_pedidos x ON x.id = r.exame_id
     WHERE x.paciente_id = p_paciente AND r.liberado_em >= p_de AND r.liberado_em <= p_ate AND i.valor_num IS NOT NULL)
  SELECT
    min(CASE WHEN loinc IN ('777-3', '26515-7') OR an ~ 'plaquet' THEN CASE WHEN v > 2000 THEN v / 1000 ELSE v END END),
    max(CASE WHEN loinc = '2160-0' OR an ~ 'creatinin' THEN CASE WHEN un ~ 'mol' THEN v / 88.4 ELSE v END END),
    max(CASE WHEN loinc = '1975-2' OR an ~ 'bilirrubina total' THEN CASE WHEN un ~ 'mol' THEN v / 17.1 ELSE v END END),
    min(CASE WHEN loinc = '2703-7' OR an ~ '^(pao2|po2|pressao parcial de o)' THEN
          (CASE WHEN un ~ 'kpa' THEN v * 7.5 ELSE v END) /
          coalesce((SELECT CASE WHEN o.valor_num > 1 THEN o.valor_num / 100 ELSE o.valor_num END
                      FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'fio2'
                     WHERE o.paciente_id = p_paciente AND o.aferido_em <= it.em AND o.aferido_em >= it.em - interval '6 hours'
                       AND o.valor_num > 0
                     ORDER BY o.aferido_em DESC LIMIT 1), 0.21) END)
    INTO v_plaq, v_creat, v_bili, v_pf
    FROM it;

  -- sinais vitais na janela
  SELECT
    min(CASE WHEN c.nome = 'glasgow' THEN o.valor_num END),
    max(CASE WHEN c.nome = 'drogas-vasoativas' THEN o.valor_num END),
    bool_or(c.nome = 'suporte-respiratorio' AND op.valor IN ('vni', 'vmi'))
    INTO v_glasgow, v_vaso, v_suporte
    FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id
    LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
   WHERE o.paciente_id = p_paciente AND o.aferido_em >= p_de AND o.aferido_em <= p_ate;
  -- PAM: a registrada ou (PAS + 2 PAD) / 3 da mesma aferição
  SELECT min(coalesce(pam, (pas + 2 * pad) / 3)) INTO v_pam FROM (
    SELECT max(CASE WHEN c.nome = 'pressao-arterial-media' THEN o.valor_num END) pam,
           max(CASE WHEN c.nome = 'pressao-arterial-sistolica' THEN o.valor_num END) pas,
           max(CASE WHEN c.nome = 'pressao-arterial-diastolica' THEN o.valor_num END) pad
      FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
     WHERE o.paciente_id = p_paciente AND o.aferido_em >= p_de AND o.aferido_em <= p_ate
       AND c.nome IN ('pressao-arterial-media', 'pressao-arterial-sistolica', 'pressao-arterial-diastolica')
     GROUP BY o.aferido_em) x;

  p_resp := CASE WHEN v_pf IS NULL THEN 0 WHEN v_pf < 100 AND v_suporte THEN 4 WHEN v_pf < 200 AND v_suporte THEN 3
                 WHEN v_pf < 300 THEN 2 WHEN v_pf < 400 THEN 1 ELSE 0 END;
  p_coag := CASE WHEN v_plaq IS NULL THEN 0 WHEN v_plaq < 20 THEN 4 WHEN v_plaq < 50 THEN 3 WHEN v_plaq < 100 THEN 2
                 WHEN v_plaq < 150 THEN 1 ELSE 0 END;
  p_hep := CASE WHEN v_bili IS NULL THEN 0 WHEN v_bili >= 12 THEN 4 WHEN v_bili >= 6 THEN 3 WHEN v_bili >= 2 THEN 2
                WHEN v_bili >= 1.2 THEN 1 ELSE 0 END;
  -- vasoativo: pelo sinal vital (número de drogas) ou pela prescrição ativa na janela
  p_cv := CASE
    WHEN coalesce(v_vaso, 0) >= 1 OR EXISTS (
      SELECT 1 FROM public.prescricao_itens pi JOIN public.prescricoes pr ON pr.id = pi.prescricao_id
        LEFT JOIN public.medicamento m ON m.id = pi.medicamento_id
       WHERE pr.paciente_id = p_paciente AND pi.created_at <= p_ate AND (pi.suspenso_em IS NULL OR pi.suspenso_em >= p_de)
         AND private.norm(coalesce(m.principio_ativo, '') || ' ' || pi.descricao) ~ '(noradrenalina|norepinefrina|adrenalina|epinefrina|vasopressina|dopamina)')
      THEN 3
    WHEN EXISTS (
      SELECT 1 FROM public.prescricao_itens pi JOIN public.prescricoes pr ON pr.id = pi.prescricao_id
        LEFT JOIN public.medicamento m ON m.id = pi.medicamento_id
       WHERE pr.paciente_id = p_paciente AND pi.created_at <= p_ate AND (pi.suspenso_em IS NULL OR pi.suspenso_em >= p_de)
         AND private.norm(coalesce(m.principio_ativo, '') || ' ' || pi.descricao) ~ '(dobutamina|milrinona)')
      THEN 2
    WHEN v_pam < 70 THEN 1 ELSE 0 END;
  p_snc := CASE WHEN v_glasgow IS NULL THEN 0 WHEN v_glasgow < 6 THEN 4 WHEN v_glasgow < 10 THEN 3 WHEN v_glasgow < 13 THEN 2
                WHEN v_glasgow < 15 THEN 1 ELSE 0 END;
  p_renal := CASE WHEN v_creat IS NULL THEN 0 WHEN v_creat >= 5 THEN 4 WHEN v_creat >= 3.5 THEN 3 WHEN v_creat >= 2 THEN 2
                  WHEN v_creat >= 1.2 THEN 1 ELSE 0 END;

  RETURN jsonb_build_object(
    'total', p_resp + p_coag + p_hep + p_cv + p_snc + p_renal,
    'respiratorio', p_resp, 'coagulacao', p_coag, 'hepatico', p_hep, 'cardiovascular', p_cv, 'neurologico', p_snc, 'renal', p_renal,
    'tem_plaquetas', v_plaq IS NOT NULL, 'tem_creatinina', v_creat IS NOT NULL, 'tem_bilirrubina', v_bili IS NOT NULL,
    'tem_pao2', v_pf IS NOT NULL, 'tem_glasgow', v_glasgow IS NOT NULL, 'tem_pam', v_pam IS NOT NULL);
END $$;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270418000096';
COMMIT;
