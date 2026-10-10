-- Fase 3, tarefa 1 (decisão do RT de 09/10/2026): papel novo "regulador", o
-- médico que autoriza (aprova ou rejeita) a AIH na unidade. Fica num arquivo
-- só, porque o valor novo do enum não pode ser usado na mesma transação em
-- que é criado. Só aditiva.
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'regulador';
