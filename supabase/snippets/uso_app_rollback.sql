-- Volta da migration 20270415000038 (uso do app, Fase 1 item 14).
-- Só apaga o que a migration criou: a tabela agregada (sem pessoa e sem
-- paciente) e as duas funções. Antes, tire do ar a versão do app que chama
-- registrar_uso_app (a chamada falha em silêncio, mas evita ruído no log).
BEGIN;
DROP FUNCTION IF EXISTS public.uso_app_painel(integer);
DROP FUNCTION IF EXISTS public.registrar_uso_app(uuid, text, text, text);
DROP TABLE IF EXISTS public.uso_app_diario;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270415000038';
COMMIT;
