-- Rollback da migration 20270418000095 (SP1: desempenho do alerta de sepse).
-- Tira o painel, a lista de revisão, o cálculo dos casos e o registro do
-- alerta da internação. As funções do alerta (alertas_sepse, aviso da porta)
-- não foram mudadas pela migration e ficam como estão.
-- ATENÇÃO: apaga o registro dos disparos do alerta da internação; exportar
-- public.alertas_sepse_internacao antes, se houver dado real.
BEGIN;
DROP FUNCTION IF EXISTS public.casos_revisao_alerta_sepse(uuid, int, text);
DROP FUNCTION IF EXISTS public.desempenho_alerta_sepse(uuid, int);
DROP FUNCTION IF EXISTS private.sepse_agregado(jsonb);
DROP FUNCTION IF EXISTS private.sepse_casos(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.sofa_janela(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.registrar_alerta_sepse_internacao(uuid, uuid);
DROP TABLE IF EXISTS public.alertas_sepse_internacao;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270418000095';
COMMIT;
