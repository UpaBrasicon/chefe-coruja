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

/** "até 10 min" ou "imediato" (vermelho). */
export const textoAlvo = (cor: CorRisco) => (ALVO_MIN[cor] ? `até ${ALVO_MIN[cor]} min` : 'imediato')

/** Nome da cor com inicial maiúscula, para rótulos. */
export const rotuloCor = (cor: CorRisco) => cor.charAt(0).toUpperCase() + cor.slice(1)

/** Fonte das cores e dos tempos-alvo (a do fluxograma vem do banco). */
export const FONTE_CORES = 'Cores e tempo-alvo: Manchester Triage Group (Emergency Triage, 3ª ed.)'

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
