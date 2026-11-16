import { useState } from 'react'

import { lerPesoAdulto } from '@/domain/pesoAdulto'
import { pacienteDaCentral } from '@/lib/pacienteCentral'

// Peso e idade da Central dentro das ferramentas do piloto das calculadoras
// (C5 = A, RT em 16/11/2026). Lidos uma vez, no primeiro desenho.

/**
 * Peso do adulto no piloto: abre com o peso da Central (modo adulto), com o
 * selo, e trava fora de 30 a 250 kg (regra da unidade, RT em 16/11/2026).
 * Devolve o peso digitado e o que entra na conta (0 fora da faixa).
 */
export function usePesoAdulto() {
  const [central] = useState(() => pacienteDaCentral('adulto').pesoKg)
  const [peso, setPeso] = useState(() => central ?? 0)
  const leitura = lerPesoAdulto(peso)
  return { peso, setPeso, central, leitura, pesoConta: leitura === 'ok' ? peso : 0 }
}

export type PesoAdulto = ReturnType<typeof usePesoAdulto>

export type InicioPed = { peso: number; anos: number; meses: number }

/** Leitura única, no primeiro desenho da ferramenta. */
export function useInicioPedDaCentral(): InicioPed & { daCentral: InicioPed | null } {
  const [inicio] = useState(() => {
    const c = pacienteDaCentral('pediatrico')
    if (c.pesoKg === null && c.idade === null) return { peso: 0, anos: 0, meses: 0, daCentral: null }
    const anos = c.idade === null ? 0 : c.unidadeIdade === 'anos' ? c.idade : c.unidadeIdade === 'meses' ? Math.floor(c.idade / 12) : 0
    const meses = c.idade !== null && c.unidadeIdade === 'meses' ? c.idade % 12 : 0
    const v = { peso: c.pesoKg ?? 0, anos, meses }
    return { ...v, daCentral: v }
  })
  return inicio
}

