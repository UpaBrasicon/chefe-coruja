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

type PlantaoDaTroca = { setor_id: string; data: string; turno: string } | null

export type TrocaComExtra = {
  id: string
  status: string
  mensagem: string | null
  created_at: string
  aceito_em: string | null
  plantao_a: PlantaoDaTroca
  plantao_b: PlantaoDaTroca
  pedinte: { nome_completo: string } | null
  colega: { nome_completo: string } | null
}

/** Trocas da unidade para o gestor decidir (A2: a troca só entra na escala com o gestor). */
export function useTrocasEscala(unidadeId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['trocas-escala', unidadeId],
    enabled: !!unidadeId && habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trocas_plantao')
        .select('id, status, mensagem, created_at, aceito_em, plantao_a:escala_plantao!trocas_plantao_plantao_a_id_fkey(setor_id, data, turno), plantao_b:escala_plantao!trocas_plantao_plantao_b_id_fkey(setor_id, data, turno), pedinte:perfis!trocas_plantao_perfil_a_id_fkey(nome_completo), colega:perfis!trocas_plantao_perfil_b_id_fkey(nome_completo)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as TrocaComExtra[]
    },
  })
}

/** Quantos pedidos esperam a decisão do gestor (A4: passagem e troca só depois do aceite do colega). */
export function contarPedidos(solicitacoes: SolicitacaoComExtra[] | undefined, candidaturas: CandidaturaComExtra[] | undefined, trocas?: TrocaComExtra[]) {
  const escala = (solicitacoes ?? []).filter((s) => s.status === 'pendente' && (s.tipo !== 'passar_plantao' || !!s.aceito_em)).length
  const cand = (candidaturas ?? []).filter((c) => c.status === 'pendente').length
  const troc = (trocas ?? []).filter((t) => t.status === 'pendente' && !!t.aceito_em).length
  return { escala, candidaturas: cand, trocas: troc, total: escala + cand + troc }
}
