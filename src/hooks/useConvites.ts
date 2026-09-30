import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database, Papel } from '@/types/database'

export type ConviteDaUnidade = Database['public']['Functions']['convites_da_unidade']['Returns'][number]
export type SituacaoConvite = 'valido' | 'usado' | 'expirado' | 'revogado'

/** Convites da unidade (gestor, admin da rede). A RPC confere a permissão. */
export function useConvites(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['convites', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('convites_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data ?? []
    },
  })
}

export type NovoConvite = {
  papel: Papel
  setorId?: string | null
  paraQuem?: string
  primeiroInicio?: string | null
  primeiroFim?: string | null
  validadeDias: number
}

export function useGerarConvite(unidadeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (n: NovoConvite) => {
      const { data, error } = await supabase.rpc('gerar_convite', {
        p_unidade: unidadeId!,
        p_papel: n.papel,
        ...(n.setorId ? { p_setor: n.setorId } : {}),
        ...(n.paraQuem?.trim() ? { p_para_quem: n.paraQuem.trim() } : {}),
        ...(n.primeiroInicio ? { p_primeiro_plantao_inicio: n.primeiroInicio } : {}),
        ...(n.primeiroFim ? { p_primeiro_plantao_fim: n.primeiroFim } : {}),
        p_validade_dias: n.validadeDias,
      })
      if (error) throw error
      return data[0]
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['convites', unidadeId] }),
  })
}

export function useRevogarConvite(unidadeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conviteId: string) => {
      const { error } = await supabase.rpc('revogar_convite', { p_convite: conviteId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['convites', unidadeId] }),
  })
}
