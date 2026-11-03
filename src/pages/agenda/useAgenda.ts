// Leituras da agenda de consultas (5A, tarefa 3): o dia (agenda_dia) e a
// configuração da unidade (agenda_configuracao), e o relógio da tela.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import type { AgendaDia, ProfissionalConfig } from '@/domain/agenda'
import { supabase } from '@/lib/supabase'

export function useAgendaDia(unidadeId: string | undefined, data: string) {
  return useQuery({
    queryKey: ['agenda-dia', unidadeId, data],
    enabled: !!unidadeId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: r, error } = await supabase.rpc('agenda_dia', { p_unidade: unidadeId!, p_data: data })
      if (error) throw error
      return r as unknown as AgendaDia
    },
  })
}

export function useConfiguracaoAgenda(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['agenda-configuracao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: r, error } = await supabase.rpc('agenda_configuracao', { p_unidade: unidadeId! })
      if (error) throw error
      return (r ?? []) as unknown as ProfissionalConfig[]
    },
  })
}

/** Relógio da tela: anda sozinho, sem recarregar nada. */
export function useAgora(intervalo = 30_000) {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervalo)
    return () => window.clearInterval(t)
  }, [intervalo])
  return agora
}
