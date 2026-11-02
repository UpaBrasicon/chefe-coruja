-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 2, parte 2.1 (BACKLOG.md; decisões do RT em 02/11/2026, D5 = A):
-- tipo de setor 'consultorio'. Na UBS, a ficha abre num consultório
-- (20270211000002_atendimento_ubs.sql); na porta, segue o setor de emergência.
--
-- Migration só com o ALTER TYPE: o valor novo não pode ser usado na mesma
-- transação em que é criado. Idempotente.
-- Teste: supabase/tests/5a_atendimento_ubs.sql
--
-- Rollback (valor de enum não sai sem recriar o tipo): travar o uso.
--   ALTER TABLE public.setores ADD CONSTRAINT setores_sem_consultorio
--     CHECK (tipo <> 'consultorio') NOT VALID;
-- ════════════════════════════════════════════════════════════════════════════

ALTER TYPE public.tipo_setor ADD VALUE IF NOT EXISTS 'consultorio';
