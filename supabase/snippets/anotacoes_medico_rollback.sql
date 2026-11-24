-- Volta da migration 20270419000003 (anotações pessoais do médico, pedido 7).
-- Tira o agendamento diário e apaga a tabela (lembretes pessoais, sem paciente)
-- e as funções. Antes, tire do ar a versão do app que chama salvar_anotacao.
BEGIN;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'anotacoes-medico-30-dias';
DROP FUNCTION IF EXISTS public.salvar_anotacao(uuid, text);
DROP FUNCTION IF EXISTS public.marcar_anotacao(uuid, boolean, boolean);
DROP FUNCTION IF EXISTS public.apagar_anotacao(uuid);
DROP FUNCTION IF EXISTS private.apagar_anotacoes_vencidas();
DROP FUNCTION IF EXISTS private.sou_medico();
DROP TABLE IF EXISTS public.anotacoes_medico;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270419000003';
COMMIT;
