import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { NotificacaoPlantonista } from '@/types/database'

export type NotificacaoTurno = Pick<NotificacaoPlantonista, 'id' | 'tipo' | 'mensagem' | 'created_at'>

/**
 * Gera e retorna as notificações de turno pendentes (não lidas) do plantonista
 * atual, conforme o relógio do servidor:
 *   • Noite (19h–07h): 19:30 e 20:00
 *   • Manhã (07h–13h): 07:30 e 08:00
 * Reavalia a cada 30s. Só quem está na escala recebe.
 */
export function useNotificacoesTurno(unidadeId: string | undefined, habilitado: boolean) {
  const queryClient = useQueryClient()

  const { data: notificacoes } = useQuery({
    queryKey: ['notificacoes-turno', unidadeId],
    enabled: !!unidadeId && habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gerar_notificacoes_turno', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as NotificacaoTurno[]
    },
    refetchInterval: 30_000,
  })

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('marcar_notificacao_lida', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notificacoes-turno'] }),
  })

  const pendentes = notificacoes ?? []

  return { notificacoes: pendentes, marcarLida }
}
