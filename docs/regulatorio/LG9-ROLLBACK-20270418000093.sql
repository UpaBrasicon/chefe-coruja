-- Rollback da migration 20270418000093 (LG9: registros de acesso por 6 meses).
-- Tira o gatilho em auth.sessions, o agendamento, as funções e as tabelas.
-- ATENÇÃO: apagar private.registros_acesso_aplicacao apaga os registros de
-- acesso guardados, que o Marco Civil (art. 15) manda manter por 6 meses.
-- Antes de rodar:
--   1. conferir se há guarda vigente:
--      SELECT * FROM private.guardas_registros_acesso WHERE ate >= current_date;
--   2. exportar a tabela de registros para o cofre da guarda (LG4), se for
--      voltar atrás depois de a produção ter registros.
-- Para só parar de gravar, sem apagar nada, basta o primeiro comando abaixo.
BEGIN;
DROP TRIGGER IF EXISTS lg9_registro_acesso ON auth.sessions;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'lg9-registros-acesso-6-meses';
DROP FUNCTION IF EXISTS public.extrair_registros_acesso(uuid, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.anotar_guarda_registros_acesso(uuid, date, text);
DROP FUNCTION IF EXISTS private.apagar_registros_acesso_vencidos(int);
DROP FUNCTION IF EXISTS private.registrar_acesso_aplicacao();
DROP TABLE IF EXISTS private.guardas_registros_acesso;
DROP TABLE IF EXISTS private.registros_acesso_aplicacao;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270418000093';
COMMIT;
