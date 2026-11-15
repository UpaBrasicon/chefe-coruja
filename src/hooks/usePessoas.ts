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
        supabase.from('adesoes_contrato').select('id, perfil_id, papel, criado_em, contrato:contratos_rede(organizacao_id)'),
      ])
      if (unidadesRes.error) throw unidadesRes.error
      if (perfisRes.error) throw perfisRes.error
      if (adesoesRes.error) throw adesoesRes.error

      const unidades = (unidadesRes.data ?? []) as UnidadeAdmin[]
      const perfis = (perfisRes.data ?? []) as Perfis['Row'][]
      const adesoes: AdesaoAdmin[] = (adesoesRes.data ?? []).map((a) => {
        const contrato = a.contrato as { organizacao_id: string } | { organizacao_id: string }[] | null
        const org = Array.isArray(contrato) ? contrato[0]?.organizacao_id : contrato?.organizacao_id
        return { id: a.id, perfil_id: a.perfil_id, papel: a.papel, criado_em: a.criado_em, organizacao_id: org ?? '' }
      })

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
