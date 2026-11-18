-- Rollback da migration 20270418000093 (LG9: registros de acesso por 6 meses).
-- Tira o agendamento, as funções e a tabela de guarda. O registro de acesso
-- que a rotina já apagou não volta (efeito pretendido do prazo de 6 meses).
-- A gravação do log do Auth no banco é do painel: para parar, ligar de novo
-- "Disable writing auth audit logs to project database".
-- Antes de rodar: conferir se há guarda vigente (SELECT * FROM
-- private.guardas_registros_acesso WHERE ate >= current_date). Se houver, a
-- guarda precisa ser cumprida de outro jeito antes de apagar a tabela.
BEGIN;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'lg9-registros-acesso-6-meses';
DROP FUNCTION IF EXISTS public.extrair_registros_acesso(uuid, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.anotar_guarda_registros_acesso(uuid, date, text);
DROP FUNCTION IF EXISTS private.apagar_registros_acesso_vencidos(int);
DROP TABLE IF EXISTS private.guardas_registros_acesso;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270418000093';
COMMIT;
