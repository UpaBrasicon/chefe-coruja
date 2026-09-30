import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// public.pendencias_pep (migration 20261005000003): o que o plantonista tem
// em aberto no PEP da unidade.

export type RascunhoPep = {
  id: string; tipo: string; paciente_id: string; paciente: string; episodio_id: string | null
  internacao_id: string | null; leito: string | null; criado_em: string; atualizado_em: string; copia_de: string | null
}
export type ImpeditivoItem = { tipo: string; id: string; descricao: string; autor_id?: string }
export type LeitoImpedido = { internacao_id: string; paciente_id: string; paciente: string; leito: string | null; itens: ImpeditivoItem[] }
export type PendenciaCombinada = {
  id: string; tipo: string; descricao: string; prazo: string | null; impeditiva: boolean; criada_em: string; origem: string
  meu: boolean; autor: string | null; internacao_id: string; paciente_id: string; paciente: string; leito: string | null
}
export type PendenciasPep = { rascunhos: RascunhoPep[]; impeditivos: LeitoImpedido[]; combinadas: PendenciaCombinada[] }

export function usePendenciasPep(unidadeId: string | null | undefined, opcoes?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['pendencias-pep', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: opcoes?.refetchInterval ?? 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pendencias_pep', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as PendenciasPep
    },
  })
}

/** Ferramenta do plantão onde cada tipo de rascunho se abre. */
export const ROTA_DO_TIPO: Record<string, string> = {
  receita: '/plantao/atendimento-porta/receituario-medico',
  atestado: '/plantao/atendimento-porta/atestado-medico',
  encaminhamento: '/plantao/atendimento-porta/encaminhamento',
  pedido_exames: '/plantao/atendimento-porta/pedido-exames',
}
export const rotaDoRascunho = (tipo: string) => ROTA_DO_TIPO[tipo] ?? '/plantao/internacao/formulario'
