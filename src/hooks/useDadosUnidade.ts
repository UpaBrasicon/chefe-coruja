import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { StatusLeito, TipoLeito, TipoSetor } from '@/types/database'

export type SetorComLeitos = {
  id: string
  unidade_id: string
  nome: string
  tipo: TipoSetor
  ordem: number
  ativo: boolean
  leitos: { count: number }[]
}

export function useSetores(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['setores', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores')
        .select('id, unidade_id, nome, tipo, ordem, ativo, leitos(count)')
        .eq('unidade_id', unidadeId!)
        .order('ordem', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export type Leito = {
  id: string
  setor_id: string
  identificador: string
  tipo: TipoLeito
  status: StatusLeito
  ativo: boolean
  /** lacuna 5 (O5): o leito ocupado com o corpo, aguardando a liberação */
  obito_aguardando_id?: string | null
  /** RG3 (modelo da Regulação, 25/11/2026): leito de isolamento com pressão negativa */
  pressao_negativa?: boolean
}

export function useLeitos(setorId: string | undefined) {
  return useQuery({
    queryKey: ['leitos', setorId],
    enabled: !!setorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leitos')
        .select('id, setor_id, identificador, tipo, status, ativo, obito_aguardando_id, pressao_negativa')
        .eq('setor_id', setorId!)
        .order('identificador', { ascending: true })
      if (error) throw error
      return (data ?? []) as Leito[]
    },
  })
}
