import { ambienteDoBuild } from '@/lib/sentry'

/**
 * Teste do Sentry (Fase 0, item 11): com `?forcar-erro-sentry` na URL, fora da
 * produção, joga um erro "do motor de prescrição" pelo caminho real (ErroBoundary
 * → reportarErro → higienização → Sentry). A mensagem traz CPF, e-mail e id de
 * propósito — no Sentry eles têm que chegar como <doc>, <email> e <id>.
 */
export function ErroForcado() {
  if (ambienteDoBuild() === 'producao') return null
  if (new URLSearchParams(window.location.search).has('forcar-erro-sentry')) {
    throw new Error(
      'Teste do Sentry: erro forçado no motor de prescrição (CPF 123.456.789-09, contato teste@exemplo.com, ' +
        'prescrição 9b1c2d3e-0000-4000-8000-000000000001)'
    )
  }
  return null
}
