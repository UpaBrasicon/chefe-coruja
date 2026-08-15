import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { StatusLeito, TipoLeito, TipoSetor, TipoUnidade } from '@/types/database'

export type CensoUnidade = {
  unidade_id: string
  unidade_nome: string
  unidade_tipo: TipoUnidade
  total_setores: number | null
  total_leitos: number | null
  leitos_livres: number | null
  leitos_ocupados: number | null
  leitos_bloqueados: number | null
  leitos_higienizacao: number | null
}

export function useCenso() {
  return useQuery({
    queryKey: ['censo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_censo_unidade').select('*')
      if (error) throw error
      return (data ?? []) as CensoUnidade[]
    },
  })
}

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
}

export function useLeitos(setorId: string | undefined) {
  return useQuery({
    queryKey: ['leitos', setorId],
    enabled: !!setorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leitos')
        .select('id, setor_id, identificador, tipo, status, ativo')
        .eq('setor_id', setorId!)
        .order('identificador', { ascending: true })
      if (error) throw error
      return (data ?? []) as Leito[]
    },
  })
}
