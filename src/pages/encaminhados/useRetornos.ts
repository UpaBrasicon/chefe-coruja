// Retornos à UBS (5A, tarefa 6): a lista da unidade, usada pela aba e pela
// contagem "a ver" no topo da tela Encaminhados.
import { useQuery } from '@tanstack/react-query'

import type { Retorno } from '@/domain/encaminhamento'
import { supabase } from '@/lib/supabase'

export function useRetornos(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['contrarreferencias', 'unidade', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contrarreferencias_da_unidade', { p_unidade: unidadeId!, p_dias: 30 })
      if (error) throw error
      return (data ?? []) as unknown as Retorno[]
    },
  })
}
