// Leitura do resumo do prontuário para a sala do chamado (SA1). Separado do
// componente para o fast refresh do Vite.
import { useQuery } from '@tanstack/react-query'

import { abrirProntuario } from '@/lib/prontuario'
import { rotuloLeito, type PaginaProntuario } from '@/lib/prontuarioLinhaTempo'
import { supabase } from '@/lib/supabase'

export type LocalPaciente = { setor: string | null; leito: string | null }

/**
 * O atendimento mais recente do paciente. Abre o prontuário antes (o acesso
 * fica registrado, como no "Ler prontuário"): sem isso o banco não devolve nada.
 */
export function useResumoPaciente(pacienteId: string) {
  return useQuery({
    queryKey: ['tele-resumo-paciente', pacienteId],
    staleTime: 60_000,
    queryFn: async () => {
      await abrirProntuario(pacienteId)
      const { data, error } = await supabase.rpc('prontuario_leitura', { p_paciente: pacienteId, p_limite: 1 })
      if (error) throw error
      return data as unknown as PaginaProntuario
    },
  })
}

/** Setor e leito da internação em aberto, se houver. */
export function localDoPaciente(p: PaginaProntuario | undefined): LocalPaciente {
  const aberta = (p?.internacoes ?? []).find((i) => !i.data_alta)
  if (!aberta || !p) return { setor: null, leito: null }
  return { setor: aberta.setor_id ? p.nomes[aberta.setor_id] ?? null : null, leito: aberta.leito_id ? rotuloLeito(p.nomes[aberta.leito_id]) : null }
}
