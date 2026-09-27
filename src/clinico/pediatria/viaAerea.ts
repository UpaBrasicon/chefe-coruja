import type { Fonte } from '../ficha.ts'
import { fichaPediatrica } from './fonte.ts'

// Via aérea e desfibrilação por peso. A COR vem das faixas da fita de Broselow
// (edição 2011, as mesmas do protótipo) — o PedGuide desloca as faixas (ex.:
// 5 kg como rosa, 23 kg como laranja), e esse erro não foi copiado. O
// equipamento de cada cor é o do PedGuide (tubo com cuff).

const FITA: Fonte = { citacao: 'Faixas de peso da fita de Broselow, edição 2011 (as mesmas do protótipo do Chefe Coruja).', pediatrica: true }
const PALS: Fonte = { citacao: 'Cargas de desfibrilação e cardioversão como no PedGuide (PALS/AHA: 2 J/kg, depois 4 J/kg; cardioversão 0,5–1 J/kg, depois 2 J/kg).', pediatrica: true }

export const fichaViaAereaPediatrica = fichaPediatrica('ped-via-aerea', 'Via aérea e desfibrilação pediátrica por peso', [FITA, PALS])

export type Cor = 'Cinza' | 'Rosa' | 'Vermelho' | 'Roxo' | 'Amarelo' | 'Branco' | 'Azul' | 'Laranja' | 'Verde'

export type Equipamento = {
  cor: Cor
  kg: [number, number]
  tuboCuffMm: number
  fixacaoCm: number
  lamina: string
  mascaraLaringea: string
  sondaAspiracaoFr: number
  bougieFr: number
}

export const EQUIPAMENTO: Equipamento[] = [
  { cor: 'Cinza', kg: [3, 5], tuboCuffMm: 3.0, fixacaoCm: 9, lamina: '0 reta', mascaraLaringea: '1', sondaAspiracaoFr: 6, bougieFr: 5 },
  { cor: 'Rosa', kg: [6, 7], tuboCuffMm: 3.0, fixacaoCm: 9, lamina: '1 reta', mascaraLaringea: '1', sondaAspiracaoFr: 6, bougieFr: 5 },
  { cor: 'Vermelho', kg: [8, 9], tuboCuffMm: 3.5, fixacaoCm: 10, lamina: '1 reta', mascaraLaringea: '1,5', sondaAspiracaoFr: 8, bougieFr: 6 },
  { cor: 'Roxo', kg: [10, 11], tuboCuffMm: 3.5, fixacaoCm: 11, lamina: '1–2', mascaraLaringea: '1,5', sondaAspiracaoFr: 8, bougieFr: 6 },
  { cor: 'Amarelo', kg: [12, 14], tuboCuffMm: 4.0, fixacaoCm: 12, lamina: '2', mascaraLaringea: '2', sondaAspiracaoFr: 8, bougieFr: 10 },
  { cor: 'Branco', kg: [15, 18], tuboCuffMm: 4.5, fixacaoCm: 13, lamina: '2', mascaraLaringea: '2', sondaAspiracaoFr: 10, bougieFr: 10 },
  { cor: 'Azul', kg: [19, 23], tuboCuffMm: 5.0, fixacaoCm: 15, lamina: '2', mascaraLaringea: '2,5', sondaAspiracaoFr: 10, bougieFr: 10 },
  { cor: 'Laranja', kg: [24, 29], tuboCuffMm: 5.5, fixacaoCm: 16, lamina: '2–3', mascaraLaringea: '3', sondaAspiracaoFr: 12, bougieFr: 15 },
  { cor: 'Verde', kg: [30, 36], tuboCuffMm: 6.0, fixacaoCm: 18, lamina: '3', mascaraLaringea: '3', sondaAspiracaoFr: 12, bougieFr: 15 },
]

/**
 * Cor da fita pelo peso. Entre faixas (ex.: 5,5 kg) arredonda para a faixa
 * mais próxima pelo inteiro; fora de 3–36 kg a fita não se aplica (null).
 */
export function equipamentoPorPeso(pesoKg: number): Equipamento | null {
  if (!Number.isFinite(pesoKg) || pesoKg < 3 || pesoKg >= 37) return null
  const p = Math.round(pesoKg)
  return EQUIPAMENTO.find((e) => p >= e.kg[0] && p <= e.kg[1]) ?? null
}

export type Cargas = { desfib1J: number; desfib2J: number; cardioversao: [number, number]; cardioversaoRefrataria: number }

/** Cargas por peso, arredondadas ao joule inteiro (como o aparelho seleciona). */
export function cargasPorPeso(pesoKg: number): Cargas | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const r = (x: number) => Math.round(x)
  return { desfib1J: r(2 * pesoKg), desfib2J: r(4 * pesoKg), cardioversao: [r(0.5 * pesoKg), r(pesoKg)], cardioversaoRefrataria: r(2 * pesoKg) }
}
