import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { lerPassometro } from '@/domain/passometro'

// Passômetro do médico (pedido 8; PS1 a PS3 = A do RT em 23/11/2026):
// public.passometro devolve os pacientes dos setores da escala agora, com as
// pendências de cada um.
export const CHAVE_PASSOMETRO = 'passometro'

export function usePassometro(unidadeId: string | undefined) {
  return useQuery({
    queryKey: [CHAVE_PASSOMETRO, unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('passometro', { p_unidade: unidadeId! })
      if (error) throw error
      return lerPassometro(data)
    },
  })
}
