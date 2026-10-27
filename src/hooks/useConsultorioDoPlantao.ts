import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// Consultório do plantão na fila do PS (migration 20270131000001; decisão do RT em
// 27/10/2026): escolhido uma vez no plantão, guardado no banco e não no aparelho,
// vale até o fim daquele plantão. {setor_id: sala_id}

const CHAVE = ['consultorio-do-plantao'] as const

export function useConsultorioDoPlantao(habilitado: boolean) {
  const queryClient = useQueryClient()
  const consulta = useQuery({
    queryKey: CHAVE,
    enabled: habilitado,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_salas_do_plantao')
      if (error) throw error
      return (data ?? {}) as Record<string, string>
    },
  })
  const escolher = useMutation({
    mutationFn: async ({ setor, sala }: { setor: string; sala: string }) => {
      const { data, error } = await supabase.rpc('definir_sala_do_plantao', { p_setor: setor, p_sala: sala })
      if (error) throw error
      return (data ?? {}) as Record<string, string>
    },
    onSuccess: (mapa) => queryClient.setQueryData(CHAVE, mapa),
  })
  return { salas: consulta.data ?? {}, carregando: consulta.isLoading, escolher }
}
