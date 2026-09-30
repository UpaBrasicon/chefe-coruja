// Leitura do diagnóstico do leito (RPC diagnosticos_do_leito): vigentes e histórico.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type DiagnosticoLinha = {
  id: string
  origem: 'porta' | 'internacao'
  tipo: 'primario' | 'secundario'
  cid: string
  descricao: string | null
  status: 'hipotese' | 'confirmado'
  tempo_doenca: number | null
  tempo_unidade: string | null
  registrado_em: string
  autor_nome: string | null
  encerrado_em: string | null
  encerramento: 'substituido' | 'retirado' | null
  encerrado_por_nome: string | null
  motivo_encerramento: string | null
}

export const chaveDiagnosticos = (internacaoId: string) => ['diagnosticos-leito', internacaoId] as const

export function useDiagnosticos(internacaoId: string | null | undefined) {
  return useQuery({
    queryKey: chaveDiagnosticos(internacaoId ?? ''),
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('diagnosticos_do_leito', { p_internacao: internacaoId! })
      if (error) throw error
      return (data ?? []) as DiagnosticoLinha[]
    },
  })
}

