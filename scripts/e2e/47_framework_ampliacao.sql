-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): o framework E2E passa
-- a conhecer as 9 contas novas da rede F5 (46_rede_fase5_ampliacao.sql).
-- Mesma função e2e.conta do 42, com TODOS os papéis antigos intactos e as contas
-- f5 16 a 24 acrescentadas. Rodar depois do 04, do 42 e do 46. Repetível.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION e2e.conta(p_papel text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_papel
    WHEN 'recepcao' THEN 'e2000000-0000-4000-8000-000000000001' WHEN 'enfermeiro' THEN 'e2000000-0000-4000-8000-000000000002'
    WHEN 'tecnico' THEN 'e2000000-0000-4000-8000-000000000003' WHEN 'plantonista' THEN 'e2000000-0000-4000-8000-000000000004'
    WHEN 'plantonista2' THEN 'e2000000-0000-4000-8000-000000000005' WHEN 'farmaceutico' THEN 'e2000000-0000-4000-8000-000000000006'
    WHEN 'regulador' THEN 'e2000000-0000-4000-8000-000000000007' WHEN 'nir' THEN 'e2000000-0000-4000-8000-000000000008'
    WHEN 'gestor' THEN 'e2000000-0000-4000-8000-000000000009' WHEN 'admin' THEN 'e2000000-0000-4000-8000-000000000010'
    WHEN 'faturamento' THEN 'e2000000-0000-4000-8000-000000000011' WHEN 'medico_hospital' THEN 'e2000000-0000-4000-8000-000000000012'
    WHEN 'medico_maternidade' THEN 'e2000000-0000-4000-8000-000000000013' WHEN 'medico_uti' THEN 'e2000000-0000-4000-8000-000000000014'
    -- destinos da coorte 2 (scripts/e2e/30_rede_coorte2.sql)
    WHEN 'medico_infantil' THEN 'e2000000-0000-4000-8000-000000000015' WHEN 'medico_altorisco' THEN 'e2000000-0000-4000-8000-000000000016'
    WHEN 'medico_psiquiatria' THEN 'e2000000-0000-4000-8000-000000000017' WHEN 'medico_queimados' THEN 'e2000000-0000-4000-8000-000000000018'
    WHEN 'medico_trauma' THEN 'e2000000-0000-4000-8000-000000000019' WHEN 'toxicologista' THEN 'e2000000-0000-4000-8000-000000000020'
    -- conta de outra organização (para permissão negativa)
    WHEN 'plantonista_outra_rede' THEN '10000000-0000-4000-8000-000000000002'
    -- portão da Fase 5 (scripts/e2e/40_rede_fase5.sql)
    WHEN 'f5_rec_ubs' THEN 'f5200000-0000-4000-8000-000000000001' WHEN 'f5_enf_ubs' THEN 'f5200000-0000-4000-8000-000000000002'
    WHEN 'f5_tec_ubs' THEN 'f5200000-0000-4000-8000-000000000003' WHEN 'f5_med_ubs' THEN 'f5200000-0000-4000-8000-000000000004'
    WHEN 'f5_ges_ubs' THEN 'f5200000-0000-4000-8000-000000000005' WHEN 'f5_rec_upa' THEN 'f5200000-0000-4000-8000-000000000006'
    WHEN 'f5_enf_upa' THEN 'f5200000-0000-4000-8000-000000000007' WHEN 'f5_med_upa' THEN 'f5200000-0000-4000-8000-000000000008'
    WHEN 'f5_ges_upa' THEN 'f5200000-0000-4000-8000-000000000009' WHEN 'f5_fat' THEN 'f5200000-0000-4000-8000-000000000010'
    WHEN 'f5_med_hosp' THEN 'f5200000-0000-4000-8000-000000000011' WHEN 'f5_regulador' THEN 'f5200000-0000-4000-8000-000000000012'
    WHEN 'f5_nir' THEN 'f5200000-0000-4000-8000-000000000013' WHEN 'f5_farm' THEN 'f5200000-0000-4000-8000-000000000014'
    WHEN 'f5_med_int' THEN 'f5200000-0000-4000-8000-000000000015'
    -- ampliação da rede F5 (scripts/e2e/46_rede_fase5_ampliacao.sql)
    WHEN 'f5_tec_upa' THEN 'f5200000-0000-4000-8000-000000000016' WHEN 'f5_tele' THEN 'f5200000-0000-4000-8000-000000000017'
    WHEN 'f5_admin' THEN 'f5200000-0000-4000-8000-000000000018' WHEN 'f5_secretaria' THEN 'f5200000-0000-4000-8000-000000000019'
    WHEN 'f5_reg_regional' THEN 'f5200000-0000-4000-8000-000000000020' WHEN 'f5_fat_rede' THEN 'f5200000-0000-4000-8000-000000000021'
    WHEN 'f5_rec_hosp' THEN 'f5200000-0000-4000-8000-000000000022' WHEN 'f5_ges_hosp' THEN 'f5200000-0000-4000-8000-000000000023'
    WHEN 'f5_enf_hosp' THEN 'f5200000-0000-4000-8000-000000000024'
  END::uuid
$$;

SELECT 'contas F5 ampliadas no framework' AS situacao,
       (SELECT count(*) FROM unnest(ARRAY['f5_tec_upa','f5_tele','f5_admin','f5_secretaria','f5_reg_regional','f5_fat_rede','f5_rec_hosp','f5_ges_hosp','f5_enf_hosp']) k
         JOIN public.perfis p ON p.id = e2e.conta(k)) AS contas_novas_com_perfil;
