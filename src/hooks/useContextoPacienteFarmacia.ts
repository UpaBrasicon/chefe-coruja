// Contexto do paciente para a farmácia (revisão do perfil Farmacêutico, RT
// 24/11/2026). VA1: idade e alergias na validação; DI3: leito e próximo
// horário de quem fica sem o medicamento em falta. Funções da migration
// 20270422000040; o acesso e o registro de acesso são do servidor.
import { useQuery } from '@tanstack/react-query'

import { lerContexto, lerHorariosFalta } from '@/lib/contextoPacienteFarmacia'
import { supabase } from '@/lib/supabase'

/**
 * Idade, público e alergias do paciente (contexto_paciente_farmacia). Cada
 * leitura entra no registro de acesso ao prontuário: a resposta fica em cache
 * por 5 minutos e não relê ao voltar à janela.
 */
export function useContextoPacienteFarmacia(pacienteId: string | null | undefined, unidade: string | null | undefined) {
  return useQuery({
    queryKey: ['contexto-paciente-farmacia', pacienteId, unidade],
    enabled: !!pacienteId && !!unidade,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contexto_paciente_farmacia', { p_paciente: pacienteId!, p_unidade: unidade! })
      if (error) throw error
      const c = lerContexto(data)
      if (!c) throw new Error('Resposta inesperada do servidor.')
      return c
    },
  })
}

/** Leito e próximo horário dos itens com falta aberta (pacientes_das_faltas), a cada minuto. */
export function usePacientesDasFaltas(unidade: string, ativo = true) {
  return useQuery({
    queryKey: ['pacientes-das-faltas', unidade],
    enabled: ativo && !!unidade,
    retry: false,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pacientes_das_faltas', { p_unidade: unidade })
      if (error) throw error
      return lerHorariosFalta(data)
    },
  })
}
