import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { turnosAtivos, type Turno } from '@/lib/turnos'

/**
 * Os turnos da escala da unidade (migration 20270421000050): todos, ativos e
 * desativados (o nome do turno desativado ainda aparece em plantão antigo).
 * `ativos` é a lista das grades; sem cadastro ou com erro, os três de sempre.
 */
export function useTurnosUnidade(unidadeId: string | undefined) {
  const q = useQuery({
    queryKey: ['turnos-unidade', unidadeId],
    enabled: !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turnos_unidade')
        .select('id, codigo, nome, inicio, fim, duracao_min, cobre, sobreaviso, padrao, ordem, ativo')
        .eq('unidade_id', unidadeId!)
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as Turno[]
    },
  })
  return { ...q, todos: q.data ?? [], ativos: turnosAtivos(q.data) }
}
