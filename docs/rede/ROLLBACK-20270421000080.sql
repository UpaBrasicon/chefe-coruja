-- ════════════════════════════════════════════════════════════════════════════
-- Rollback da migration 20270421000080_secretaria_boletim.sql (boletim
-- bimestral do Gestor da secretaria, metas do contrato e a linha de cada
-- unidade na Rede da secretaria).
--
-- Quando usar: se o que a 080 trouxe tiver de sair. Antes, voltar o frontend
-- para a versão sem estas telas: a aba Boletim e a aba Metas do contrato dos
-- Indicadores da secretaria (chamam secretaria_boletim, salvar_meta_contrato,
-- remover_meta_contrato e leem metas_contrato), a linha de estado na Rede da
-- secretaria (chama secretaria_estado_unidades) e a marca "estabilização" em
-- Setores e leitos (lê e grava setores.estabilizacao). Sem isso, as telas
-- mostram erro nesses pontos; o resto do app não usa nada daqui.
--
-- O que se perde:
--   • as metas do contrato gravadas (tabela metas_contrato). Se precisar
--     guardar, exporte antes:
--       COPY (SELECT * FROM public.metas_contrato) TO STDOUT WITH CSV HEADER;
--     A auditoria (meta_contrato_salva, meta_contrato_removida) fica no
--     log_auditoria, que é só de inserção.
--   • a marca de estabilização dos setores (setores.estabilizacao). A coluna
--     sai por último e só depois de o frontend voltar (a tela Setores e leitos
--     a lê); nenhuma função do banco fora desta migration a usa. Se o frontend
--     ainda estiver no ar, deixe a coluna (é expand: não atrapalha nada) e rode
--     só o resto.
--
-- Teste do rollback: rodar este arquivo na homologação depois da migration,
-- com o COMMIT do fim trocado por ROLLBACK (transação desfeita); o bloco de
-- conferência falha se algo ficar. Ainda não rodado: a migration não foi
-- aplicada em lugar nenhum.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── funções ───────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.secretaria_estado_unidades();
DROP FUNCTION IF EXISTS public.secretaria_boletim(uuid, date, date);
DROP FUNCTION IF EXISTS private.boletim_mes(uuid[], date);
DROP FUNCTION IF EXISTS private.boletim_cid_nome(text);
DROP FUNCTION IF EXISTS public.remover_meta_contrato(uuid);
DROP FUNCTION IF EXISTS public.salvar_meta_contrato(uuid, text, numeric, text, date, uuid, numeric, date, text);

-- ── metas do contrato ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS metas_contrato_select ON public.metas_contrato;
DROP TABLE IF EXISTS public.metas_contrato;
DROP FUNCTION IF EXISTS private.pode_definir_metas(uuid);

-- ── setor da estabilização (só com o frontend já sem a marca) ─────────────
ALTER TABLE public.setores DROP COLUMN IF EXISTS estabilizacao;

-- conferência
DO $$
BEGIN
  IF to_regprocedure('public.secretaria_boletim(uuid, date, date)') IS NOT NULL
     OR to_regprocedure('public.secretaria_estado_unidades()') IS NOT NULL
     OR to_regclass('public.metas_contrato') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'setores' AND column_name = 'estabilizacao') THEN
    RAISE EXCEPTION 'Rollback da 080 incompleto.';
  END IF;
  PERFORM 1 FROM public.setores LIMIT 1;
END $$;

-- Para testar sem gravar (homologação), troque o COMMIT por ROLLBACK.
COMMIT;
