import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/**
 * Setores da escala ATUAL do plantonista (relógio do servidor).
 * Usado pelos documentos de Atendimento Porta e pela Internação.
 */
export function useEscalaSetores(unidadeId?: string, perfilId?: string) {
  return useQuery({
    queryKey: ['escala-setores-atual', unidadeId, perfilId],
    enabled: !!unidadeId && !!perfilId,
    queryFn: async () => {
      const [turno, hoje] = await Promise.all([
        supabase.rpc('turno_atual'),
        supabase.rpc('data_atual'),
      ])
      if (!hoje.data) return []
      const { data } = await supabase
        .from('escala_plantoes')
        .select('setor_id, setores(id, nome)')
        .eq('perfil_id', perfilId!)
        .eq('ativo', true)
        .eq('data', hoje.data as string)
        .eq('turno', turno.data as string)
      return (data ?? [])
        .map((e) => e.setores as { id: string; nome: string } | null)
        .filter((s): s is { id: string; nome: string } => !!s)
    },
  })
}
