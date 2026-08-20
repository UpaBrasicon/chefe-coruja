// ─────────────────────────────────────────────────────────────────────────────
// useTerminologia — busca em tabelas de terminologia (CID, SIGTAP, CBO, CMED,
// LOINC) via RPC terminologia_buscar, com debounce de 300ms.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type TipoTerminologia =
  | 'cid10'
  | 'sigtap_procedimento'
  | 'cbo'
  | 'medicamento_cmed'
  | 'loinc'

export type ResultadoTerminologia = Database['public']['Functions']['terminologia_buscar']['Returns'][number]

const DEBOUNCE_MS = 300

/**
 * Busca com debounce de 300ms. `termo` vazio ou curto demais (1 char) não dispara
 * consulta (evita ruído). O resultado fica "stale" enquanto digita (TanStack).
 */
export function useTerminologia(tipo: TipoTerminologia, termo: string, limite = 10) {
  const [termoDebounced, setTermoDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setTermoDebounced(termo.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [termo])

  const habilitado = tipo.length > 0 && termoDebounced.length >= 2

  return useQuery({
    queryKey: ['terminologia', tipo, termoDebounced, limite],
    enabled: habilitado,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ResultadoTerminologia[]> => {
      const { data, error } = await supabase.rpc('terminologia_buscar', {
        p_tabela: tipo,
        p_termo: termoDebounced,
        p_limite: limite,
      })
      if (error) throw error
      return data ?? []
    },
  })
}
