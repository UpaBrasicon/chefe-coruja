import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { abrirProntuario } from '@/lib/prontuario'
import type { DadosPaciente } from './rascunho'

/**
 * `?paciente=<id>` na URL (ex.: vindo do Atendimento) preenche o paciente do
 * rascunho da ferramenta — e abrir é consulta registrada no servidor.
 */
export function usePacienteDaUrl(atual: DadosPaciente, aoCarregar: (p: Partial<DadosPaciente>) => void) {
  const [searchParams, setSearchParams] = useSearchParams()
  const pacienteParam = searchParams.get('paciente')
  useQuery({
    queryKey: ['paciente-da-url', pacienteParam],
    enabled: !!pacienteParam,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('id, nome, data_nascimento, setor_id').eq('id', pacienteParam!).maybeSingle()
      if (error) throw error
      if (data && data.id !== atual.paciente_id) {
        const nascimento = data.data_nascimento ? data.data_nascimento.split('-').reverse().join('/') : ''
        aoCarregar({ nome: data.nome, nascimento, setor_id: data.setor_id, paciente_id: data.id })
      }
      if (data?.id) await abrirProntuario(data.id)
      setSearchParams({}, { replace: true })
      return data
    },
  })
}
