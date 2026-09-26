import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/** Estado do segundo fator da sessão (ADR 0010): exigido? válido? qual fator? */
export function useSegundoFator() {
  return useQuery({
    queryKey: ['segundo-fator'],
    queryFn: async () => {
      const [status, fatores] = await Promise.all([
        supabase.rpc('segundo_fator_status'),
        supabase.auth.mfa.listFactors(),
      ])
      if (status.error) throw status.error
      const s = status.data?.[0]
      const totp = fatores.data?.totp?.find((f) => f.status === 'verified') ?? null
      return {
        exigido: !!s?.exigido,
        valido: !!s?.valido,
        verificadoEm: s?.verificado_em ? new Date(s.verificado_em) : null,
        fatorId: totp?.id ?? null,
      }
    },
    refetchInterval: 5 * 60_000,
  })
}


