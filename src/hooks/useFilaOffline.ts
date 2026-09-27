import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { sincronizarRelogio } from '@/lib/offline/relogio'
import { EVENTO_FILA, esvaziarFila, resumoFila } from '@/lib/offline/sincronizar'

/**
 * Mantém o relógio do servidor em dia e esvazia a fila local quando há
 * conexão: ao abrir, ao voltar a conexão e a cada minuto.
 */
export function useFilaOffline() {
  const { perfil } = useAuth()
  const perfilId = perfil?.id
  const [estado, setEstado] = React.useState({ pendentes: 0, recusados: 0, online: navigator.onLine })

  React.useEffect(() => {
    if (!perfilId) return
    let vivo = true
    const atualizar = () =>
      void resumoFila(perfilId)
        .then((r) => vivo && setEstado({ ...r, online: navigator.onLine }))
        .catch(() => undefined)
    const tentar = () => {
      if (!navigator.onLine) return atualizar()
      void sincronizarRelogio()
        .catch(() => undefined)
        .then(() => esvaziarFila(perfilId))
        .catch(() => undefined)
        .finally(atualizar)
    }
    tentar()
    const relogio = window.setInterval(tentar, 60_000)
    window.addEventListener('online', tentar)
    window.addEventListener('offline', atualizar)
    window.addEventListener(EVENTO_FILA, atualizar)
    return () => {
      vivo = false
      window.clearInterval(relogio)
      window.removeEventListener('online', tentar)
      window.removeEventListener('offline', atualizar)
      window.removeEventListener(EVENTO_FILA, atualizar)
    }
  }, [perfilId])

  return estado
}
