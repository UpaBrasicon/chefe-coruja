import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// Limites da unidade (migration 20261012000001): o gestor escolhe em
// Unidade › Configurações. Os padrões são os de antes da configuração.

export type LimitesUnidade = {
  descanso_ativo: boolean
  descanso_horas: number
  sobrecarga_horas: number
  ocupacao_pct: number
  checkin_tolerancia_min: number
  alvo_triagem_min: number
  alvos_medico: Record<'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul', number>
  atualizado_em: string | null
}

export const LIMITES_PADRAO: LimitesUnidade = {
  descanso_ativo: false,
  descanso_horas: 11,
  sobrecarga_horas: 60,
  ocupacao_pct: 85,
  checkin_tolerancia_min: 30,
  alvo_triagem_min: 10,
  alvos_medico: { vermelho: 0, laranja: 10, amarelo: 60, verde: 120, azul: 240 },
  atualizado_em: null,
}

export const chaveLimites = (unidadeId: string | undefined) => ['limites-unidade', unidadeId] as const

export function useLimitesUnidade(unidadeId: string | undefined) {
  const q = useQuery({
    queryKey: chaveLimites(unidadeId),
    enabled: !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('limites_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return { ...LIMITES_PADRAO, ...(data as Partial<LimitesUnidade>) }
    },
  })
  return { ...q, limites: q.data ?? LIMITES_PADRAO }
}
