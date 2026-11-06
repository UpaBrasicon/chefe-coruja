// Trava de alergia por medicamento do cadastro: a regra do banco
// (alergia_trava_medicamento). Comum ao Receituário e aos favoritos da porta.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/** A regra do banco: a substância registrada que trava cada medicamento do cadastro. */
export function useTravas(pacienteId: string | null | undefined, ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))].sort()
  return useQuery({
    queryKey: ['trava-receita', pacienteId, unicos.join(',')],
    enabled: !!pacienteId && unicos.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const pares = await Promise.all(unicos.map(async (id) => {
        const { data, error } = await supabase.rpc('alergia_trava_medicamento', { p_paciente: pacienteId!, p_medicamento: id })
        if (error) throw error
        return [id, (data as string | null) ?? null] as const
      }))
      return Object.fromEntries(pares) as Record<string, string | null>
    },
  })
}
