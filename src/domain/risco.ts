// Classificação de risco (CONTEXT.md). A cor é sempre a escolhida pelo
// enfermeiro (ou pelo médico, ao reclassificar); nada aqui calcula ou sugere cor.

import { pesoPrioridade } from './prioridade.ts'

export type CorRisco = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'

export const CORES_RISCO: CorRisco[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']

export const NIVEL_RISCO: Record<CorRisco, string> = {
  vermelho: 'Emergência',
  laranja: 'Muito urgente',
  amarelo: 'Urgente',
  verde: 'Pouco urgente',
  azul: 'Não urgente',
}

/** Tempo-alvo até o atendimento médico, em minutos (protocolo da unidade). */
export const ALVO_MIN: Record<CorRisco, number> = { vermelho: 0, laranja: 10, amarelo: 60, verde: 120, azul: 240 }

/** Mais grave primeiro: 0 = vermelho … 4 = azul. */
export const gravidade = (cor: CorRisco) => CORES_RISCO.indexOf(cor)

/**
 * Fila médica: a cor manda; dentro da mesma cor, 80+ → prioridade legal →
 * maior espera (desde a classificação). Nunca passa à frente de cor mais grave.
 */
export function ordemMedica<T extends { cor_atual: CorRisco; prioridades_legais: string[]; classificado_em: string }>(a: T, b: T): number {
  return (
    gravidade(a.cor_atual) - gravidade(b.cor_atual) ||
    pesoPrioridade(a.prioridades_legais) - pesoPrioridade(b.prioridades_legais) ||
    a.classificado_em.localeCompare(b.classificado_em)
  )
}
