// Widget do Turnstile (Cloudflare): carrega o script uma vez e desenha o
// desafio. O hook que o usa e a explicação ficam em ./Turnstile.tsx.
import * as React from 'react'

type OpcoesTurnstile = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
  language?: string
  appearance?: 'always' | 'execute' | 'interaction-only'
}
type ApiTurnstile = {
  render: (el: HTMLElement, opcoes: OpcoesTurnstile) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: ApiTurnstile
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let carregando: Promise<ApiTurnstile> | null = null
function carregarApi(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (carregando) return carregando
  carregando = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponível')))
    s.onerror = () => {
      carregando = null
      reject(new Error('Não foi possível carregar a verificação anti-robô'))
    }
    document.head.appendChild(s)
  })
  return carregando
}

export function TurnstileWidget({ sitekey, onToken, idRef, onFalha }: {
  sitekey: string
  onToken: (t: string | null) => void
  idRef: React.MutableRefObject<string | null>
  onFalha: (m: string | null) => void
}) {
  const el = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    let vivo = true
    carregarApi().then((api) => {
      if (!vivo || !el.current) return
      idRef.current = api.render(el.current, {
        sitekey,
        language: 'pt-br',
        // só aparece quando o Cloudflare precisa de interação; no resto é invisível
        appearance: 'interaction-only',
        callback: (t) => { onFalha(null); onToken(t) },
        'expired-callback': () => onToken(null),
        'error-callback': () => { onToken(null); onFalha('A verificação anti-robô falhou. Recarregue a página e tente de novo.') },
      })
    }, (e: Error) => vivo && onFalha(e.message))
    return () => {
      vivo = false
      const id = idRef.current
      idRef.current = null
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [sitekey, onToken, idRef, onFalha])
  return <div ref={el} className="flex justify-center empty:hidden" />
}

