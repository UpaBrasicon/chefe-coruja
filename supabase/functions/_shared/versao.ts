// Versão publicada das Edge Functions (Fase 0, item 14 do BACKLOG.md).
// O deploy (`scripts/ambiente/supabase-alvo.mjs functions …`) troca este valor
// pelo commit e pela data antes de publicar, e devolve o original depois.
// Sai no cabeçalho `x-cc-versao` de toda resposta e como `release` no Sentry.
export const VERSAO = 'desenvolvimento'
