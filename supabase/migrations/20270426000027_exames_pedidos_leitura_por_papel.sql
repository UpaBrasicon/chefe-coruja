-- Decisão do RT de 25/11/2026 (achado B-11 do teste de fluxo B): a leitura
-- direta de exames_pedidos (pedidos e resultados) fica para médico, enfermagem
-- (enfermeiro e técnico) e NIR. Antes, a política olhava só a escala da pessoa
-- no setor do paciente, sem o papel: recepção ou farmacêutico escalados liam.
--
-- O que muda: o ramo do plantão da política exames_pedidos_select passa a
-- exigir papel de médico ou de enfermagem. O NIR lê pela política própria
-- (exames_pedidos_nir_de_plantao, 20270426000026: paciente no setor da escala).
-- O que NÃO muda, de propósito:
--   * o gestor da unidade segue lendo (ramo papel_na_unidade = 'gestor'): quatro
--     telas dele leem a tabela direto (Resumo do leito, marca "Aguardando exame"
--     da Observação, "puxar do prontuário" da regulação e a leitura do
--     prontuário). Fica como pergunta ao RT, para não quebrar tela;
--   * as políticas de acesso encerrado e de teleinterconsulta;
--   * tudo o que lê por RPC SECURITY DEFINER (faturamento, farmácia, boletim da
--     secretaria, indicadores, regulação, pacote de alta, laboratório).
-- Só política; idempotente.

DROP POLICY IF EXISTS exames_pedidos_select ON public.exames_pedidos;
CREATE POLICY exames_pedidos_select ON public.exames_pedidos
  FOR SELECT TO authenticated
  USING (
    private.papel_na_unidade(unidade_id) = 'gestor'
    OR (private.paciente_no_meu_plantao(paciente_id)
        AND (private.tenho_papel(unidade_id, 'plantonista') IS TRUE OR private.sou_enfermagem(unidade_id)))
  );

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS exames_pedidos_select ON public.exames_pedidos;
-- CREATE POLICY exames_pedidos_select ON public.exames_pedidos FOR SELECT TO authenticated
--   USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
