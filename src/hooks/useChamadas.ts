import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// Salas da porta e contagem de chamadas por episódio (Fase 2.3).

export type Sala = { id: string; nome: string; tipo: 'triagem' | 'consultorio' | 'emergencia' }

export function useSalas(setorId: string | undefined) {
  return useQuery({
    queryKey: ['salas', setorId],
    enabled: !!setorId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('salas').select('id, nome, tipo').eq('setor_id', setorId!).eq('ativo', true).order('ordem')
      if (error) throw error
      return (data ?? []) as Sala[]
    },
  })
}

/** Quantas vezes cada episódio já foi chamado nesta etapa. */
export function useChamadasPorEpisodio(setores: string[], etapa: 'triagem' | 'atendimento') {
  return useQuery({
    queryKey: ['chamadas-contagem', setores.join(','), etapa],
    enabled: setores.length > 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamadas')
        .select('episodio_id, numero')
        .in('setor_id', setores)
        .eq('etapa', etapa)
        .gte('criado_em', new Date(Date.now() - 24 * 3600_000).toISOString())
      if (error) throw error
      const mapa = new Map<string, number>()
      for (const c of data ?? []) mapa.set(c.episodio_id, Math.max(mapa.get(c.episodio_id) ?? 0, c.numero))
      return mapa
    },
  })
}
