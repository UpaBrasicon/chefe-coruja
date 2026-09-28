import { fichaIcr, ok, positivo } from './fonteIcr.ts'

// Hipoglicemia na criança — cap. 51 do Pronto-Socorro ICr-HCFMUSP (4ª ed.,
// 2023), p. 507–511. Glicose por via oral, EV e glucagon por peso e idade,
// velocidade de infusão de glicose (VIG). O capítulo não traz valor neonatal
// próprio (a Tabela 2 começa em "lactentes"); o recém-nascido fica de fora.

export const fichaHipoglicemiaPed = fichaIcr('ped-hipoglicemia', 'Hipoglicemia — glicose e glucagon por peso', 'cap. 51, p. 507–511')

export const LIMIARES_GLICEMIA = {
  /** tríade de Whipple: glicemia venosa total < 40 ou plasmática/sérica < 45 mg/dL (p. 507) */
  sangueTotal: 40,
  plasma: 45,
  /** < 70 mg/dL com sintomas confirma o diagnóstico (p. 509) */
  comSintomas: 70,
  /** função cerebral prejudicada abaixo de 55–65; sintomas neurológicos < 55; cognição < 50 (p. 509) */
  funcaoCerebral: [55, 65] as [number, number],
}

// ---------------------------------------------------------------- via oral (p. 510)

/** 0,3 g/kg de carboidrato de rápida absorção; o livro põe "(10 a 20 g)" ao lado (p. 510). */
export const ORAL_G_KG = 0.3
export const ORAL_REFERENCIA_G: [number, number] = [10, 20]

export function glicoseOralG(pesoKg: number): number | null {
  return positivo(pesoKg) ? ORAL_G_KG * pesoKg : null
}

/** Opções do livro com gramas por porção (p. 510). */
export const OPCOES_ORAIS = [
  { nome: 'Tablete de glicose', g: 5, porcao: 'tablete' },
  { nome: 'Gel de glicose', g: 15, porcao: 'sachê' },
  { nome: 'Suco de fruta adoçado', g: 12, porcao: '120 mL' },
  { nome: 'Refrigerante não diet', g: 18, porcao: '180 mL' },
  { nome: 'Mel', g: 17, porcao: '15 mL (1 colher de sopa)' },
  { nome: 'Açúcar refinado', g: 12.5, porcao: '1 colher de sopa' },
] as const

// ---------------------------------------------------------------- EV (p. 510–511)

/** PALS no texto: 0,5 a 1 g/kg EV, dose máxima 25 g (p. 510). */
export const EV_G_KG: [number, number] = [0.5, 1]
export const EV_MAX_G = 25

export type LinhaEv = {
  fonte: 'texto' | 'tabela'
  solucao: 'SG 10%' | 'SG 25%' | 'SG 50%'
  pct: number
  mlKg: [number, number]
  maxMl?: number
  preparo?: string
  pagina: string
}

export type LinhaEvCalculada = LinhaEv & { ml: [number, number]; g: [number, number]; limitada: boolean }

/** Texto (p. 510): até 12 anos → SG 10% 5–10 mL/kg ou SG 25% 2–4 mL/kg; ≥ 12 anos → SG 25% 1–2 mL/kg. */
export function linhasTexto(idadeAnos: number): LinhaEv[] | null {
  if (!ok(idadeAnos) || idadeAnos < 0) return null
  if (idadeAnos < 12)
    return [
      { fonte: 'texto', solucao: 'SG 10%', pct: 10, mlKg: [5, 10], pagina: 'p. 510' },
      { fonte: 'texto', solucao: 'SG 25%', pct: 25, mlKg: [2, 4], pagina: 'p. 510' },
    ]
  return [{ fonte: 'texto', solucao: 'SG 25%', pct: 25, mlKg: [1, 2], pagina: 'p. 510' }]
}

/**
 * Tabela 2 (p. 511): lactentes (até 2 anos) SG 10% 5–10 mL/kg; crianças acima de 2 anos SG 25% 2–5 mL/kg
 * (máx. 25 g = 100 mL); adolescentes SG 50% 1–2 mL/kg (máx. 50 mL). A tabela não diz a idade de "adolescente";
 * a ferramenta usa os 12 anos do texto da p. 510.
 */
export function linhaTabela(idadeAnos: number): LinhaEv | null {
  if (!ok(idadeAnos) || idadeAnos < 0) return null
  if (idadeAnos <= 2) return { fonte: 'tabela', solucao: 'SG 10%', pct: 10, mlKg: [5, 10], preparo: '1 mL/kg de G50 + 4 mL/kg de água destilada', pagina: 'Tabela 2, p. 511' }
  if (idadeAnos < 12) return { fonte: 'tabela', solucao: 'SG 25%', pct: 25, mlKg: [2, 5], maxMl: 100, preparo: '1 mL/kg de G50 + 1 mL/kg de água destilada', pagina: 'Tabela 2, p. 511' }
  return { fonte: 'tabela', solucao: 'SG 50%', pct: 50, mlKg: [1, 2], maxMl: 50, pagina: 'Tabela 2, p. 511' }
}

/** Calcula mL e gramas da linha; limita pelo máximo de mL da linha e pelos 25 g do texto (p. 510). */
export function calcularLinha(l: LinhaEv, pesoKg: number): LinhaEvCalculada | null {
  if (!positivo(pesoKg)) return null
  const maxMlPorG = (EV_MAX_G * 100) / l.pct
  const teto = Math.min(l.maxMl ?? Infinity, maxMlPorG)
  const bruto: [number, number] = [l.mlKg[0] * pesoKg, l.mlKg[1] * pesoKg]
  const ml: [number, number] = [Math.min(bruto[0], teto), Math.min(bruto[1], teto)]
  return { ...l, ml, g: [(ml[0] * l.pct) / 100, (ml[1] * l.pct) / 100], limitada: bruto[1] > teto }
}

export const ERRATA_HIPOGLICEMIA_EV = [
  'Texto x Tabela 2: o texto (p. 510) põe o corte em 12 anos (SG 10% ou SG 25% até 12 anos); a Tabela 2 (p. 511) põe SG 10% só até 2 anos e SG 25% 2–5 mL/kg acima de 2 anos. As duas linhas são mostradas.',
  'Adolescentes: o texto (p. 510) traz SG 25% 1–2 mL/kg (0,25–0,5 g/kg, abaixo dos 0,5–1 g/kg da mesma página); a Tabela 2 (p. 511) traz SG 50% 1–2 mL/kg (0,5–1 g/kg). As duas linhas são mostradas, com os gramas.',
]

// ---------------------------------------------------------------- glucagon (p. 510)

/** 0,5 mg (< 25 kg) ou 1 mg (≥ 25 kg) IM ou SC; máximo 1 mg (p. 510). */
export function glucagonMg(pesoKg: number): number | null {
  if (!positivo(pesoKg)) return null
  return pesoKg < 25 ? 0.5 : 1
}

// ---------------------------------------------------------------- VIG (p. 510)

/** VIG inicial: lactentes 5–6 mg/kg/min; crianças mais velhas 2–3 mg/kg/min (p. 510). */
export const VIG_INICIAL = { lactente: [5, 6] as [number, number], criancaMaior: [2, 3] as [number, number] }

/** Taxa (mL/h) = VIG (mg/kg/min) × 6 × peso ÷ % de dextrose (p. 510). */
export function taxaDextroseMlH(vig: number, pesoKg: number, pct: number): number | null {
  if (!positivo(vig, pesoKg, pct)) return null
  return (vig * 6 * pesoKg) / pct
}

/** VIG a partir da taxa (inverso da fórmula da p. 510). */
export function vigDaTaxa(mlH: number, pesoKg: number, pct: number): number | null {
  if (!positivo(mlH, pesoKg, pct)) return null
  return (mlH * pct) / (6 * pesoKg)
}

/** Manutenção da Tabela 2 (p. 511): SG 10% 1.000 mL + NaCl 20% 40 mL + KCl 19,1% 10 mL; manter glicemia 70–200 mg/dL. */
export const MANUTENCAO_TABELA2 = { sg10Ml: 1000, nacl20Ml: 40, kcl191Ml: 10, glicemia: [70, 200] as [number, number], pagina: 'Tabela 2, p. 511' }
