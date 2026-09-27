import type { Ficha, Fonte } from '../ficha.ts'

// Fonte primária das ferramentas de adulto com dose (Fase 5.4), escolhida pelo
// responsável técnico em 27/09/2026: o manual de emergência do HCFMUSP. Os
// valores saem do livro com página; erros de digitação do livro ficam anotados
// na ficha de cada item (errata) e a conta é refeita a partir do preparo.

export const MANUAL_HC: Fonte = {
  citacao: 'Brandão Neto RA, et al. (eds.). Manual de Medicina de Emergência — Disciplina de Emergências Clínicas, Hospital das Clínicas da FMUSP. 3ª ed. rev. e atual. Santana de Parnaíba: Manole; 2022. ISBN 9786555767827.',
}

export const pagina = (p: string): Fonte => ({ citacao: `${MANUAL_HC.citacao} ${p}.` })

export function fichaAdulto(id: string, titulo: string, paginas: string): Ficha {
  return { id, titulo, versao: '2026-09-27.1', publico: 'adulto', fontes: [pagina(paginas)], revisadoEm: '27/09/2026 (conferido no livro, com errata anotada)' }
}
