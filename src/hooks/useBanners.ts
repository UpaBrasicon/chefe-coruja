import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Banners } from '@/types/database'

export type Banner = Banners['Row']

export function useBanners(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['banners', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as Banner[]
    },
  })
}
