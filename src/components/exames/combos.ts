// Leitura dos combos de exames da unidade (EXM2, 25/11/2026): a mesma serve à
// tela do gestor (CombosExames) e ao pedido do leito.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type ComboExames = { id: string; nome: string; ordem: number; definido_por: string | null; definido_em: string; itens: { procedimento: string; nome_curto: string }[] }
export type ListaCombos = { combos: ComboExames[]; pode_definir: boolean }

export function useCombosExames(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['combos-exames', unidadeId],
    enabled: !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('combos_exames_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ListaCombos
    },
  })
}
