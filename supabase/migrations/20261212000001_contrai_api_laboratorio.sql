-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 2, etapa 2.2 — contração. A Edge Function `api` publicada em
-- homologação e produção (20/10/2026, commit 42339e1) já chama
-- public.api_v1_fhir e public.api_fhir_pode_anexar (migration
-- 20261211000001_api_imagem.sql). As funções antigas da porta do laboratório
-- não têm mais quem as chame.
--
-- contract: sai a porta antiga do laboratório, trocada pela api_v1_fhir (expand em 20261211000001)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.api_v1_laboratorio(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.api_laboratorio_pode_anexar(text, uuid);
