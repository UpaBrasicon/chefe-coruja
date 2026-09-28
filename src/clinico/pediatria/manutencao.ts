import { fichaIcr, positivo } from './fonteIcr.ts'

// Fluidoterapia de manutenção — cap. 77 do Pronto-Socorro ICr-HCFMUSP (4ª ed.,
// 2023), p. 838–843. Calcula a necessidade hídrica basal (Holliday-Segar e a
// regra prática), mostra as soluções-padrão do livro e as categorias da
// Figura 1. A escolha da solução e da velocidade é do profissional (ADR 0007).

export const fichaManutencaoPed = fichaIcr('ped-fluidoterapia-manutencao', 'Fluidoterapia de manutenção — Holliday-Segar', 'cap. 77, p. 838–843')

/** Teto de velocidade do livro para a bomba de infusão (p. 840–841). */
export const MAX_ML_H = 100

/**
 * Holliday-Segar, volume em 24 h (p. 840):
 * até 10 kg → 100 × peso; 10–20 kg → 1.000 + 50 × (peso − 10); acima de 20 kg → 1.500 + 20 × (peso − 20).
 */
export function hollidaySegarMlDia(pesoKg: number): number | null {
  if (!positivo(pesoKg)) return null
  if (pesoKg <= 10) return 100 * pesoKg
  if (pesoKg <= 20) return 1000 + 50 * (pesoKg - 10)
  return 1500 + 20 * (pesoKg - 20)
}

/**
 * Regra prática, velocidade (p. 841): até 10 kg → 4 × peso; 10–20 kg → 40 + 2 × (peso − 10);
 * acima de 20 kg → 60 + 1 × (peso − 20) mL/h.
 */
export function regraPraticaMlH(pesoKg: number): number | null {
  if (!positivo(pesoKg)) return null
  if (pesoKg <= 10) return 4 * pesoKg
  if (pesoKg <= 20) return 40 + 2 * (pesoKg - 10)
  return 60 + (pesoKg - 20)
}

export type Manutencao = {
  mlDia: number
  /** mL/dia ÷ 24, sem teto */
  mlHCalculado: number
  /** mL/h com o teto de 100 mL/h do livro */
  mlH: number
  praticaMlH: number
  noTeto: boolean
}

export function manutencao(pesoKg: number): Manutencao | null {
  const mlDia = hollidaySegarMlDia(pesoKg)
  const pratica = regraPraticaMlH(pesoKg)
  if (mlDia === null || pratica === null) return null
  const mlHCalculado = mlDia / 24
  const noTeto = mlHCalculado > MAX_ML_H || pratica > MAX_ML_H
  return { mlDia, mlHCalculado, mlH: Math.min(mlHCalculado, MAX_ML_H), praticaMlH: Math.min(pratica, MAX_ML_H), noTeto }
}

export const ERRATA_FAIXAS_HOLLIDAY =
  'As faixas estão impressas como "< 10 kg", "11-20 kg" e "≥ 21 kg" (e "0-10 / 11-20 / ≥ 21" na regra prática, p. 840–841), o que deixa sem regra pesos entre 10 e 11 kg e entre 20 e 21 kg. As fórmulas coincidem nas bordas (10 kg → 1.000 mL/dia; 20 kg → 1.500 mL/dia), então a ferramenta usa as três faixas contínuas.'

/** Exemplo do livro: 17 kg → 1.350 mL/dia, 56 mL/h; regra prática 54 mL/h (p. 841–842). */
export const EXEMPLO_LIVRO = { pesoKg: 17, mlDia: 1350, mlH: 56, praticaMlH: 54, pagina: 'p. 841–842' }

// ---------------------------------------------------------------- soluções

/** Concentrações das ampolas usadas nas soluções-padrão — Tabela 11 do cap. 54 (p. 558). */
export const NACL20_MEQ_ML = 3.4
export const KCL191_MEQ_ML = 2.5

export type SolucaoPadrao = {
  id: 'isotonica' | 'hipotonica'
  nome: string
  sg5Ml: number
  nacl20Ml: number
  kcl191Ml: number
  /** valores impressos na Tabela 2 (p. 841) */
  livro: { na: number; k: number; cl: number; osm: number; glicoseG: number }
}

/** Tabela 2 — soluções-padrão utilizadas no Brasil (p. 841). */
export const SOLUCOES_PADRAO: SolucaoPadrao[] = [
  { id: 'isotonica', nome: 'Solução de manutenção isotônica', sg5Ml: 1000, nacl20Ml: 40, kcl191Ml: 10, livro: { na: 136, k: 25, cl: 151, osm: 570, glicoseG: 50 } },
  { id: 'hipotonica', nome: 'Solução de manutenção hipotônica', sg5Ml: 1000, nacl20Ml: 10, kcl191Ml: 10, livro: { na: 34, k: 25, cl: 59, osm: 321, glicoseG: 50 } },
]

export type Composicao = { volumeMl: number; naMeq: number; kMeq: number; clMeq: number; glicoseG: number; osmMOsmL: number; naMeqL: number }

/** Composição a partir do preparo, com as concentrações da Tabela 11 (p. 558). Glicose: 180 mg/mmol. */
export function composicao(s: SolucaoPadrao): Composicao {
  const volumeMl = s.sg5Ml + s.nacl20Ml + s.kcl191Ml
  const naMeq = s.nacl20Ml * NACL20_MEQ_ML
  const kMeq = s.kcl191Ml * KCL191_MEQ_ML
  const clMeq = naMeq + kMeq
  const glicoseG = (s.sg5Ml * 5) / 100
  const mOsm = (glicoseG * 1000) / 180 + 2 * naMeq + 2 * kMeq
  return { volumeMl, naMeq, kMeq, clMeq, glicoseG, osmMOsmL: (mOsm / volumeMl) * 1000, naMeqL: (naMeq / volumeMl) * 1000 }
}

export const ERRATA_TABELAS_SOLUCOES =
  'Nas Tabelas 1 e 2 (p. 840–841) a unidade está impressa "mEq/mL"; os números são mEq/L (Tabela 1) e mEq por frasco preparado (Tabela 2: 40 mL de NaCl 20% × 3,4 mEq/mL = 136 mEq; 10 mL de KCl 19,1% × 2,5 mEq/mL = 25 mEq — concentrações da Tabela 11, p. 558). Ainda na Tabela 2: cloreto da isotônica impresso 151, mas NaCl + KCl somam 161 mEq; osmolaridade da hipotônica impressa 321, mas a mesma conta que reproduz os 570 da isotônica dá ~388 mOsm/L.'

/** Tabela 1 — principais soluções (p. 840), em mEq/L; osmolaridade em mOsm/L. */
export const TABELA_SOLUCOES = [
  { nome: 'SF (NaCl 0,9%)', na: 154, k: null, cl: 154, osm: '308' },
  { nome: 'Ringer acetato', na: 130, k: 5, cl: 112, osm: '276' },
  { nome: 'Ringer lactato', na: 130, k: 4, cl: 109, osm: '274' },
  { nome: 'Plasma-Lyte', na: 140, k: 5, cl: 98, osm: '294' },
  { nome: 'SG 5%/SF', na: 77, k: null, cl: 77, osm: '(154)' },
  { nome: 'Holliday-Segar', na: 30, k: 25, cl: 55, osm: '110' },
] as const

// ---------------------------------------------------------------- Figura 1

export type Categoria = {
  id: string
  grupo: string
  exemplos: string
  /** fração do volume calculado (Holliday-Segar), como o livro traz para a criança */
  fracao: [number, number]
  nota?: string
}

/** Figura 1 — categorias para escolher solução e velocidade (p. 842). Solução: SG 5% 1.000 mL + NaCl 20% 40 mL. */
export const CATEGORIAS_FIGURA1: Categoria[] = [
  { id: 'oligurico', grupo: 'Estados oligúricos', exemplos: 'insuficiência renal crônica, necrose tubular aguda, glomerulonefrite aguda', fracao: [0.25, 0.25] },
  { id: 'edematoso', grupo: 'Estados edematosos', exemplos: 'insuficiência cardíaca, cirrose, nefrose', fracao: [0.4, 0.6] },
  { id: 'adh', grupo: 'Estados euvolêmicos com excesso de ADH', exemplos: 'doenças respiratórias, câncer, pós-operatório, doenças do SNC (meningite, encefalite)', fracao: [1, 1] },
  { id: 'snc', grupo: 'Doença do SNC com risco de herniação', exemplos: 'edema cerebral, hipertensão intracraniana', fracao: [1, 1], nota: 'O livro anota que pode ser necessário ajustar para hipertônico para manter Na > 140.' },
  { id: 'concentracao', grupo: 'Defeitos de concentração renal', exemplos: 'diabetes insipidus nefrogênico, uropatia obstrutiva, nefrite intersticial, doença falciforme, uso de lítio', fracao: [1.2, 1.2], nota: 'O livro anota que pode precisar ser ajustado para soro hipotônico.' },
]

/** Volume da categoria: fração × Holliday-Segar (mL/h, com o teto de 100 mL/h). */
export function volumeCategoria(pesoKg: number, c: Categoria): [number, number] | null {
  const m = manutencao(pesoKg)
  if (!m) return null
  return [Math.min(m.mlHCalculado * c.fracao[0], MAX_ML_H), Math.min(m.mlHCalculado * c.fracao[1], MAX_ML_H)]
}

/** Figura 1: depleção de volume/hipoperfusão → 20 mL/kg de soro isotônico na criança, repetindo até perfusão adequada (p. 842). */
export const EXPANSAO_ML_KG = 20

export function expansaoMl(pesoKg: number): number | null {
  return positivo(pesoKg) ? EXPANSAO_ML_KG * pesoKg : null
}
