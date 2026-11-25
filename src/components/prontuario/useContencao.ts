// Leitura da contenção mecânica do paciente (contencao_do_paciente), à parte
// do componente para o fast refresh: o bloco do leito e o menu Ações do caderno
// (RS3, RT 24/11/2026) usam a mesma chave.
import { useQuery } from '@tanstack/react-query'

import type { TelaContencao } from '@/lib/contencao'
import { supabase } from '@/lib/supabase'

export function useTelaContencao(pacienteId: string) {
  return useQuery({
    queryKey: ['contencao', pacienteId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contencao_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as TelaContencao
    },
  })
}

/** Pode iniciar agora (sem contenção ativa): o item "Iniciar contenção mecânica" do menu Ações do leito. */
export function usePodeIniciarContencao(pacienteId: string): boolean {
  const t = useTelaContencao(pacienteId).data
  return !!t && !t.ativa && t.pode_iniciar
}
