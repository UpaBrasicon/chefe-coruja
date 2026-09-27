import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { situacaoSemConexao } from '@/lib/offline/relogio'

// 'acesso' era o acesso pago fora da escala, desligado em 26/09 (migration
// 0011); fica no tipo só para quem ainda compara com ele.
export type StatusPlantao = 'carregando' | 'escala' | 'acesso' | 'sem_conexao' | 'fora'

/**
 * Verifica o plantão pelo RELÓGIO DO SERVIDOR (não depende do relógio do Windows).
 * Reavalia automaticamente a cada 60s, então a liberação/remoção de acesso acontece
 * sozinha quando o turno muda.
 *
 * Sem conexão (ADR 0009): continua só quem já estava em plantão neste aparelho,
 * por até 2 h sem contato e até 15 min depois do fim do plantão.
 */
export function usePlantao(unidadeId: string | undefined) {
  const [status, setStatus] = useState<StatusPlantao>('carregando')
  const [turno, setTurno] = useState<string | null>(null)

  useEffect(() => {
    if (!unidadeId) return
    const uid = unidadeId
    let ativo = true

    async function checar() {
      const [escala, t] = await Promise.all([
        supabase.rpc('na_escala_agora', { unidade: uid }),
        supabase.rpc('turno_atual'),
      ])
      if (!ativo) return
      if (escala.error && (!navigator.onLine || /fetch|network/i.test(escala.error.message))) {
        setStatus(situacaoSemConexao().pode ? 'sem_conexao' : 'fora')
        return
      }
      setTurno((t.data as string | null) ?? null)
      setStatus(escala.data ? 'escala' : 'fora')
    }

    void checar()
    const timer = setInterval(() => void checar(), 60_000)
    window.addEventListener('online', checar)
    window.addEventListener('offline', checar)
    return () => {
      ativo = false
      clearInterval(timer)
      window.removeEventListener('online', checar)
      window.removeEventListener('offline', checar)
    }
  }, [unidadeId])

  return { status, turno }
}
