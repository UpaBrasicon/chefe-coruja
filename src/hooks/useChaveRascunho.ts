import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { chaveDaAba, definirChave, temChave } from '@/lib/cofreLocal'

/**
 * Chave dos rascunhos cifrados (item 13 da Fase 0): pedida ao servidor depois
 * do segundo fator, antes de as telas lerem rascunho. Sem conexão, vale a cópia
 * que ficou nesta aba; sem nenhuma, segue sem chave (rascunho só na memória).
 * Devolve `true` quando dá para montar as telas.
 */
export function useChaveRascunho(ativo: boolean): boolean {
  const [pronto, setPronto] = React.useState(() => temChave())
  React.useEffect(() => {
    if (!ativo || temChave()) return
    let vivo = true
    const desistir = window.setTimeout(() => { if (vivo) { chaveDaAba(); setPronto(true) } }, 4000)
    void Promise.resolve(supabase.rpc('chave_rascunho')).then(
      ({ data, error }) => {
        if (!vivo) return
        if (!error && typeof data === 'string') definirChave(data)
        else chaveDaAba()
        window.clearTimeout(desistir)
        setPronto(true)
      },
      () => {
        if (!vivo) return
        chaveDaAba()
        window.clearTimeout(desistir)
        setPronto(true)
      },
    )
    return () => { vivo = false; window.clearTimeout(desistir) }
  }, [ativo])
  return pronto || temChave() || !ativo
}
