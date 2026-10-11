-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 11 — NIR (Núcleo Interno de Regulação), decisões do RT de
-- 11/10/2026. O valor novo do tipo papel fica numa migration própria: um valor
-- de enum só pode ser usado depois que a transação que o criou termina.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'nir';
