-- ════════════════════════════════════════════════════════════════════════════
-- LG8, contrato (pendência registrada no BACKLOG em 18/11/2026): a
-- solicitar_teleinterconsulta antiga deixa de ser chamada direto pelo usuário.
--
-- Desde a migration 20270418000092 (LG8, na produção em 18/11/2026) a tela usa
-- a solicitar_teleinterconsulta_com_termo, que grava o termo de consentimento
-- (Res. CFM 2.314/2022, art. 15) e chama a antiga por dentro. A antiga ainda
-- tinha EXECUTE para authenticated, então dava para pedir teleinterconsulta
-- sem termo chamando a RPC direto. Nenhuma tela chama a antiga (conferido em
-- src/ em 23/11/2026).
--
-- Contract: tira o EXECUTE de PUBLIC, anon e authenticated. A _com_termo é
-- SECURITY DEFINER e continua chamando a antiga como dona da função.
-- Reaplicável.
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.solicitar_teleinterconsulta(uuid, text, text, text, uuid) TO authenticated;
-- ════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.solicitar_teleinterconsulta(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
