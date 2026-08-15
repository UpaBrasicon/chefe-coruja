import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Papel, Perfis, TipoUnidade } from '@/types/database'

export type UnidadeAdmin = {
  id: string
  nome: string
  tipo: TipoUnidade
}

export type VinculoAdmin = {
  id: string
  perfil_id: string
  unidade_id: string
  papel: Papel
  ativo: boolean
}

export function usePessoasAdmin() {
  return useQuery({
    queryKey: ['pessoas-admin'],
    queryFn: async () => {
      const [unidadesRes, perfisRes] = await Promise.all([
        supabase.from('unidades').select('id, nome, tipo').order('nome'),
        supabase.from('perfis').select('id, nome_completo, email, crm, uf_crm, ativo').order('nome_completo'),
      ])
      if (unidadesRes.error) throw unidadesRes.error
      if (perfisRes.error) throw perfisRes.error

      const unidades = (unidadesRes.data ?? []) as UnidadeAdmin[]
      const perfis = (perfisRes.data ?? []) as Perfis['Row'][]

      const unitIds = unidades.map((u) => u.id)
      const vinculosRes = await supabase
        .from('vinculos')
        .select('id, perfil_id, unidade_id, papel, ativo')
        .in('unidade_id', unitIds)

      if (vinculosRes.error) throw vinculosRes.error
      const vinculos = (vinculosRes.data ?? []) as VinculoAdmin[]

      return { unidades, perfis, vinculos }
    },
  })
}
