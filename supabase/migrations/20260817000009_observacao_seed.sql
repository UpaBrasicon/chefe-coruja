-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2 — Seed de conceitos globais (unidade_id = NULL)
--
-- Sinais vitais, laboratórios (hemograma, função renal, eletrólitos,
-- gasometria, necrose, coagulograma, PCR, lactato) e escores da Central
-- Clínica. IDs fixos (uuid v5 determinístico) para idempotência e para que a
-- migração de dados possa referenciar.
-- ─────────────────────────────────────────────────────────────────────────────

-- helper: uuid v5 determinístico a partir do nome (idempotente)
CREATE OR REPLACE FUNCTION private.uuid_conceito(p_nome text)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT md5('conceito:' || p_nome)::uuid
$$;

DO $$
DECLARE
  v_nome text;
BEGIN
  -- ══ SINAIS VITAIS ══════════════════════════════════════════════════════
  FOREACH v_nome IN ARRAY ARRAY[
    'frequencia-cardiaca','frequencia-respiratoria','pressao-arterial-sistolica',
    'pressao-arterial-diastolica','pressao-arterial-media','saturacao-o2',
    'temperatura','glicemia-capilar','peso','diurese','escala-dor','nivel-consciencia'
  ] LOOP
    INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
    VALUES (private.uuid_conceito(v_nome), NULL, v_nome, 'numerico', NULL, NULL, NULL, 10, 'sinal_vital')
    ON CONFLICT (unidade_id, nome) DO NOTHING;
  END LOOP;

  -- atualiza refs/ordem dos sinais vitais (upsert por nome global)
  UPDATE public.conceito SET unidade_padrao='bpm',  ref_min=60,  ref_max=100, ordem_exibicao=10 WHERE nome='frequencia-cardiaca'        AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='irpm', ref_min=12,  ref_max=20,  ordem_exibicao=20 WHERE nome='frequencia-respiratoria'   AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='mmHg', ref_min=90,  ref_max=139, ordem_exibicao=30 WHERE nome='pressao-arterial-sistolica' AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='mmHg', ref_min=60,  ref_max=89,  ordem_exibicao=40 WHERE nome='pressao-arterial-diastolica' AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='mmHg', ref_min=70,  ref_max=105, ordem_exibicao=50 WHERE nome='pressao-arterial-media'    AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='%',    ref_min=92,  ref_max=100, ordem_exibicao=60 WHERE nome='saturacao-o2'            AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='°C',   ref_min=36,  ref_max=37.8, ordem_exibicao=70 WHERE nome='temperatura'            AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='mg/dL',ref_min=70,  ref_max=99,  ordem_exibicao=80 WHERE nome='glicemia-capilar'        AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='kg',   ref_min=NULL, ref_max=NULL, ordem_exibicao=90 WHERE nome='peso'                  AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao='mL',   ref_min=NULL, ref_max=NULL, ordem_exibicao=100 WHERE nome='diurese'               AND unidade_id IS NULL;
  UPDATE public.conceito SET unidade_padrao=NULL,   ref_min=0,  ref_max=3,   ordem_exibicao=110 WHERE nome='escala-dor'            AND unidade_id IS NULL;

  -- escala-dor é escore (0–10); ajusta tipo
  UPDATE public.conceito SET tipo='escore', unidade_padrao=NULL, ref_min=0, ref_max=3 WHERE nome='escala-dor' AND unidade_id IS NULL;

  -- nível de consciência: categórico
  UPDATE public.conceito SET tipo='categorico', unidade_padrao=NULL, ref_min=NULL, ref_max=NULL WHERE nome='nivel-consciencia' AND unidade_id IS NULL;
  INSERT INTO public.conceito_opcao (conceito_id, rotulo, valor, ordem)
  SELECT private.uuid_conceito('nivel-consciencia'), r.rotulo, r.valor, r.ordem
  FROM (VALUES
    ('Alerta','A',1),('Confuso','C',2),('Sonolento','S',3),('Coma','K',4)
  ) AS r(rotulo, valor, ordem)
  ON CONFLICT (conceito_id, rotulo) DO NOTHING;

  -- ══ LABORATÓRIO ═════════════════════════════════════════════════════════
  -- hemograma
  INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
  VALUES
    (private.uuid_conceito('hemoglobina'),        NULL,'hemoglobina',        'numerico','g/dL',    12.0, 17.5, 200, 'laboratorio'),
    (private.uuid_conceito('hematocrito'),        NULL,'hematocrito',        'numerico','%',       36.0, 52.0, 210, 'laboratorio'),
    (private.uuid_conceito('leucocitos'),         NULL,'leucocitos',         'numerico','/mm³',    4000, 11000, 220, 'laboratorio'),
    (private.uuid_conceito('plaquetas'),          NULL,'plaquetas',          'numerico','/mm³',    150000, 450000, 230, 'laboratorio'),
    (private.uuid_conceito('neutrofilos'),        NULL,'neutrofilos',        'numerico','%',       40,   80, 240, 'laboratorio'),
    (private.uuid_conceito('linfocitos'),         NULL,'linfocitos',         'numerico','%',       20,   50, 250, 'laboratorio')
  ON CONFLICT (unidade_id, nome) DO NOTHING;

  -- função renal + eletrólitos
  INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
  VALUES
    (private.uuid_conceito('creatinina'),   NULL,'creatinina',   'numerico','mg/dL', 0.6, 1.3, 300, 'laboratorio'),
    (private.uuid_conceito('ureia'),        NULL,'ureia',        'numerico','mg/dL', 15,  40,  310, 'laboratorio'),
    (private.uuid_conceito('sodio'),        NULL,'sodio',        'numerico','mEq/L', 135, 145, 320, 'laboratorio'),
    (private.uuid_conceito('potassio'),     NULL,'potassio',     'numerico','mEq/L', 3.5, 5.0, 330, 'laboratorio'),
    (private.uuid_conceito('cloro'),        NULL,'cloro',        'numerico','mEq/L', 98,  107, 340, 'laboratorio'),
    (private.uuid_conceito('magnesio'),     NULL,'magnesio',     'numerico','mg/dL', 1.7, 2.2, 350, 'laboratorio'),
    (private.uuid_conceito('calcio-total'), NULL,'calcio-total', 'numerico','mg/dL', 8.5, 10.5, 360, 'laboratorio')
  ON CONFLICT (unidade_id, nome) DO NOTHING;

  -- gasometria
  INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
  VALUES
    (private.uuid_conceito('ph'),       NULL,'ph',        'numerico',NULL,  7.35, 7.45, 400, 'laboratorio'),
    (private.uuid_conceito('pco2'),     NULL,'pco2',      'numerico','mmHg',35,   45,   410, 'laboratorio'),
    (private.uuid_conceito('po2'),      NULL,'po2',       'numerico','mmHg',80,   100,  420, 'laboratorio'),
    (private.uuid_conceito('bicarbonato'),NULL,'bicarbonato','numerico','mEq/L',22, 26, 430, 'laboratorio'),
    (private.uuid_conceito('lactato'),  NULL,'lactato',   'numerico','mmol/L',0.5, 2.2, 440, 'laboratorio')
  ON CONFLICT (unidade_id, nome) DO NOTHING;

  -- marcadores de necrose
  INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
  VALUES
    (private.uuid_conceito('troponina-i'), NULL,'troponina-i', 'numerico','ng/mL', 0, 0.04, 500, 'laboratorio'),
    (private.uuid_conceito('ck-mb'),       NULL,'ck-mb',       'numerico','ng/mL', 0, 5,    510, 'laboratorio')
  ON CONFLICT (unidade_id, nome) DO NOTHING;

  -- coagulograma + PCR
  INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
  VALUES
    (private.uuid_conceito('inr'),        NULL,'inr',        'numerico',NULL,   0.9, 1.2, 600, 'laboratorio'),
    (private.uuid_conceito('ttpa'),       NULL,'ttpa',       'numerico','seg',  25,  35,  610, 'laboratorio'),
    (private.uuid_conceito('tp'),         NULL,'tp',         'numerico','seg',  10,  14,  620, 'laboratorio'),
    (private.uuid_conceito('fibrinogenio'),NULL,'fibrinogenio','numerico','mg/dL',200, 400, 630, 'laboratorio'),
    (private.uuid_conceito('pcr'),        NULL,'pcr',        'numerico','mg/L', 0,   3,   640, 'laboratorio')
  ON CONFLICT (unidade_id, nome) DO NOTHING;

  -- ══ ESCORES (Central Clínica) ═══════════════════════════════════════════
  INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
  VALUES
    (private.uuid_conceito('escore-saps3'),     NULL,'escore-saps3',     'escore',NULL,NULL,NULL,1000,'escore'),
    (private.uuid_conceito('escore-pesi'),      NULL,'escore-pesi',      'escore',NULL,NULL,NULL,1010,'escore'),
    (private.uuid_conceito('escore-nihss'),     NULL,'escore-nihss',     'escore',NULL,NULL,NULL,1020,'escore'),
    (private.uuid_conceito('escore-news'),      NULL,'escore-news',      'escore',NULL,NULL,NULL,1030,'escore'),
    (private.uuid_conceito('escore-news2'),     NULL,'escore-news2',     'escore',NULL,NULL,NULL,1040,'escore'),
    (private.uuid_conceito('escore-timi'),      NULL,'escore-timi',      'escore',NULL,NULL,NULL,1050,'escore'),
    (private.uuid_conceito('escore-hacor'),     NULL,'escore-hacor',     'escore',NULL,NULL,NULL,1060,'escore'),
    (private.uuid_conceito('escore-ri-ratio'),  NULL,'escore-ri-ratio',  'escore',NULL,NULL,NULL,1070,'escore')
  ON CONFLICT (unidade_id, nome) DO NOTHING;

  -- vínculos LOINC (fk opcional p/ terminologia.loinc)
  UPDATE public.conceito SET loinc_codigo = '2339-0'  WHERE nome='glicemia-capilar'      AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '718-7'   WHERE nome='hemoglobina'           AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '6690-2'  WHERE nome='leucocitos'            AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '777-3'   WHERE nome='plaquetas'             AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '2160-0'  WHERE nome='creatinina'            AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '3094-0'  WHERE nome='ureia'                 AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '2951-2'  WHERE nome='sodio'                 AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '2823-3'  WHERE nome='potassio'              AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '2744-1'  WHERE nome='pco2'                  AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '2703-7'  WHERE nome='po2'                   AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '1963-8'  WHERE nome='bicarbonato'           AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '2524-7'  WHERE nome='lactato'               AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '10839-9' WHERE nome='troponina-i'           AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '34714-6' WHERE nome='inr'                   AND unidade_id IS NULL;
  UPDATE public.conceito SET loinc_codigo = '11039-5' WHERE nome='pcr'                   AND unidade_id IS NULL;

END $$;

-- ===========================================================================
-- DOWN — reverter:
--   DELETE FROM public.conceito_opcao WHERE conceito_id IN (SELECT id FROM public.conceito WHERE unidade_id IS NULL);
--   DELETE FROM public.conceito WHERE unidade_id IS NULL;
--   DROP FUNCTION private.uuid_conceito(text);
-- ===========================================================================
