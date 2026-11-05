-- ════════════════════════════════════════════════════════════════════════════
-- Pendências da 5B, L1 (decisão do RT em 05/11/2026, "Sim, todas A";
-- diagnóstico em docs/faturamento/PENDENCIAS-5B-DIAGNOSTICO.md).
--
-- Defeito latente achado na 5B-6: public.conta_medicamentos_fora dava leitura
-- direta ao usuário logado, mas a política chama private.pode_ver_contas, que o
-- usuário não pode executar. A leitura direta daria erro. O app só lê pelas
-- funções (SECURITY DEFINER), que continuam iguais.
--
-- Correção: tirar a leitura direta, como nas tabelas das glosas
-- (20261204000001). Sem leitura direta, a política deixa de ter uso e sai.
-- Nada muda para o app. Idempotente.
-- Teste: supabase/tests/fase5_conta_medicamentos.sql
--
-- Rollback:
--   GRANT SELECT ON public.conta_medicamentos_fora TO authenticated;
--   CREATE POLICY conta_medicamentos_fora_leitura ON public.conta_medicamentos_fora FOR SELECT TO authenticated
--     USING (EXISTS (SELECT 1 FROM public.contas c WHERE c.id = conta_id AND private.pode_ver_contas(c.unidade_id)));
-- ════════════════════════════════════════════════════════════════════════════

REVOKE ALL ON public.conta_medicamentos_fora FROM anon, authenticated;
DROP POLICY IF EXISTS conta_medicamentos_fora_leitura ON public.conta_medicamentos_fora;
COMMENT ON TABLE public.conta_medicamentos_fora IS
  'Medicamento marcado fora da conta pelo faturamento (5B-3). Sem acesso direto: leitura e escrita só pelas funções da conta.';
