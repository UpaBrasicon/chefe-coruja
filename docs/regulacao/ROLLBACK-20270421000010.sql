-- ════════════════════════════════════════════════════════════════════════════
-- Volta da migration 20270421000010_regulacao_centrais_admin.sql
-- (regulamentação das centrais pelo administrador).
--
-- Tira só o que a migration criou. Fica como estava:
-- • public.centrais_regulacao — inclusive a central que um administrador
--   cadastrou numa organização que ainda não tinha (ela continua recebendo os
--   pedidos; troque pelo super admin, regulacao_definir_central, se precisar).
-- • public.regulacao_prazos_historico — as linhas com a chave 'por_tipo' ficam
--   como registro (só inserção); nada lê essa chave.
-- • log_auditoria (só inserção).
--
-- Perde: o cadastro das centrais, as unidades reguladas, as capacidades e os
-- prazos por tipo. Antes de rodar, guarde o que quiser manter:
--   SELECT public.regulacao_regulamentacao();  -- como administrador
-- Sem frontend novo em produção, rode antes a volta do PR (a tela chama as
-- funções abaixo).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP TRIGGER IF EXISTS trg_regulacao_central_no_cadastro ON public.centrais_regulacao;
DROP FUNCTION IF EXISTS private.regulacao_central_no_cadastro();
DROP FUNCTION IF EXISTS public.regulacao_definir_prazos_tipo(uuid, jsonb);
DROP FUNCTION IF EXISTS public.regulacao_salvar_capacidades(uuid, jsonb);
DROP FUNCTION IF EXISTS public.regulacao_definir_unidades_central(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.regulacao_retirar_central(uuid);
DROP FUNCTION IF EXISTS public.regulacao_cadastrar_central(uuid);
DROP FUNCTION IF EXISTS public.regulacao_regulamentacao();
DROP FUNCTION IF EXISTS private.regulacao_prazos_tipo_json(uuid);
DROP FUNCTION IF EXISTS private.regulacao_eh_central(uuid);
DROP FUNCTION IF EXISTS private.regulacao_exigir_admin_org(uuid);

DROP TABLE IF EXISTS public.regulacao_prazos_tipo;
DROP TABLE IF EXISTS public.regulacao_unidade_capacidades;
DROP TABLE IF EXISTS public.regulacao_central_unidades;
DROP TABLE IF EXISTS public.regulacao_centrais_cadastro;

COMMIT;
