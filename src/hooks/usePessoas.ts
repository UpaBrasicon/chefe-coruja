import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Papel, Perfis, TipoUnidade } from '@/types/database'

export type UnidadeAdmin = {
  id: string
  nome: string
  tipo: TipoUnidade
  organizacao_id: string
}

export type VinculoAdmin = {
  id: string
  perfil_id: string
  unidade_id: string
  papel: Papel
  ativo: boolean
}

// Quem aderiu a um contrato da organização e espera o admin concluir a entrada.
export type AdesaoAdmin = {
  id: string
  perfil_id: string
  papel: Papel
  criado_em: string
  organizacao_id: string
  // S2: a entrada só se conclui depois de a pessoa confirmar o e-mail
  email_confirmado: boolean
}

export function usePessoasAdmin() {
  return useQuery({
    queryKey: ['pessoas-admin'],
    queryFn: async () => {
      // A RLS limita: perfis da própria organização (com ou sem vínculo ativo)
      // e quem aderiu a contrato dela (S1 da trilha de segurança).
      const [unidadesRes, perfisRes, adesoesRes] = await Promise.all([
        supabase.from('unidades').select('id, nome, tipo, organizacao_id').order('nome'),
        supabase.from('perfis').select('id, nome_completo, email, crm, uf_crm, ativo').order('nome_completo'),
        supabase.rpc('adesoes_da_organizacao'),
      ])
      if (unidadesRes.error) throw unidadesRes.error
      if (perfisRes.error) throw perfisRes.error
      if (adesoesRes.error) throw adesoesRes.error

      const unidades = (unidadesRes.data ?? []) as UnidadeAdmin[]
      const perfis = (perfisRes.data ?? []) as Perfis['Row'][]
      const adesoes: AdesaoAdmin[] = adesoesRes.data ?? []

      const unitIds = unidades.map((u) => u.id)
      const vinculosRes = await supabase
        .from('vinculos')
        .select('id, perfil_id, unidade_id, papel, ativo')
        .in('unidade_id', unitIds)

      if (vinculosRes.error) throw vinculosRes.error
      const vinculos = (vinculosRes.data ?? []) as VinculoAdmin[]

      return { unidades, perfis, vinculos, adesoes }
    },
  })
}
