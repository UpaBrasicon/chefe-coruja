// CIDs de referência a partir do texto da hipótese (decisão do RT em
// 06/11/2026, A em C1 a C7). Chama public.cid_sugerir_do_texto, que só lê:
// nada é gravado aqui. Espera 500 ms sem digitar e pelo menos 3 letras.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { lerCidsSugeridos, textoParaSugestao, type CidSugerido } from '@/lib/cidSugerido'

const DEBOUNCE_MS = 500

export function useCidSugerido(texto: string) {
  const [pronto, setPronto] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setPronto(textoParaSugestao(texto)), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [texto])

  return useQuery({
    queryKey: ['cid-sugerido', pronto],
    enabled: pronto.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CidSugerido[]> => {
      const { data, error } = await supabase.rpc('cid_sugerir_do_texto', { p_texto: pronto })
      if (error) throw error
      return lerCidsSugeridos(data)
    },
  })
}
