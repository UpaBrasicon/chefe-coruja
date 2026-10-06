// ─────────────────────────────────────────────────────────────────────────────
// Turnstile (Cloudflare) nas chamadas ao Auth feitas SEM sessão: login,
// primeiro acesso, recuperação de senha e desbloqueio da tela (Fase 0,
// tarefa 3 do BACKLOG.md).
//
// O login não passa pela borda do Cloudflare (o navegador fala direto com
// *.supabase.co), então quem confere o token é o próprio Supabase Auth
// (Authentication → Attack Protection → CAPTCHA, provedor Turnstile, chave
// secreta no painel). Aqui só se obtém o token e se entrega em
// `options.captchaToken`.
//
// Sem VITE_TURNSTILE_SITE_KEY no ambiente, nada aparece e nada é exigido —
// o código pode ir para o ar antes de o CAPTCHA ser ligado no Supabase. O
// token vale para UMA chamada: depois de cada tentativa, `resetar()`.
// ─────────────────────────────────────────────────────────────────────────────
import * as React from 'react'

import { TurnstileWidget } from './TurnstileWidget'

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || undefined
/**
 * Token do Turnstile para uma chamada ao Auth sem sessão.
 * `pronto` é verdadeiro quando há token (ou quando o Turnstile não está
 * configurado neste ambiente). Passe `captchaToken` em `options` e chame
 * `resetar()` depois de cada tentativa.
 */
export function useTurnstile() {
  const [token, setToken] = React.useState<string | null>(null)
  const [falha, setFalha] = React.useState<string | null>(null)
  const idRef = React.useRef<string | null>(null)
  const ativo = !!TURNSTILE_SITE_KEY
  const resetar = React.useCallback(() => {
    setToken(null)
    if (idRef.current && window.turnstile) window.turnstile.reset(idRef.current)
  }, [])
  const widget = TURNSTILE_SITE_KEY
    ? <TurnstileWidget sitekey={TURNSTILE_SITE_KEY} onToken={setToken} idRef={idRef} onFalha={setFalha} />
    : null
  return {
    ativo,
    pronto: !ativo || !!token,
    captchaToken: token ?? undefined,
    falha,
    resetar,
    widget,
  }
}
