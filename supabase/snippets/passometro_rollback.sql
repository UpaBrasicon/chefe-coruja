-- Volta da migration 20270419000001 (passômetro do médico, pedido 8).
-- Só apaga as três funções; nenhuma tabela foi criada e as pendências
-- (public.pendencias) não mudam. As linhas "Passômetro" já gravadas no
-- registro de acesso ao prontuário ficam (guarda). Antes, tire do ar a versão
-- do app que chama passometro.
BEGIN;
DROP FUNCTION IF EXISTS public.registrar_impressao_passometro(uuid);
DROP FUNCTION IF EXISTS public.passometro(uuid);
DROP FUNCTION IF EXISTS private.passometro_internacoes(uuid);
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270419000001';
COMMIT;
