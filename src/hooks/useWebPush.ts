import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/**
 * T1 — Web Push (base). Registra o service worker e inscreve o dispositivo para
 * receber notificações push. Requer VITE_VAPID_PUBLIC_KEY no .env.
 */
export function useWebPush(habilitado: boolean) {
  const [suportado] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window)
  const [inscrito, setInscrito] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!habilitado || !suportado || !VAPID_PUBLIC) return
    let ativo = true

    async function registrar() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        const permissao = await Notification.requestPermission()
        if (permissao !== 'granted') {
          setErro('Permissão de notificação negada.')
          return
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC,
        })
        // Salva a subscription no Supabase (função dedicada)
        const { error } = await supabase.rpc('salvar_push_subscription', {
          p_subscription: JSON.stringify(sub),
        })
        if (error) throw error
        if (ativo) setInscrito(true)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao ativar notificações push.')
      }
    }

    void registrar()
    return () => {
      ativo = false
    }
  }, [habilitado, suportado])

  return { suportado, inscrito, erro, habilitado: !!VAPID_PUBLIC }
}
