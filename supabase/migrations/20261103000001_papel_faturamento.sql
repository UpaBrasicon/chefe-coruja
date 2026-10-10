-- Fase 3, tarefa 3 (decisão do RT de 09/10/2026): papel novo "faturamento",
-- sem escala, que fecha a competência do BPA e gera o arquivo do BPA
-- Magnético (e depois o BPA-C e a APAC). Fica num arquivo só, porque o valor
-- novo do enum não pode ser usado na mesma transação em que é criado. Só
-- aditiva.
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'faturamento';
