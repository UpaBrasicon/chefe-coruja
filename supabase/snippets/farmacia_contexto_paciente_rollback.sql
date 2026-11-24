-- Volta da migration 20270422000040 (VA1 e DI3 da revisão do perfil
-- Farmacêutico, RT 24/11/2026).
-- Só apaga as duas funções; nenhuma tabela, coluna ou política foi criada, e
-- itens_para_dispensar e fila_validacao não mudaram. As linhas "Validação da
-- farmácia" já gravadas em log_acesso_prontuario ficam (guarda). Antes, tire do
-- ar a versão do app que chama contexto_paciente_farmacia e pacientes_das_faltas
-- (a tela volta a dizer que idade e alergias não chegam à farmácia).
BEGIN;
DROP FUNCTION IF EXISTS public.contexto_paciente_farmacia(uuid, uuid);
DROP FUNCTION IF EXISTS public.pacientes_das_faltas(uuid);
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270422000040';
COMMIT;
