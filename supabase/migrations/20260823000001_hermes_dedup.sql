-- ─────────────────────────────────────────────────────────────────────────────
-- HERMES v2 — deduplicação de incidentes (item A1 da auditoria 22/08)
--
-- PROBLEMA
--   • Falcão (Argos) roda 2x/dia e reinsere os MESMOS achados (mesma
--     prescrição órfã, mesmo leito) a cada execução → cerbero_incidentes
--     incha e o painel vira ruído.
--   • Gavião roda a cada 12h mas varre 24h de mensagens → cada achado é
--     analisado e inserido 2x.
--
-- SOLUÇÃO
--   Coluna `chave_dedup`: patrulha + titulo + id da evidência (estável por
--   achado). Índice único PARCIAL que só vale enquanto o incidente está
--   aberto ('aberto'/'em_analise') — então:
--     • problema contínuo NÃO duplica (mesma chave aberta já existe);
--     • problema que o admin resolveu e continua ocorrendo volta a gerar
--       incidente (reincidência real não fica silenciosa).
--   O insert usa pre-check no código (buscar chaves abertas e filtrar),
--   porque o PostgREST não emite o predicate do índice parcial no
--   ON CONFLICT; o índice fica como rede de segurança no banco.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cerbero_incidentes
  ADD COLUMN IF NOT EXISTS chave_dedup text;

-- Único incidente ABERTO por chave. Quando o incidente é resolvido ou
-- marcado falso_positivo, a chave sai do índice → reincidência reabre.
CREATE UNIQUE INDEX IF NOT EXISTS cerbero_incidentes_chave_dedup_aberto_idx
  ON public.cerbero_incidentes (chave_dedup)
  WHERE status IN ('aberto', 'em_analise');

-- ===========================================================================
-- DOWN
--   DROP INDEX IF EXISTS public.cerbero_incidentes_chave_dedup_aberto_idx;
--   ALTER TABLE public.cerbero_incidentes DROP COLUMN IF EXISTS chave_dedup;
-- ===========================================================================
