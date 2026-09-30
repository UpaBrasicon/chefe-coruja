import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { situacaoSemConexao } from '@/lib/offline/relogio'

// 'acesso' era o acesso pago fora da escala, desligado em 26/09 (migration
// 0011); fica no tipo só para quem ainda compara com ele.
// 'checkin': na janela do plantão, mas a tolerância do check-in venceu sem
// check-in (migration 20261014000001) — a casca mostra só a tela de check-in.
export type StatusPlantao = 'carregando' | 'escala' | 'acesso' | 'sem_conexao' | 'checkin' | 'fora'

/** Situação do check-in pelo relógio do servidor (public.situacao_checkin). */
export type SituacaoCheckin = {
  servidor: string
  tolerancia_min: number
  na_janela: boolean
  liberado: boolean
  bloqueado: boolean
  pendente: {
    escala_id: string
    setor_nome: string
    turno: string
    inicio: string
    fim: string
    prazo: string
  } | null
  /** Date.now() quando a resposta chegou: com `servidor`, dá o relógio da unidade. */
  recebidoEm: number
}

/** Avisa a casca de que houve check-in (a situação é relida na hora). */
export const EVENTO_CHECKIN = 'cc:checkin'

/**
 * Verifica o plantão pelo RELÓGIO DO SERVIDOR (não depende do relógio do Windows).
 * Reavalia automaticamente a cada 60s, então a liberação/remoção de acesso acontece
 * sozinha quando o turno muda, e relê na hora quando alguém faz check-in.
 *
 * Sem conexão (ADR 0009): continua só quem já estava em plantão neste aparelho,
 * por até 2 h sem contato e até 15 min depois do fim do plantão.
 */
export function usePlantao(unidadeId: string | undefined) {
  const [status, setStatus] = useState<StatusPlantao>('carregando')
  const [turno, setTurno] = useState<string | null>(null)
  const [checkin, setCheckin] = useState<SituacaoCheckin | null>(null)
  const checarRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!unidadeId) return
    const uid = unidadeId
    let ativo = true

    async function checar() {
      const [situacao, t] = await Promise.all([
        supabase.rpc('situacao_checkin', { p_unidade: uid }),
        supabase.rpc('turno_atual'),
      ])
      if (!ativo) return
      if (situacao.error && (!navigator.onLine || /fetch|network/i.test(situacao.error.message))) {
        setStatus(situacaoSemConexao().pode ? 'sem_conexao' : 'fora')
        return
      }
      setTurno((t.data as string | null) ?? null)
      const s = situacao.error ? null : ({ ...(situacao.data as object), recebidoEm: Date.now() } as SituacaoCheckin)
      setCheckin(s)
      setStatus(s?.liberado ? 'escala' : s?.bloqueado ? 'checkin' : 'fora')
    }

    checarRef.current = checar
    void checar()
    const timer = setInterval(() => void checar(), 60_000)
    const aoCheckin = () => void checar()
    window.addEventListener('online', checar)
    window.addEventListener('offline', checar)
    window.addEventListener(EVENTO_CHECKIN, aoCheckin)
    return () => {
      ativo = false
      clearInterval(timer)
      window.removeEventListener('online', checar)
      window.removeEventListener('offline', checar)
      window.removeEventListener(EVENTO_CHECKIN, aoCheckin)
    }
  }, [unidadeId])

  const recarregar = useCallback(() => void checarRef.current(), [])

  return { status, turno, checkin, recarregar }
}
