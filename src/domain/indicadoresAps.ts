// Indicadores de qualidade da APS (percurso da UBS, U13; plano em
// docs/ubs/U13-PLANO.md, G1–G3 = A). Fonte: notas metodológicas C1 a C7 da
// SAPS/MS (junho de 2026) e NT 8/2026-DEAPS/SAPS/MS (nota final). C1, C6 e C7
// vêm de indicadores_aps (migration 20270415000019); C2 a C5, dos painéis.

export type Indicador = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7'
export type Conceito = 'otimo' | 'bom' | 'suficiente' | 'regular'

export const ROTULO_CONCEITO: Record<Conceito, string> = { otimo: 'Ótimo', bom: 'Bom', suficiente: 'Suficiente', regular: 'Regular' }

/** NT 8/2026: peso de cada indicador na nota final (total 10). */
export const PESO: Record<Indicador, number> = { C1: 1, C2: 2, C3: 2, C4: 1, C5: 1, C6: 1, C7: 2 }
/** NT 8/2026: valor de cada conceito. */
export const VALOR_CONCEITO: Record<Conceito, number> = { regular: 0.25, suficiente: 0.5, bom: 0.75, otimo: 1 }

/** C1: ótimo acima de 50% até 70%; acima de 70% é regular (nota C1, item 30). */
export function conceitoC1(pct: number): Conceito {
  if (pct > 50 && pct <= 70) return 'otimo'
  if (pct > 30 && pct <= 50) return 'bom'
  if (pct > 10 && pct <= 30) return 'suficiente'
  return 'regular'
}

/** C2 a C7: ótimo > 75, bom > 50, suficiente > 25, regular ≤ 25. */
export function conceitoBoasPraticas(v: number): Conceito {
  if (v > 75) return 'otimo'
  if (v > 50) return 'bom'
  if (v > 25) return 'suficiente'
  return 'regular'
}

export type FaixaC7 = { faixa: number; feito: number }
export type ResultadoApsBanco = {
  c1: { programados: number; total: number; de: string; ate: string }
  c6: { pessoas: number; consulta: number; peso_altura: number; media: number | null }
  c7: { colo: FaixaC7; ssr: FaixaC7; mama: FaixaC7 }
}

const fracao = (f: FaixaC7) => (f.faixa > 0 ? f.feito / f.faixa : 0)

/** C7 pela nota: A colo × 20 + B vacina HPV × 30 (fora do app: zero) + C saúde sexual × 30 + D mamografia × 20. */
export function c7Ministerio(c7: ResultadoApsBanco['c7']): number {
  return Math.round((fracao(c7.colo) * 20 + fracao(c7.ssr) * 30 + fracao(c7.mama) * 20) * 10) / 10
}

/** Teto do que o app registra em cada indicador de boas práticas (G1 = A). */
export const TETO_APP: Partial<Record<Indicador, number>> = { C6: 50, C7: 70 }

export const media = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null)

/** Nota final estimada (NT 8/2026): soma de peso × valor do conceito; indicador sem dado conta zero. */
export function notaFinal(conceitos: Partial<Record<Indicador, Conceito | null>>): number {
  const n = (Object.keys(PESO) as Indicador[]).reduce((s, i) => s + (conceitos[i] ? PESO[i] * VALOR_CONCEITO[conceitos[i]!] : 0), 0)
  return Math.round(n * 100) / 100
}

/** Conceito da nota final (NT 8/2026): ótimo > 7,5; bom ≥ 5; suficiente > 2,5; regular ≤ 2,5. */
export function conceitoNotaFinal(n: number): Conceito {
  if (n > 7.5) return 'otimo'
  if (n >= 5) return 'bom'
  if (n > 2.5) return 'suficiente'
  return 'regular'
}
