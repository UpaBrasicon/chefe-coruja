-- ════════════════════════════════════════════════════════════════════════════
-- Bug baixo B5 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md),
-- decisão do RT em 31/10/2026 (opção A, "Completar a lista",
-- docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md): private.papel_na_unidade (usada
-- em quase toda a RLS) ordenava admin, gestor, plantonista, telemedicina,
-- enfermeiro, técnico, farmacêutico e recepção; regulador, NIR, faturamento e
-- os papéis de rede ficavam fora da lista, e entre dois deles a ordem era
-- indefinida.
--
-- Correção: a lista ganha, depois da recepção, regulador, NIR, faturamento e
-- os papéis de rede (secretaria, regulação regional, faturamento da rede),
-- nessa ordem; um papel que venha a existir sem estar na lista fica por último,
-- e o nome desempata. A ordem dos que já estavam não muda: só muda o resultado
-- de quem tem dois dos papéis novos (antes, indefinido). Papel da lista antiga
-- com papel novo: a lista antiga continua ganhando.
-- Mesma assinatura, mesmo retorno; sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/papel_mais_forte.sql (cada par afetado)
--
-- Rollback:
--   reaplicar private.papel_na_unidade de 20260926000005_fase1_papeis_ordem.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.papel_na_unidade(unidade uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT v.papel::text
    FROM public.vinculos v
    WHERE v.perfil_id = private.meu_perfil_id()
      AND v.unidade_id = unidade
      AND v.ativo
    ORDER BY CASE v.papel
      WHEN 'admin'              THEN 0
      WHEN 'gestor'             THEN 1
      WHEN 'plantonista'        THEN 2
      WHEN 'telemedicina'       THEN 3
      WHEN 'enfermeiro'         THEN 4
      WHEN 'tecnico_enfermagem' THEN 5
      WHEN 'farmaceutico'       THEN 6
      WHEN 'recepcao'           THEN 7
      WHEN 'regulador'          THEN 8
      WHEN 'nir'                THEN 9
      WHEN 'faturamento'        THEN 10
      WHEN 'secretaria'         THEN 11
      WHEN 'regulacao_regional' THEN 12
      WHEN 'faturamento_rede'   THEN 13
      ELSE 99
    END, v.papel::text
    LIMIT 1), '');
$$;
