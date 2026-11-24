-- ════════════════════════════════════════════════════════════════════════════
-- Rollback da migration 20270421000020_rede_secretaria.sql (rede a partir da
-- Secretaria).
--
-- Quando usar: se a tela Rede › Secretarias tiver de sair. Antes, voltar o
-- frontend para a versão sem a aba (o app chama admin_rede_arvore e
-- admin_unidade_na_rede; sem elas, só a aba Secretarias mostra erro).
--
-- O que se perde: as secretarias cadastradas e a ligação das unidades com
-- elas (secretaria_id e ramo_rede). Nada de paciente, escala ou vínculo muda.
-- A auditoria (secretaria_criada, secretaria_editada, unidade_na_rede) fica no
-- log_auditoria, que é só de inserção.
--
-- Se houver dado que importe, exporte antes:
--   COPY (SELECT * FROM public.secretarias) TO STDOUT WITH CSV HEADER;
--   COPY (SELECT id, secretaria_id, ramo_rede FROM public.unidades
--          WHERE secretaria_id IS NOT NULL OR ramo_rede IS NOT NULL) TO STDOUT WITH CSV HEADER;
--
-- Testado na homologação (kswurfyxxvfydpjfrivy) em transação desfeita.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP FUNCTION IF EXISTS public.admin_unidade_na_rede(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_salvar_secretaria(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.admin_rede_arvore();

DROP INDEX IF EXISTS public.unidades_secretaria_idx;
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_secretaria_mesma_org_fkey;
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_ramo_rede_check;
ALTER TABLE public.unidades DROP COLUMN IF EXISTS ramo_rede;
ALTER TABLE public.unidades DROP COLUMN IF EXISTS secretaria_id;

DROP TABLE IF EXISTS public.secretarias;

COMMIT;
