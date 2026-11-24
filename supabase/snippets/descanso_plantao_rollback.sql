-- Volta da migration 20270419000002 (divisão do descanso dos médicos, pedido 8).
-- Apaga a tabela das divisões (só horários de descanso de profissionais, sem
-- paciente) e as quatro funções. Antes, tire do ar a versão do app que chama
-- dividir_descanso e descanso_do_plantao.
BEGIN;
DROP FUNCTION IF EXISTS public.descanso_do_plantao(uuid);
DROP FUNCTION IF EXISTS public.dividir_descanso(uuid, timestamptz, timestamptz, integer, uuid[]);
DROP FUNCTION IF EXISTS public.medicos_para_descanso(uuid);
DROP FUNCTION IF EXISTS private.blocos_descanso(timestamptz, timestamptz, int, uuid[]);
DROP TABLE IF EXISTS public.descanso_divisoes;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270419000002';
COMMIT;
