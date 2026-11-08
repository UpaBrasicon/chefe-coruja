import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { INTERVALO_CONFERENCIA_MS, versaoMudou } from '@/lib/versaoNova'

// Ver src/lib/versaoNova.ts. Confere quando a aba volta a ficar visível e a cada
// 5 min com ela visível. Só no build publicado (no dev o script é /src/main.tsx).

function scriptCarregado(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
  return s?.src ?? null
}

export function AvisoVersaoNova() {
  const [nova, setNova] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD || nova) return
    const carregado = scriptCarregado()
    if (!carregado) return
    let ativo = true

    async function conferir() {
      if (document.visibilityState !== 'visible') return
      try {
        const r = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
        if (!r.ok) return
        const html = await r.text()
        if (ativo && versaoMudou(carregado, html)) setNova(true)
      } catch {
        /* sem rede: confere na próxima */
      }
    }

    const t = window.setInterval(() => void conferir(), INTERVALO_CONFERENCIA_MS)
    const aoVoltar = () => void conferir()
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      ativo = false
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [nova])

  if (!nova) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100vw-40px)] max-w-[420px] -translate-x-1/2 items-center gap-3 rounded-container border border-fio bg-superficie px-4 py-3 shadow-toast"
    >
      <RefreshCw className="size-4 shrink-0 text-acao" aria-hidden />
      <p className="flex-1 text-apoio text-tinta">
        Há uma versão nova do Chefe Coruja. Salve o que estiver fazendo e atualize.
      </p>
      <Button size="sm" onClick={() => window.location.reload()}>
        Atualizar
      </Button>
    </div>
  )
}
