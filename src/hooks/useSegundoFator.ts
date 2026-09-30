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

/** Máximo de códigos errados antes do bloqueio (o servidor manda; ver migration 20261003000005). */
export const MAX_TENTATIVAS_SEGUNDO_FATOR = 3

/**
 * Tentativas que restam e fim do bloqueio, contados NO SERVIDOR pelo hook de
 * verificação do Auth. Sem o hook ligado, volta sempre o máximo e nenhum
 * bloqueio — a tela então não mostra contagem. Em erro, `null`.
 */
export async function lerTentativasSegundoFator(): Promise<{ restantes: number; bloqueadoAte: Date | null } | null> {
  const { data, error } = await supabase.rpc('segundo_fator_tentativas')
  if (error) return null
  const r = data?.[0]
  if (!r) return null
  return { restantes: r.restantes ?? MAX_TENTATIVAS_SEGUNDO_FATOR, bloqueadoAte: r.bloqueado_ate ? new Date(r.bloqueado_ate) : null }
}
