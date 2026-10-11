-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 12 — papéis de rede (decisões do RT de 11/10/2026). Os
-- valores novos do tipo papel ficam numa migration própria: um valor de enum
-- só pode ser usado depois que a transação que o criou termina.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'regulacao_regional';
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'faturamento_rede';
