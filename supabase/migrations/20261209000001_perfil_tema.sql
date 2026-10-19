-- Trilha "Padrão do frontend", parte 4.1 (decisão do RT "2a", 19/10/2026):
-- a escolha de tema (claro, escuro ou automático) é da pessoa e vale em
-- qualquer aparelho. Só acrescenta coluna (expand). A pessoa grava a própria
-- linha pela policy perfis_update que já existe.
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS tema text NOT NULL DEFAULT 'automatico';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perfis_tema_valido') THEN
    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_tema_valido CHECK (tema IN ('claro', 'escuro', 'automatico'));
  END IF;
END $$;

COMMENT ON COLUMN public.perfis.tema IS
  'Tema da tela escolhido pela pessoa: claro, escuro ou automatico (segue o sistema do aparelho). Guia do padrão do frontend, 1.4.';
