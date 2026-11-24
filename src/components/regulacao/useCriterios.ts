// Critérios por nível de prioridade escritos pela central (Fase 4, tarefa 3):
// a página Regulação edita; a nova solicitação mostra ao lado da prioridade.
import { useQuery } from '@tanstack/react-query'

import type { Prioridade } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

type Criterio = { texto: string; em: string; por: string | null }
export function useCriterios(unidadeId: string) {
  return useQuery({
    queryKey: ['regulacao-criterios', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_criterios', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? {}) as unknown as Partial<Record<Prioridade, Criterio>>
    },
  })
}

