-- ════════════════════════════════════════════════════════════════════════════
-- CORTE (fase 8, "contrair") — RASCUNHO. NÃO É MIGRATION E NÃO RODA SOZINHO.
--
-- Fica fora de supabase/migrations de propósito: apaga estruturas do banco de
-- produção e não tem volta. Rodar só depois de cumprir o passo a passo em
-- produto/docs/corte/PLANO-DO-CORTE.md, com a guarda exportada e conferida
-- (npm run guarda:exportar -- --linked ...; npm run guarda:conferir ...).
--
-- Cada bloco confere a pré-condição e PARA (RAISE) se ela não valer: nada é
-- apagado enquanto alguma função, policy ou tela ainda usar a estrutura.
-- Rodar primeiro no banco local (npx supabase db reset e depois este arquivo),
-- depois na produção pelo SQL Editor, bloco a bloco.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── pré-condição geral: nenhuma função ou policy cita as estruturas ─────────
DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(n.nspname || '.' || p.proname || ' → ' || t, ', ') INTO v
  FROM unnest(ARRAY['alta_paciente', 'transferencias_paciente', 'cuidados_plantonistas', 'mensagens_chat',
                    'acessos_plantonista', 'tem_acesso_atendimento']) t
  JOIN pg_proc p ON p.prosrc ILIKE '%' || t || '%'
  JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname IN ('public', 'private')
  WHERE NOT (p.proname = 'tem_acesso_atendimento' AND t = 'tem_acesso_atendimento');
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'CORTE PARADO: funções ainda usam estruturas antigas: %', v;
  END IF;
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v FROM pg_policies
   WHERE qual ILIKE ANY (ARRAY['%tem_acesso_atendimento%', '%acessos_plantonista%', '%cuidados_plantonistas%'])
      OR with_check ILIKE ANY (ARRAY['%tem_acesso_atendimento%', '%acessos_plantonista%', '%cuidados_plantonistas%']);
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'CORTE PARADO: policies ainda usam estruturas antigas: %', v;
  END IF;
END $$;

-- ── 1. chat antigo (substituído por conversas/chat_mensagens) ───────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.mensagens_chat WHERE created_at > now() - interval '30 days') THEN
    RAISE EXCEPTION 'CORTE PARADO: mensagens_chat recebeu mensagem nos últimos 30 dias';
  END IF;
END $$;
DROP TABLE IF EXISTS public.mensagens_chat;

-- ── 2. "sob cuidado de quem" da fase 2 (sem uso nas policies desde a fase 1) ─
DROP TABLE IF EXISTS public.cuidados_plantonistas;

-- ── 3. acesso pago (desligado em 26/09/2026; volta com regra própria) ───────
DROP TABLE IF EXISTS public.acessos_plantonista;
DROP FUNCTION IF EXISTS public.tem_acesso_atendimento(uuid);
DROP FUNCTION IF EXISTS private.tem_acesso_atendimento(uuid);

-- ── 4. alta e transferência legadas ─────────────────────────────────────────
-- Os registros são prontuário (guarda de 20 anos): NÃO se apagam. A tabela é
-- renomeada para o esquema de arquivo, só leitura, e sai do caminho do app.
CREATE SCHEMA IF NOT EXISTS arquivo;
REVOKE ALL ON SCHEMA arquivo FROM PUBLIC, anon, authenticated;
ALTER TABLE IF EXISTS public.alta_paciente SET SCHEMA arquivo;
ALTER TABLE IF EXISTS public.transferencias_paciente SET SCHEMA arquivo;

-- ── 5. escala: colunas data/turno do app antigo ─────────────────────────────
-- Só quando nenhuma tela gravar mais por (data, turno). O gatilho
-- trg_escala_janela deriva inicio/duracao_min delas; sem elas, o gestor grava
-- inicio/duracao_min direto. Deixado comentado de propósito:
-- ALTER TABLE public.escala_plantao DROP COLUMN data, DROP COLUMN turno;

-- Conferir o resultado e só então trocar para COMMIT.
ROLLBACK;
