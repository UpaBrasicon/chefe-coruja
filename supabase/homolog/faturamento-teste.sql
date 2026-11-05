-- Homologação: configuração de faturamento para testar o fechamento da conta
-- sem a liberação do gestor (pendências da 5B, L3; decisão do RT em 05/11/2026).
-- Só homologação. Idempotente. Valores de teste:
--   - códigos SIGTAP das fontes automáticas da UPA Homologação, escolhidos na
--     tabela SIGTAP carregada (competência 202609): atendimento médico em UPA,
--     acolhimento com classificação de risco e administração de medicamentos;
--   - CBO 225125 (médico clínico, tabela CBO) e um CNS provisório de teste
--     (começa com 7, dígito verificador válido, gerado para a homologação)
--     na conta "Teste Homologação", que faz todos os papéis na UPA.
-- A medicação continua com a pendência "CBO de enfermagem", porque a conta de
-- teste tem um só CBO. Raça/cor e sexo ausentes são pendências reais do cadastro.
DO $$
DECLARE
  v_unidade constant uuid := '31000000-0000-4000-8000-000000000001';
  v_perfil  constant uuid := '757db1d9-589d-461c-bed6-24adfed1fa29';
  v_cns     constant text := '729894104402279';
  f record;
BEGIN
  IF NOT private.cns_valido(v_cns) THEN RAISE EXCEPTION 'CNS de teste inválido'; END IF;
  UPDATE public.perfis SET cbo = '225125', cns = v_cns WHERE id = v_perfil;
  FOR f IN SELECT * FROM (VALUES ('atendimento_medico', '0301060096'), ('classificacao', '0301060118'), ('medicacao', '0301100012')) x(uso, proc) LOOP
    IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = f.proc) THEN
      RAISE EXCEPTION 'Procedimento % fora do SIGTAP carregado', f.proc;
    END IF;
    INSERT INTO public.bpa_procedimentos_unidade (unidade_id, procedimento, uso, definido_por)
    SELECT v_unidade, f.proc, f.uso, v_perfil
     WHERE NOT EXISTS (SELECT 1 FROM public.bpa_procedimentos_unidade
                        WHERE unidade_id = v_unidade AND uso = f.uso AND vigente_ate IS NULL);
  END LOOP;
END $$;
