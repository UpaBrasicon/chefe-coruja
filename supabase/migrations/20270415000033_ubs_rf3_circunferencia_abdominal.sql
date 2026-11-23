-- ════════════════════════════════════════════════════════════════════════════
-- Refinamento da UBS, RF3 = A (RT, 23/11/2026): circunferência abdominal nos
-- sinais vitais da UBS (tela do técnico e do enfermeiro, /sinais-vitais, e o
-- bloco de sinais da consulta). Diagnóstico em
-- docs/ubs/REFINAMENTO-UBS-DIAGNOSTICO.md.
--
-- Só expand: um conceito global novo, 'circunferencia-abdominal', em cm. A
-- gravação continua pela registrar_sinais_aps (migration 20270415000008), que
-- aceita qualquer conceito global existente; a carga da FAI do LEDI
-- (private.ledi_carga_fai, migration 20270415000022) já leva toda observação
-- do atendimento, e o arquivo da ficha põe o valor no campo 1 de MedicoesThrift
-- (circunferenciaAbdominal; IDL oficial laboratoriobridge/esusaps-integracao,
-- commit 9316f280f526; LEDI 8.7.0, dicionário da FAI: centímetros, uma casa
-- decimal, de 0.0 a 99999).
--
-- LOINC 8280-0 (Waist circumference at umbilicus by Tape measure) só se o
-- código estiver carregado (a FK exige), como na estatura.
--
-- Reaplicável: ON CONFLICT DO NOTHING e UPDATE só onde falta.
--
-- Rollback (testado na homologação, só sem observação gravada no conceito):
--   DELETE FROM public.conceito c
--    WHERE c.id = private.uuid_conceito('circunferencia-abdominal')
--      AND NOT EXISTS (SELECT 1 FROM public.observacao o WHERE o.conceito_id = c.id);
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.conceito (id, unidade_id, nome, tipo, unidade_padrao, ref_min, ref_max, ordem_exibicao, categoria)
VALUES (private.uuid_conceito('circunferencia-abdominal'), NULL, 'circunferencia-abdominal', 'numerico', 'cm', NULL, NULL, 93, 'sinal_vital')
ON CONFLICT DO NOTHING;  -- unidade_id nulo: a UNIQUE (unidade_id, nome) não pega; o id fixo, sim

UPDATE public.conceito c SET loinc_codigo = '8280-0'
 WHERE c.nome = 'circunferencia-abdominal' AND c.unidade_id IS NULL AND c.loinc_codigo IS NULL
   AND EXISTS (SELECT 1 FROM terminologia.loinc l WHERE l.codigo = '8280-0');
