import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { CandidaturaEscala, SolicitacaoEscala } from '@/types/database'

// Pedidos da escala (revisão visual 3.9): solicitações (sair do fixo, passar
// plantão, justificar falta) e candidaturas a plantões livres. As mesmas
// consultas servem à Escala (aba Pedidos), ao calendário do mês (a linha
// "pedidos aguardando você") e ao plantonista (as candidaturas dele); por isso
// moram aqui, com a mesma chave e o mesmo select em todos os lugares.

export type SolicitacaoComExtra = SolicitacaoEscala & {
  escala_plantao: { setor_id: string; data: string; turno: string } | null
  solicitante: { nome_completo: string } | null
  destino: { nome_completo: string } | null
}

export type CandidaturaComExtra = CandidaturaEscala & {
  setores: { nome: string } | null
  perfis: { id: string; nome_completo: string; crm: string | null } | null
}

export function useSolicitacoesEscala(unidadeId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['solicitacoes-escala', unidadeId],
    enabled: !!unidadeId && habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_escala')
        .select('*, escala_plantao(setor_id, data, turno), solicitante:perfis!solicitacoes_escala_perfil_id_fkey(nome_completo), destino:perfis!solicitacoes_escala_destino_perfil_id_fkey(nome_completo)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as SolicitacaoComExtra[]
    },
  })
}

export function useCandidaturasEscala(unidadeId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['candidaturas-escala', unidadeId],
    enabled: !!unidadeId && habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidaturas_escala')
        .select('*, setores(nome), perfis!candidaturas_escala_perfil_id_fkey(id, nome_completo, crm)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as CandidaturaComExtra[]
    },
  })
}

/** Quantos pedidos esperam a decisão do gestor. */
export function contarPedidos(solicitacoes: SolicitacaoComExtra[] | undefined, candidaturas: CandidaturaComExtra[] | undefined) {
  const escala = (solicitacoes ?? []).filter((s) => s.status === 'pendente').length
  const cand = (candidaturas ?? []).filter((c) => c.status === 'pendente').length
  return { escala, candidaturas: cand, total: escala + cand }
}
