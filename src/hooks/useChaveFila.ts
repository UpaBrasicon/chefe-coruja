import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { chaveFilaDaAba, definirChaveFila, migrarFilaAntiga, temChaveFila } from '@/lib/offline/fila'

/**
 * Chave da fila sem conexão (A em O1 a O5, RT em 05/11/2026): pedida ao
 * servidor depois do segundo fator. Sem resposta (sem rede), vale a cópia que
 * ficou nesta aba (O2). Com a chave, a fila antiga cifrada com a chave do
 * aparelho passa para ela (O3).
 */
export function useChaveFila(ativo: boolean, semResposta: boolean, perfilId: string | undefined) {
  React.useEffect(() => {
    if (!perfilId) return
    let vivo = true
    const migrar = () => { if (vivo) void migrarFilaAntiga(perfilId).catch(() => {}) }
    if (!ativo) {
      if (semResposta && !temChaveFila()) void chaveFilaDaAba().then((ok) => { if (ok) migrar() })
      return () => { vivo = false }
    }
    void Promise.resolve(supabase.rpc('chave_fila')).then(
      async ({ data, error }) => {
        if (!vivo) return
        if (!error && typeof data === 'string') await definirChaveFila(data)
        else await chaveFilaDaAba()
        migrar()
      },
      () => { if (vivo) void chaveFilaDaAba() },
    )
    return () => { vivo = false }
  }, [ativo, semResposta, perfilId])
}
