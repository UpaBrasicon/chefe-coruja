import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// Parecer médico (migration 20261004000002_parecer_medico.sql). Estados e
// prioridades do protótipo (etapa 7, manual 3.8 e 3.9).

export type StatusParecer = 'solicitado' | 'em_analise' | 'realizado' | 'cancelado'
export type PrioridadeParecer = 'normal' | 'urgencia_relativa' | 'urgencia' | 'emergencia'
type Variante = 'warning' | 'info' | 'success' | 'secondary' | 'destructive'

export const STATUS_PARECER: Record<StatusParecer, { rotulo: string; variante: Variante }> = {
  solicitado: { rotulo: 'Solicitado', variante: 'warning' },
  em_analise: { rotulo: 'Em análise', variante: 'info' },
  realizado: { rotulo: 'Realizado', variante: 'success' },
  cancelado: { rotulo: 'Cancelado', variante: 'secondary' },
}

/** Ordem do protótipo no pedido: da rotina para a emergência. */
export const PRIORIDADES: { valor: PrioridadeParecer; rotulo: string; variante: Variante }[] = [
  { valor: 'normal', rotulo: 'Normal', variante: 'secondary' },
  { valor: 'urgencia_relativa', rotulo: 'Urgência relativa', variante: 'warning' },
  { valor: 'urgencia', rotulo: 'Urgência', variante: 'warning' },
  { valor: 'emergencia', rotulo: 'Emergência', variante: 'destructive' },
]
export const prioridade = (p: string) => PRIORIDADES.find((x) => x.valor === p) ?? PRIORIDADES[0]

export const PERGUNTA_MIN = 15
export const RESPOSTA_MIN = 10
export const MOTIVO_MIN = 10

/** Lista fechada de especialidades (tabela especialidades_parecer). */
export function useEspecialidades() {
  return useQuery({
    queryKey: ['especialidades-parecer'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('especialidades_parecer').select('nome').order('ordem')
      if (error) throw error
      return (data ?? []).map((e) => e.nome)
    },
  })
}

export const mensagem = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? String(e))
