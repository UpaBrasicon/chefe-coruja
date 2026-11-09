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
      // item 08 do kit de desempenho: uma chamada para todos os remédios (antes,
      // uma por remédio da receita e dos favoritos); mesma regra do banco
      const { data, error } = await supabase.rpc('alergia_trava_medicamentos', { p_paciente: pacienteId!, p_medicamentos: unicos })
      if (error) throw error
      const travas = (data ?? {}) as Record<string, string | null>
      return Object.fromEntries(unicos.map((id) => [id, travas[id] ?? null])) as Record<string, string | null>
    },
  })
}
