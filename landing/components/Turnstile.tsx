'use client'

// Turnstile (Cloudflare) do formulário de contato (S10, H3 = A). O token vai no
// corpo do pedido à função pedir-demonstracao, que o confere na Cloudflare com o
// TURNSTILE_SECRET. O token vale para UM envio: depois de cada tentativa,
// `resetar()`. Mesma forma do widget do app (src/components/seguranca/).
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

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
      reject(new Error('Não foi possível carregar a verificação anti-robô. Recarregue a página.'))
    }
    document.head.appendChild(s)
  })
  return carregando
}

function TurnstileWidget({ sitekey, onToken, idRef, onFalha }: {
  sitekey: string
  onToken: (t: string | null) => void
  idRef: MutableRefObject<string | null>
  onFalha: (m: string | null) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let vivo = true
    carregarApi().then((api) => {
      if (!vivo || !el.current) return
      idRef.current = api.render(el.current, {
        sitekey,
        language: 'pt-br',
        // só aparece quando a Cloudflare precisa de interação; no resto é invisível
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

/** Token do Turnstile para um envio do formulário. */
export function useTurnstile(sitekey: string) {
  const [token, setToken] = useState<string | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const idRef = useRef<string | null>(null)
  const resetar = useCallback(() => {
    setToken(null)
    if (idRef.current && window.turnstile) window.turnstile.reset(idRef.current)
  }, [])
  return {
    token,
    falha,
    resetar,
    widget: <TurnstileWidget sitekey={sitekey} onToken={setToken} idRef={idRef} onFalha={setFalha} />,
  }
}
