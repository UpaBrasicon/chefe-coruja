import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Banners } from '@/types/database'

// Item 24 do kit de desempenho: a lateral, a Central e os avisos da entrada
// usam só estes campos; o banner é lido em toda tela.
export type Banner = Pick<Banners['Row'], 'id' | 'titulo' | 'descricao' | 'imagem_url' | 'link_url' | 'created_at'>

export function useBanners(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['banners', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('id, titulo, descricao, imagem_url, link_url, created_at')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as Banner[]
    },
  })
}
