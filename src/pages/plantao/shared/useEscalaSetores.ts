import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/**
 * Setores da escala ATUAL do plantonista (relógio do servidor).
 * Usado pelos documentos de Atendimento Porta e pela Internação.
 *
 * Lê da escala DEDICADA (public.escala_plantao) via RPC
 * setores_na_escala_agora — a Fase 3 tornou escala_plantoes (plural)
 * legado para acesso. Antes este hook consultava a tabela legada e
 * podia retornar vazio (dados não alimentados na tabela antiga).
 */
export function useEscalaSetores(unidadeId?: string, perfilId?: string) {
  return useQuery({
    queryKey: ['escala-setores-atual', unidadeId, perfilId],
    enabled: !!unidadeId && !!perfilId,
    queryFn: async () => {
      const { data: bruto, error } = await supabase.rpc('setores_na_escala_agora')
      if (error) throw error
      // O RPC retorna uuid[] — valida o formato vindo do banco.
      const setorIds = Array.isArray(bruto)
        ? (bruto as unknown[]).filter((x): x is string => typeof x === 'string')
        : []
      if (setorIds.length === 0) return []
      const { data } = await supabase
        .from('setores')
        .select('id, nome')
        .in('id', setorIds)
        .order('ordem', { ascending: true })
      return (data ?? []) as { id: string; nome: string }[]
    },
  })
}
