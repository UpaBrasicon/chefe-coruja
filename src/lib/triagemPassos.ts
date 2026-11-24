// Passos da classificação de risco na ordem do protocolo (TR1–TR3, revisão do
// perfil Enfermeiro, RT 24/11/2026): queixa, fluxograma, discriminador, sinais
// vitais, gestação (mulheres) e a prioridade por último. Só a ordem da tela
// muda: os campos, as regras e a chamada ao servidor são os mesmos.

export type PassoTriagem = 'queixa' | 'fluxograma' | 'discriminador' | 'vitais' | 'gestacao' | 'prioridade'

const TITULOS: Record<PassoTriagem, string> = {
  queixa: 'Queixa e contexto',
  fluxograma: 'Fluxograma',
  discriminador: 'Discriminador',
  vitais: 'Sinais vitais',
  gestacao: 'Gestação',
  prioridade: 'Prioridade',
}

/** Os passos numerados; a gestação só entra para mulheres, sempre antes da prioridade. */
export function passosTriagem(feminino: boolean): { id: PassoTriagem; n: number; titulo: string }[] {
  const ids: PassoTriagem[] = ['queixa', 'fluxograma', 'discriminador', 'vitais', ...(feminino ? ['gestacao' as const] : []), 'prioridade']
  return ids.map((id, k) => ({ id, n: k + 1, titulo: TITULOS[id] }))
}

/** Id do elemento do passo, para rolar até ele quando falta algo (TR3). */
export const idDoPasso = (p: PassoTriagem) => `passo-triagem-${p}`

/**
 * TR2 (RT 24/11/2026): a nota da subtriagem do idoso só aparece para quem tem
 * 65 anos ou mais na chegada. Sem data de nascimento a idade é desconhecida e a
 * nota continua visível (é um alerta de atenção; não sugere cor).
 */
export function notaIdosoVisivel(anosNaChegada: number | null): boolean {
  return anosNaChegada === null || anosNaChegada >= 65
}
