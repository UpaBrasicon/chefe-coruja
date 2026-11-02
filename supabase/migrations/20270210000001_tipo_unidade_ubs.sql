-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 1 (BACKLOG.md; decisões do RT em 02/11/2026, D1 = A): tipo de
-- unidade UBS. Valor novo no enum public.tipo_unidade.
--
-- Fica sozinho no arquivo: o valor novo só pode ser usado depois do commit.
-- Expansão pura; idempotente.
--
-- Rollback: o Postgres não tira valor de enum sem recriar o tipo (ALTER TYPE
-- destrutivo, proibido sem janela). O rollback é travar o uso:
--   ALTER TABLE public.unidades ADD CONSTRAINT unidades_sem_ubs CHECK (tipo <> 'ubs') NOT VALID;
-- (ver docs/ubs/TAREFA1-TIPO-UBS-DIAGNOSTICO.md).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TYPE public.tipo_unidade ADD VALUE IF NOT EXISTS 'ubs';
