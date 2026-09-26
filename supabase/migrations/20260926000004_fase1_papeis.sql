-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — os oito papéis do glossário (produto/CONTEXT.md; ADR 0008).
--
-- Recepção, Técnico de Enfermagem, Enfermeiro, Farmacêutico e Telemedicina
-- entram no enum. Nascem SEM acesso clínico: toda policy existente confere
-- papéis específicos (gestor, plantonista, admin), então os novos falham
-- fechados até a Fase 2 criar as telas e as regras deles.
--
-- Arquivo separado do que usa os valores: o Postgres não deixa usar um valor
-- de enum na mesma transação em que ele foi criado.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'enfermeiro';
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'tecnico_enfermagem';
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'recepcao';
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'farmaceutico';
ALTER TYPE public.papel ADD VALUE IF NOT EXISTS 'telemedicina';
