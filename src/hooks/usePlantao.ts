import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

export type StatusPlantao = 'carregando' | 'escala' | 'acesso' | 'fora'

/**
 * Verifica o plantão pelo RELÓGIO DO SERVIDOR (não depende do relógio do Windows).
 * Reavalia automaticamente a cada 60s, então a liberação/remoção de acesso acontece
 * sozinha quando o turno muda.
 */
export function usePlantao(unidadeId: string | undefined) {
  const [status, setStatus] = useState<StatusPlantao>('carregando')
  const [turno, setTurno] = useState<string | null>(null)

  useEffect(() => {
    if (!unidadeId) return
    const uid = unidadeId
    let ativo = true

    async function checar() {
      const [escala, acesso, t] = await Promise.all([
        supabase.rpc('na_escala_agora', { unidade: uid }),
        supabase.rpc('tem_acesso_atendimento', { unidade: uid }),
        supabase.rpc('turno_atual'),
      ])
      if (!ativo) return
      setTurno((t.data as string | null) ?? null)
      if (escala.data) setStatus('escala')
      else if (acesso.data) setStatus('acesso')
      else setStatus('fora')
    }

    void checar()
    const timer = setInterval(() => void checar(), 60_000)
    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [unidadeId])

  return { status, turno }
}
