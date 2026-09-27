import { fichaAdulto } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao } from './infusoes.ts'

// Arritmias e PCR do adulto — Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022): cap. 2 PCR no adulto (p. 48–51), cap. 15 Bradiarritmias
// (p. 229) e cap. 18 Outras taquiarritmias (p. 265–266). Uma ficha por
// ferramenta. A ferramenta calcula o que depende de peso ou de tempo; a
// indicação é do médico (ADR 0007).

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0
const vezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

export type ItemManual = {
  id: string
  nome: string
  dose: string
  quando: string
  pagina: string
  errata?: string
  nota?: string
}

// ── PCR (cap. 2) ─────────────────────────────────────────────────────────────

export const fichaPcrAdulto = fichaAdulto('adulto-pcr', 'Drogas e desfibrilação na PCR — adulto', 'cap. 2 PCR no adulto, p. 48–51 (Tabela 2)')

export const CHOQUE_PCR = { monofasicoJ: 360, bifasicoJ: 200, pagina: 'p. 48' }

export const DROGAS_PCR: ItemManual[] = [
  { id: 'adrenalina', nome: 'Adrenalina', dose: '1 mg IV ou IO a cada 3 a 5 minutos', quando: 'todos os ritmos; após o 2º choque em FV/TV sem pulso; em AESP/assistolia o mais precocemente possível', pagina: 'p. 49' },
  { id: 'amiodarona', nome: 'Amiodarona', dose: '1ª dose 300 mg IV/IO; 2ª dose 150 mg IV/IO', quando: 'FV/TV sem pulso — 1ª dose após o 3º choque, 2ª após o 5º', pagina: 'p. 49' },
  { id: 'lidocaina', nome: 'Lidocaína', dose: '1–1,5 mg/kg', quando: 'FV/TV sem pulso, como alternativa à amiodarona', pagina: 'p. 49' },
  { id: 'magnesio', nome: 'Magnésio', dose: '1–2 g IV em bolus; manutenção 0,5 a 2 g/h', quando: 'torsades de pointes; hipomagnesemia', pagina: 'p. 49' },
  { id: 'bicarbonato', nome: 'Bicarbonato de sódio 8,4%', dose: '1–1,5 mEq/kg IV; adicional: metade da dose a cada 5–15 minutos', quando: 'intoxicação por tricíclicos, hipercalemia, acidose metabólica grave previamente conhecida', pagina: 'p. 50',
    nota: 'O livro dá a dose em mEq; o volume em mL não é calculado porque o capítulo não traz a concentração em mEq/mL.' },
  { id: 'calcio', nome: 'Gluconato de cálcio 10%', dose: '20–30 mL IV a cada 2–5 minutos', quando: 'hipercalemia', pagina: 'p. 50' },
  { id: 'kcl', nome: 'KCl 19,1%', dose: '2 mEq/min durante 10 minutos (20 mEq); manutenção "0,5–1 mEq por mais 10 minutos" se PCR mantida', quando: 'hipocalemia', pagina: 'p. 50',
    errata: 'Na manutenção falta a unidade de tempo ("0,5–1 mEq por mais 10 minutos"): não se sabe se é por minuto. A manutenção não é calculada.' },
  { id: 'alteplase', nome: 'Alteplase', dose: '50 mg IV em bolus, podendo ser repetido após 15 minutos; o consenso europeu orienta compressões por 60–90 min após', quando: 'TEP suspeito ou confirmado (não trombolisar IAM)', pagina: 'p. 50' },
  { id: 'emulsao', nome: 'Emulsão lipídica', dose: '1,5 mL/kg IV em 1 minuto e infusão de 0,25 mL/kg/min por 30–60 minutos', quando: 'intoxicação por anestésico local', pagina: 'p. 50' },
  { id: 'glicose-insulina', nome: 'Glicose + insulina', dose: '25 g de glicose + 10 U de insulina regular IV em bolus', quando: 'hipercalemia', pagina: 'p. 51' },
]

export type PcrPorPeso = {
  lidocainaMg: Faixa
  bicarbonatoMEq: Faixa
  bicarbonatoAdicionalMEq: Faixa
  emulsaoBolusMl: number
  emulsaoMlMin: number
  emulsaoMlH: number
  /** volume da infusão em 30 e em 60 minutos */
  emulsaoInfusaoMl: Faixa
}

/** Doses por peso da Tabela 2 (p. 49–50). */
export function calcularPcr(pesoKg: number): PcrPorPeso | null {
  if (!valido(pesoKg)) return null
  const bic = vezes([1, 1.5], pesoKg)
  const mlMin = 0.25 * pesoKg
  return {
    lidocainaMg: vezes([1, 1.5], pesoKg),
    bicarbonatoMEq: bic,
    bicarbonatoAdicionalMEq: [bic[0] / 2, bic[1] / 2],
    emulsaoBolusMl: 1.5 * pesoKg,
    emulsaoMlMin: mlMin,
    emulsaoMlH: mlMin * 60,
    emulsaoInfusaoMl: [mlMin * 30, mlMin * 60],
  }
}

/** KCl 19,1%: 2 mEq/min por 10 min (p. 50). */
export const KCL_ATAQUE_MEQ = 2 * 10

// ── Bradiarritmias (cap. 15) ─────────────────────────────────────────────────

export const fichaBradicardiaAdulto = fichaAdulto(
  'adulto-bradicardia',
  'Bradicardia sintomática — adulto',
  'cap. 15 Bradiarritmias, p. 229; preparo da adrenalina: Anexo 1, p. 1487–1488',
)

export const ATROPINA = { doseMg: 0.5, intervaloMin: 3, maximoMg: 3, pagina: 'p. 229' }

/** Nº de doses de atropina até o máximo e minutos até a última (p. 229). */
export function esquemaAtropina() {
  const n = Math.round(ATROPINA.maximoMg / ATROPINA.doseMg)
  return { doses: n, minutosAteUltima: (n - 1) * ATROPINA.intervaloMin }
}

export const DOPAMINA_BRADI: Faixa = [5, 20] // µg/kg/min, p. 229

/** Dopamina 5–20 µg/kg/min em µg/min para o peso. O livro não traz preparo de dopamina. */
export function dopaminaUgMin(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? vezes(DOPAMINA_BRADI, pesoKg) : null
}

/**
 * Adrenalina na bradicardia: o livro imprime 2–10 µg/kg/min (p. 229). A
 * unidade coerente é µg/min — é a unidade da adrenalina no Anexo 1 do mesmo
 * livro (faixa 1–20 µg/min, p. 1487–1488). A conta usa 2–10 µg/min e o
 * preparo do Anexo 1 (60 µg/mL).
 */
export const ADRENALINA_BRADI = {
  ugMin: [2, 10] as Faixa,
  pagina: 'p. 229',
  errata: 'O livro escreve "adrenalina 2-10 µg/kg/min". A unidade coerente é µg/min (Anexo 1 do mesmo livro: adrenalina 1–20 µg/min, p. 1487–1488). Em µg/kg/min, um adulto de 70 kg receberia 140–700 µg/min, 7 a 35 vezes o teto do anexo.',
}

const adrenalinaAnexo = () => INFUSOES_ADULTO.find((i) => i.id === 'adrenalina')!

/** mL/h da adrenalina 2–10 µg/min no preparo do Anexo 1 (60 µg/mL). */
export function adrenalinaBradiMlH(): Faixa {
  const c = concentracao(adrenalinaAnexo())
  return [(ADRENALINA_BRADI.ugMin[0] * 60) / c, (ADRENALINA_BRADI.ugMin[1] * 60) / c]
}

/** O que a unidade impressa (µg/kg/min) daria — só para mostrar o tamanho do erro. */
export function adrenalinaUnidadeImpressaUgMin(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? vezes(ADRENALINA_BRADI.ugMin, pesoKg) : null
}

export const OUTRAS_BRADI: ItemManual[] = [
  { id: 'glucagon', nome: 'Glucagon', dose: 'bolus de 5–10 mg em alguns minutos, seguido de infusão contínua de 1 a 5 mg/h', quando: 'intoxicação por bloqueador de canal de cálcio ou betabloqueador', pagina: 'p. 229' },
  { id: 'aminofilina', nome: 'Aminofilina', dose: '250 mg EV em bolus', quando: 'IAM com BAV de 2º ou 3º grau, sem instabilidade ou sintomas graves', pagina: 'p. 229' },
]

// ── Outras taquiarritmias (cap. 18) ──────────────────────────────────────────

export const fichaTaquiarritmiaAdulto = fichaAdulto('adulto-taquiarritmias', 'Taquiarritmias — drogas EV do adulto', 'cap. 18 Outras taquiarritmias, p. 265–266')

/** Adenosina: 6 mg; se não resolver em 2 min, 12 mg, que pode ser repetida uma vez. Metade em acesso central de cava superior (p. 265). */
export function adenosina(acessoCentral: boolean): number[] {
  const doses = [6, 12, 12]
  return acessoCentral ? doses.map((d) => d / 2) : doses
}

/** Amiodarona na TV estável: 150 mg em 10 min, 1 mg/min por 6 h, 0,5 mg/min por 18 h (p. 265). */
export function esquemaAmiodarona() {
  const fases = [
    { fase: 'ataque', mg: 150, duracao: '10 min', mgMin: 15 },
    { fase: '1 mg/min por 6 h', mg: 1 * 60 * 6, duracao: '6 h', mgMin: 1 },
    { fase: '0,5 mg/min por 18 h', mg: 0.5 * 60 * 18, duracao: '18 h', mgMin: 0.5 },
  ]
  return { fases, total24hMg: fases.reduce((s, f) => s + f.mg, 0) }
}

export const LIDOCAINA_TV = {
  ataqueMgKg: [0.7, 1.4] as Faixa,
  velocidadeMgMin: 50,
  tetoMgHora: [200, 300] as Faixa,
  pagina: 'p. 265',
  errata: 'O livro escreve "1 a 4 mg/kg é a dose preconizada de infusão contínua": falta a unidade de tempo, e infusão de lidocaína não é dada em mg/kg. A infusão contínua não é calculada; o teto de 200–300 mg em 1 hora é mostrado como está.',
}

export type LidocainaTv = { ataqueMg: Faixa; minutos: Faixa; doisAtaquesMg: Faixa; doisAtaquesPassamDe200: boolean }

/** Ataque da lidocaína (repetível após 5 min) e tempo a 50 mg/min (p. 265). */
export function lidocainaTv(pesoKg: number): LidocainaTv | null {
  if (!valido(pesoKg)) return null
  const mg = vezes(LIDOCAINA_TV.ataqueMgKg, pesoKg)
  const dois = vezes(mg, 2)
  return { ataqueMg: mg, minutos: [mg[0] / 50, mg[1] / 50], doisAtaquesMg: dois, doisAtaquesPassamDe200: dois[1] > LIDOCAINA_TV.tetoMgHora[0] }
}

/** Bloqueadores de canal de cálcio EV (p. 266): velocidade e dose total → minutos até o total. */
export const BCC_EV = [
  { id: 'verapamil', nome: 'Verapamil', mgMin: 1, totalMg: 20, pagina: 'p. 266' },
  { id: 'diltiazem', nome: 'Diltiazem', mgMin: 2.5, totalMg: 50, pagina: 'p. 266' },
].map((d) => ({ ...d, minutosAteTotal: d.totalMg / d.mgMin }))

export const MAGNESIO_TORSADES = { g: 2, minutos: 15, pagina: 'p. 266' }
