import { faixaVezes, fichaIcr, ok, positivo } from './fonteIcr.ts'
import { sodioCorrigidoPed, osmEfetiva } from './sodioPed.ts'

// Cetoacidose diabética (CAD) e estado hiperglicêmico hiperosmolar (EHH) na
// criança — cap. 52 do Pronto-Socorro ICr-HCFMUSP (4ª ed., 2023), p. 512–526.
// Critérios, fórmulas do Quadro 6 e números por peso como o livro traz; a
// decisão de cada etapa é do profissional (ADR 0007).

export const fichaCadPed = fichaIcr('ped-cad-ehh', 'Cetoacidose diabética e EHH — criança', 'cap. 52, p. 512–526')

// ---------------------------------------------------------------- critérios (Quadro 2, p. 515)

export type Gaso = { glicemia: number; ph: number; bic: number; cetonemia?: number; cetonuria2mais?: boolean; osm?: number; venoso?: boolean }

export type Criterio = { nome: string; atende: boolean | null; texto: string }

/** CAD: glicemia > 200, pH < 7,3, bic < 15 (BSPED/NICE 2021) ou < 18 (ISPAD 2022), cetonemia ≥ 3 ou cetonúria ≥ 2+. */
export function criteriosCad(g: Gaso, corteBic: 15 | 18): Criterio[] {
  const cetose = g.cetonemia !== undefined && g.cetonemia > 0 ? g.cetonemia >= 3 : g.cetonuria2mais ?? null
  return [
    { nome: 'Glicemia', atende: positivo(g.glicemia) ? g.glicemia > 200 : null, texto: '> 200 mg/dL' },
    { nome: 'pH', atende: positivo(g.ph) ? g.ph < 7.3 : null, texto: '< 7,3' },
    { nome: 'Bicarbonato', atende: positivo(g.bic) ? g.bic < corteBic : null, texto: `< ${corteBic} mEq/L (${corteBic === 15 ? 'BSPED/NICE 2021' : 'ISPAD 2022'})` },
    { nome: 'Cetose', atende: cetose, texto: 'cetonemia ≥ 3 mmol/L ou cetonúria moderada/elevada (2+ ou mais)' },
  ]
}

/** EHH (ISPAD): glicemia > 600, pH > 7,3 arterial ou > 7,25 venoso, bic > 15, cetonemia < 3 ou cetonúria ausente/baixa, osmolalidade > 320. */
export function criteriosEhh(g: Gaso): Criterio[] {
  const corte = g.venoso ? 7.25 : 7.3
  const semCetose = g.cetonemia !== undefined && g.cetonemia > 0 ? g.cetonemia < 3 : g.cetonuria2mais === undefined ? null : !g.cetonuria2mais
  return [
    { nome: 'Glicemia', atende: positivo(g.glicemia) ? g.glicemia > 600 : null, texto: '> 600 mg/dL' },
    { nome: 'pH', atende: positivo(g.ph) ? g.ph > corte : null, texto: g.venoso ? '> 7,25 (venoso)' : '> 7,3 (arterial)' },
    { nome: 'Bicarbonato', atende: positivo(g.bic) ? g.bic > 15 : null, texto: '> 15 mEq/L' },
    { nome: 'Sem cetose relevante', atende: semCetose, texto: 'cetonemia < 3 mmol/L ou cetonúria ausente/baixa (+)' },
    { nome: 'Osmolalidade', atende: g.osm !== undefined && positivo(g.osm) ? g.osm > 320 : null, texto: '> 320 mOsm/kg' },
  ]
}

export const todosAtendem = (cs: Criterio[]) => (cs.some((c) => c.atende === null) ? null : cs.every((c) => c.atende))

export type GravidadeCad = 'leve' | 'moderada' | 'grave'

/** Quadro 3 (p. 515–516): leve pH < 7,3 e/ou bic < 15 (ou < 18); moderada pH < 7,2 e/ou bic < 10; grave pH < 7,1 e/ou bic < 5. */
export function gravidadeCad(ph: number, bic: number, corteBic: 15 | 18): GravidadeCad | null {
  if (!positivo(ph, bic)) return null
  if (ph < 7.1 || bic < 5) return 'grave'
  if (ph < 7.2 || bic < 10) return 'moderada'
  if (ph < 7.3 || bic < corteBic) return 'leve'
  return null
}

// ---------------------------------------------------------------- Quadro 6 (p. 517)

export const sodioRealCad = sodioCorrigidoPed
export const osmEfetivaCad = osmEfetiva

/** Ânion-gap = Na − (Cl + HCO3); normal 12 ± 2 mEq/L (Quadro 6, p. 517). */
export function anionGapCad(na: number, cl: number, hco3: number): number | null {
  if (!positivo(na, cl) || !ok(hco3) || hco3 < 0) return null
  return na - (cl + hco3)
}

export const NORMAIS_QUADRO6 = { osm: [275, 295] as [number, number], ag: [10, 14] as [number, number] }

export const NOTA_OSM_NORMAL =
  'O Quadro 6 (p. 517) dá osmolalidade efetiva normal de 275 a 295 mOsm/kg; o cap. 54 (p. 533) dá 275 a 290 mOsm/kg para o plasma.'

// ---------------------------------------------------------------- fluidos (p. 518; Figura 3, p. 519)

export const MAX_ML_H_CAD = 1000

export type Etapa = { nome: string; mlKg: number; texto: string; mlH: number; noTeto: boolean; minutos?: number; pagina: string }

/** Choque: 20 mL/kg em 20 min, reavaliar e repetir até sair do choque (máx. 1.000 mL/h). Com o teto, o tempo da alíquota aumenta. */
export function expansaoChoqueCad(pesoKg: number): Etapa | null {
  if (!positivo(pesoKg)) return null
  const volume = 20 * pesoKg
  const velocidade = volume * 3 // 20 min
  const noTeto = velocidade > MAX_ML_H_CAD
  const mlH = Math.min(velocidade, MAX_ML_H_CAD)
  return { nome: 'Choque', mlKg: 20, texto: '20 mL/kg em 20 min, reavaliar; repetir até sair do choque (máx. 1.000 mL/h)', mlH, noTeto, minutos: (volume / mlH) * 60, pagina: 'p. 518; Figura 3' }
}

/** Sem choque (ou após sair dele): 20 mL/kg/h (máx. 1.000 mL/h), em geral até ~4 h; se precisar de mais, 10 mL/kg/h. */
export function hidratacaoCad(pesoKg: number): Etapa[] | null {
  if (!positivo(pesoKg)) return null
  const e = (mlKg: number, nome: string, texto: string): Etapa => {
    const v = mlKg * pesoKg
    return { nome, mlKg, texto, mlH: Math.min(v, MAX_ML_H_CAD), noTeto: v > MAX_ML_H_CAD, pagina: 'p. 518; Figura 3' }
  }
  return [
    e(20, 'Sem choque', '20 mL/kg/h (máx. 1.000 mL/h) até melhora da hidratação clínica, em geral por volta de 4 h'),
    e(10, 'Se precisar de mais volume', '10 mL/kg/h até a hidratação clínica'),
  ]
}

/** Na expansão, glicemia < 200: push de glicose 25% 1 a 2 mL/kg (p. 518). */
export const pushGlicose25 = (pesoKg: number) => (positivo(pesoKg) ? faixaVezes([1, 2], pesoKg) : null)

/** Soro de manutenção isotônico da CAD (p. 520): SG 5% 1.000 mL + NaCl 20% 30 mL + KCl 19,1% 20 mL, no volume de Holliday-Segar. */
export const SORO_MANUTENCAO_CAD = { sg5Ml: 1000, nacl20Ml: 30, kcl191Ml: 20, pagina: 'p. 520' }

export const NOTA_SORO_CAD =
  'Esse preparo (NaCl 20% 30 mL + KCl 19,1% 20 mL, p. 520) é diferente da solução-padrão isotônica do cap. 77 (NaCl 20% 40 mL + KCl 19,1% 10 mL, p. 841).'

// ---------------------------------------------------------------- potássio (p. 520–521; Quadro 8)

export type LinhaK = { quando: string; conc: [number, number] | null; maxMeqKgH: number | null; texto: string; pagina: string }

export const REPOSICAO_K_CAD: LinhaK[] = [
  { quando: 'K < 5,5 mEq/L e/ou diurese presente', conc: [20, 30], maxMeqKgH: 0.5, texto: 'a partir da 2ª hora de hidratação, 20 a 30 mEq/L a 0,5 mEq/kg/h; metade KCl 19,1% (1 mL = 2,5 mEq) e metade fosfato de K 25% (1 mL = 1,8 mEq)', pagina: 'Quadro 8, p. 520' },
  { quando: 'K > 5,5 mEq/L na admissão', conc: null, maxMeqKgH: null, texto: 'nova amostra; na 2ª hora só fluido isotônico (NaCl 0,9% ou Ringer)', pagina: 'Quadro 8, p. 520' },
  { quando: 'K < 3,5 mEq/L na admissão', conc: [40, 40], maxMeqKgH: 1, texto: 'pode iniciar assim que houver o resultado, 40 mEq/L, até 1 mEq/kg/h conforme a depleção, monitorizado; aguardar para iniciar insulina EV contínua', pagina: 'Quadro 8, p. 521' },
]

export const NOTA_K_CAD =
  'O texto da p. 520 diz 20 a 40 mEq/L no fluido, velocidade máxima de 0,5 mEq/kg/h; o Quadro 8 diz 20 a 30 mEq/L (e 40 mEq/L até 1 mEq/kg/h com K < 3,5). A ferramenta mostra as linhas do Quadro 8 e esta divergência.'

/** Teto de K por hora (mEq/h) para o peso. */
export const kMaxMeqH = (pesoKg: number, maxMeqKgH: number) => (positivo(pesoKg, maxMeqKgH) ? pesoKg * maxMeqKgH : null)

/** KCl xarope 4 mEq/kg/dia por 48 a 72 h após a estabilização (p. 521). */
export const kclOralMeqDia = (pesoKg: number) => (positivo(pesoKg) ? 4 * pesoKg : null)

// ---------------------------------------------------------------- insulina (p. 521–522)

/** Insulina regular EV: 50 UI em 500 mL de NaCl 0,9% → 0,1 UI/mL (p. 521). */
export const INSULINA_UI_ML = 0.1

export type MotivoDose = 'menor5' | 'glicemiaMenor250' | 'transferencia' | 'grave' | 'adolescente' | 'cetosePersistente'

/**
 * 0,05 UI/kg/h: < 5 anos, glicemia < 250 no início da insulina, transferência;
 * 0,1 UI/kg/h: CAD grave, adolescência, persistência da cetose (p. 521).
 */
export function doseInsulinaPeloLivro(motivos: MotivoDose[]): { uiKgH: number | null; texto: string } {
  const baixa = motivos.some((m) => m === 'menor5' || m === 'glicemiaMenor250' || m === 'transferencia')
  const alta = motivos.some((m) => m === 'grave' || m === 'adolescente' || m === 'cetosePersistente')
  if (baixa && alta) return { uiKgH: null, texto: 'Há motivos para 0,05 e para 0,1 UI/kg/h ao mesmo tempo; o livro não diz qual prevalece.' }
  if (baixa) return { uiKgH: 0.05, texto: 'O livro recomenda 0,05 UI/kg/h nessa situação (p. 521).' }
  if (alta) return { uiKgH: 0.1, texto: 'O livro indica 0,1 UI/kg/h nessa situação (p. 521).' }
  return { uiKgH: null, texto: 'Faixa do livro: 0,05 a 0,1 UI/kg/h (p. 521).' }
}

export function insulinaEv(pesoKg: number, uiKgH: number): { uiH: number; mlH: number } | null {
  if (!positivo(pesoKg, uiKgH)) return null
  const uiH = pesoKg * uiKgH
  return { uiH, mlH: uiH / INSULINA_UI_ML }
}

/** Faixa do livro 0,05–0,1 UI/kg/h; ajuste de 0,05 UI/kg/h a mais ou a menos; alvo de queda 40–90 mg/dL/h (p. 521). */
export const INSULINA_EV = { faixa: [0.05, 0.1] as [number, number], passo: 0.05, quedaAlvo: [40, 90] as [number, number] }

/** Esquema SC do ICr-HCFMUSP: análogo rápido 0,15 U/kg a cada 2 h; se queda > 100 mg/dL/h, 0,1 UI/kg (p. 521). */
export function insulinaScIcr(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  return { inicial: 0.15 * pesoKg, reduzida: 0.1 * pesoKg }
}

/** NPH no ICr-HCFMUSP após a resolução: 0,3 UI/kg/dose a cada 8 h (p. 522). */
export const nphIcr = (pesoKg: number) => (positivo(pesoKg) ? 0.3 * pesoKg : null)

// ---------------------------------------------------------------- bicarbonato (p. 522)

/** Só em pH < 6,9 mesmo após a 1ª hora de expansão: 1–2 mEq/kg em 1–2 h ou (15 − bic) × 0,3 × peso. */
export function bicarbonatoCad(pesoKg: number, bic: number): { porKg: [number, number]; formula: number | null } | null {
  if (!positivo(pesoKg) || !ok(bic) || bic < 0) return null
  const formula = bic < 15 ? (15 - bic) * 0.3 * pesoKg : null
  return { porKg: faixaVezes([1, 2], pesoKg), formula }
}

export const PH_BICARBONATO_CAD = 6.9

// ---------------------------------------------------------------- edema cerebral (Quadro 11, p. 524)

export function edemaCerebral(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  return {
    manitolG: faixaVezes([0.5, 1], pesoKg),
    nacl3Ml: faixaVezes([2.5, 5], pesoKg),
  }
}

export const ERRATA_QUADRO11 =
  'O Quadro 11 (p. 524) tem o título "Critérios para preocupação em relação a edema cerebral e gravidade", mas lista o tratamento; os critérios de suspeita estão no Quadro 5 (p. 517).'

// ---------------------------------------------------------------- EHH (p. 522–523; Figura 4, p. 525)

export function expansaoEhh(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  return {
    texto: { mlKgH: 20, mlH: Math.min(20 * pesoKg, MAX_ML_H_CAD), noTeto: 20 * pesoKg > MAX_ML_H_CAD, horas: [2, 4] as [number, number] },
    choqueFigura4: { mlKgH: 50, mlH: Math.min(50 * pesoKg, MAX_ML_H_CAD), noTeto: 50 * pesoKg > MAX_ML_H_CAD },
  }
}

export const ERRATA_EHH_EXPANSAO =
  'O texto (p. 522) escreve "volume igual ou superior a 20 mL/kg (1.000 mL/hora) durante 2 a 4 horas" e não fala em choque; a Figura 4 (p. 525) traz 50 mL/kg/h (máx. 1.000 mL/h) até estabilidade no choque e 20 mL/kg/h (máx. 1.000 mL/h) por 2–4 h sem choque. A ferramenta lê "1.000 mL/h" como teto, como na figura, e mostra as duas linhas.'

/** Insulina no EHH: 0,025 a 0,05 U/kg/h quando a queda da glicemia for ≤ 50 mg/dL/h; alvo de queda 50–75 mg/dL/h (p. 523). */
export const INSULINA_EHH = { faixa: [0.025, 0.05] as [number, number], iniciarQuedaAte: 50, quedaAlvo: [50, 75] as [number, number] }

export const insulinaEhhUiH = (pesoKg: number) => (positivo(pesoKg) ? faixaVezes(INSULINA_EHH.faixa, pesoKg) : null)

/** Limites do EHH (p. 523; Figura 4): Na 0,5–1 mEq/L/h até 8–10 mEq/L em 24 h; osmolalidade ≤ 3 mOsm/kg/h; K 40 mEq/L. */
export const LIMITES_EHH = { naPorHora: [0.5, 1] as [number, number], na24h: [8, 10] as [number, number], osmPorHora: 3, kMeqL: 40 }

/** Magnésio no EHH: 25–50 mg/kg a cada 4–6 h; infusão máx. 150 mg/min ou 2 g/h (p. 523). */
export function magnesioEhh(pesoKg: number): { mg: [number, number]; minutosMin: [number, number] } | null {
  if (!positivo(pesoKg)) return null
  const mg = faixaVezes([25, 50], pesoKg)
  // tempo mínimo pela regra mais restritiva entre 150 mg/min e 2 g/h
  const minutos = (d: number) => Math.max(d / 150, (d / 2000) * 60)
  return { mg, minutosMin: [minutos(mg[0]), minutos(mg[1])] }
}

export const NOTA_MG_EHH = 'O livro não traz dose máxima por dose para o magnésio no EHH (p. 523); no cap. 54 o máximo é 2 g (p. 557).'

