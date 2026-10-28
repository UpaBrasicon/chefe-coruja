import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { useSolicitacoesEscala } from '@/hooks/usePedidosEscala'
import { supabase } from '@/lib/supabase'
import type { Database, Papel } from '@/types/database'

// Aba Escala, E4: os meus pedidos da escala (solicitações e trocas) e as vagas da
// minha categoria, para a Escala dos outros papéis (PedidosEscala).

export type PlantaoEquipe = {
  id: string; setor_id: string; perfil_id: string; papel: Papel | null; data: string; turno: string
  inicio: string; duracao_min: number; nome_completo: string | null
}
export type VagaAberta = Database['public']['Functions']['vagas_abertas']['Returns'][number]
export type Troca = { id: string; status: string; plantao_a_id: string; plantao_b_id: string; perfil_a_id: string; created_at: string }

/** Pedidos e vagas da unidade que a aba Escala precisa: os meus pedidos e as vagas da minha categoria. */
export function usePedidosDaEquipe(unidadeId: string | undefined) {
  const { perfil } = useAuth()
  const solicitacoes = useSolicitacoesEscala(unidadeId, !!unidadeId)
  const trocas = useQuery({
    queryKey: ['trocas-equipe', unidadeId, perfil?.id],
    enabled: !!unidadeId && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trocas_plantao')
        .select('id, status, plantao_a_id, plantao_b_id, perfil_a_id, created_at')
        .eq('unidade_id', unidadeId!)
        .or(`perfil_a_id.eq.${perfil!.id},perfil_b_id.eq.${perfil!.id}`)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as Troca[]
    },
  })
  const vagas = useQuery({
    queryKey: ['vagas-equipe'],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vagas_abertas')
      if (error) throw error
      return (data ?? []) as VagaAberta[]
    },
  })
  const minhas = (solicitacoes.data ?? []).filter((s) => s.perfil_id === perfil?.id)
  // plantões meus com pedido esperando a coordenação (a ampulheta no mês)
  const pendentes = new Set<string>([
    ...minhas.filter((s) => s.status === 'pendente').map((s) => s.escala_plantao_id),
    ...(trocas.data ?? []).filter((t) => t.status === 'pendente').flatMap((t) => [t.plantao_a_id, t.plantao_b_id]),
  ])
  return { minhas, trocas: trocas.data ?? [], vagas: (vagas.data ?? []).filter((v) => v.unidade_id === unidadeId), pendentes }
}

