import { fichaIcr, ok, positivo } from './fonteIcr.ts'

// Distúrbios do sódio na criança — cap. 54 do Pronto-Socorro ICr-HCFMUSP
// (4ª ed., 2023), p. 532–543. Só o que o livro traz; a conta é estimativa e
// o livro insiste que a correção é guiada pela dosagem seriada do sódio.

export const fichaSodioPed = fichaIcr('ped-sodio', 'Hipo e hipernatremia — criança', 'cap. 54, p. 532–543 e Tabela 11, p. 558')

// ---------------------------------------------------------------- interpretação

/** Sódio corrigido pela glicemia: +2 mEq/L a cada 100 mg/dL acima de 100 (p. 534; Quadro 6 do cap. 52, p. 517). */
export function sodioCorrigidoPed(na: number, glicemia: number): number | null {
  if (!positivo(na, glicemia)) return null
  return glicemia <= 100 ? na : na + (2 * (glicemia - 100)) / 100
}

/** Osmolalidade efetiva calculada = 2 × Na + glicose/18 (p. 537). */
export function osmEfetiva(na: number, glicemia: number): number | null {
  if (!positivo(na, glicemia)) return null
  return 2 * na + glicemia / 18
}

/** Diferença medida − efetiva acima de 50 a 60 mOsm/L sugere outros osmóis relevantes (p. 537). */
export function diferencaOsmolar(medida: number, efetiva: number): { diferenca: number; acimaDe50: boolean } | null {
  if (!positivo(medida, efetiva)) return null
  const diferenca = medida - efetiva
  return { diferenca, acimaDe50: diferenca > 50 }
}

export type TonicidadePed = 'hipertonica' | 'isotonica' | 'hipotonica'

/** Hipertônica > 290 mOsm/kg; hipotônica < 275 mOsm/kg (p. 534); entre elas, faixa normal do plasma (275–290, p. 533). */
export function tonicidadePed(osm: number): TonicidadePed | null {
  if (!positivo(osm)) return null
  if (osm > 290) return 'hipertonica'
  if (osm < 275) return 'hipotonica'
  return 'isotonica'
}

/** Tabela 2 — densidade urinária x osmolalidade urinária (p. 537–538). */
export const DENSIDADE_OSM_URINARIA = [
  { densidade: 1003, osm: 100 },
  { densidade: 1010, osm: 300 },
  { densidade: 1020, osm: 500 },
] as const

export const LIMIARES = {
  hiponatremia: 135, // < 135 (p. 533)
  hipernatremia: 145, // > 145 (p. 540)
  /** "grave" varia na literatura: 120 ou 125 (p. 533) */
  hipoGrave: [120, 125] as [number, number],
  /** Na < 120 na hiponatremia hipovolêmica: correção direta (p. 538; Figura 4, p. 539) */
  hipovolemicaCorrigir: 120,
  /** desmielinização osmótica: hiponatremia extrema < 110 é fator de risco (p. 538) */
  extrema: 110,
}

// ---------------------------------------------------------------- hiponatremia

/** Bolus de NaCl 3% em coma/crise convulsiva: 2 mL/kg (máx. 100 mL) em 10–20 min, até 3 vezes, 10 min entre doses (p. 538; Figura 4). */
export const BOLUS_NACL3 = { mlKg: 2, maxMl: 100, minutos: [10, 20] as [number, number], repeticoes: 3, intervaloMin: 10 }

export function bolusNaCl3Ml(pesoKg: number): { ml: number; noMaximo: boolean } | null {
  if (!positivo(pesoKg)) return null
  const ml = BOLUS_NACL3.mlKg * pesoKg
  return ml > BOLUS_NACL3.maxMl ? { ml: BOLUS_NACL3.maxMl, noMaximo: true } : { ml, noMaximo: false }
}

/** Sem perda urinária de água livre, 1 mL/kg de NaCl 3% eleva o Na em ~1 mEq/L (p. 538). */
export function elevacaoNaCl3(pesoKg: number, ml: number): number | null {
  if (!positivo(pesoKg) || !ok(ml) || ml < 0) return null
  return ml / pesoKg
}

/** Velocidade máxima de correção (p. 538; Figura 4). */
export const LIMITES_CORRECAO_HIPO = {
  baixoRisco24h: [8, 10] as [number, number],
  baixoRisco48h: 18,
  altoRisco24h: [6, 8] as [number, number],
  /** dosar sódio a cada 4 a 6 h nas primeiras 24 h (p. 539) */
  dosarHoras: [4, 6] as [number, number],
}

export const FATORES_RISCO_DESMIELINIZACAO = [
  'hiponatremia extrema (< 110 mEq/L)',
  'hiponatremia crônica',
  'etilismo',
  'doença ou transplante hepático',
  'depleção de potássio corporal',
  'desnutrição',
]

/** Retenção de 2 mEq/kg de potássio eleva o Na em ~4 mEq/L (água corporal = 50% do peso) (p. 533 e 539). */
export const EFEITO_POTASSIO = { kMeqKg: 2, naMeqL: 4 }

// ---------------------------------------------------------------- Tabela 3

/** Concentração de Na das soluções (mEq/L) — Tabela 11 (p. 558): NaCl 3% 0,5 mEq/mL; SF 0,154 mEq/mL. SG 5% sem sódio. */
export const SOLUCOES_NA = [
  { id: 'nacl3', nome: 'NaCl 3%', naMeqL: 500, pagina: 'Tabela 11, p. 558' },
  { id: 'sf', nome: 'NaCl 0,9% (SF)', naMeqL: 154, pagina: 'Tabela 11, p. 558' },
  { id: 'sg5', nome: 'Soro glicosado 5%', naMeqL: 0, pagina: 'p. 542' },
] as const

/**
 * Tabela 3 (p. 540): variação do Na plasmático após 1 L da solução =
 * (Na da solução − Na do paciente) / (0,6 × peso + 1). O livro usa 0,6 para toda criança.
 */
export function variacaoNaPorLitro(naPaciente: number, naSolucao: number, pesoKg: number): number | null {
  if (!positivo(naPaciente, pesoKg) || !ok(naSolucao) || naSolucao < 0) return null
  return (naSolucao - naPaciente) / (0.6 * pesoKg + 1)
}

/** Litros da solução para uma variação alvo (mesmo sinal da variação por litro). Estimativa linear. */
export function litrosParaVariacao(alvo: number, porLitro: number): number | null {
  if (!ok(alvo, porLitro) || alvo === 0 || porLitro === 0 || Math.sign(alvo) !== Math.sign(porLitro)) return null
  return alvo / porLitro
}

// ---------------------------------------------------------------- hipernatremia

/** Queda de até 0,5 mEq/L/h na hipernatremia (p. 542). */
export const QUEDA_MAX_HIPER_MEQ_H = 0.5

/** Horas mínimas para baixar do Na atual ao alvo a 0,5 mEq/L/h. */
export function horasMinimasHiper(naAtual: number, naAlvo: number): number | null {
  if (!positivo(naAtual, naAlvo) || naAlvo >= naAtual) return null
  return (naAtual - naAlvo) / QUEDA_MAX_HIPER_MEQ_H
}

/** Hipernatremia aguda com sintoma neurológico grave: SG 5% 3 mL/kg em 10–20 min ≈ −1 mEq/L (p. 542). */
export const SG5_RAPIDO = { mlKg: 3, minutos: [10, 20] as [number, number], quedaMeqL: 1 }

export function sg5RapidoMl(pesoKg: number): number | null {
  return positivo(pesoKg) ? SG5_RAPIDO.mlKg * pesoKg : null
}

/** Tabela 6 (p. 543): déficit de água livre (L) = peso × 0,6 × [(Na paciente / Na desejado) − 1]. */
export function deficitAguaLivrePed(pesoKg: number, naPaciente: number, naDesejado: number): number | null {
  if (!positivo(pesoKg, naPaciente, naDesejado)) return null
  return pesoKg * 0.6 * (naPaciente / naDesejado - 1)
}

export const NOTA_FORMULAS =
  'As fórmulas não consideram as perdas que continuam; o livro acrescenta a reposição dessas perdas à prescrição e guia a correção principalmente pela dosagem frequente do sódio (p. 539 e 542).'
