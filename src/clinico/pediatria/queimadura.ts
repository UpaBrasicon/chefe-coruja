import { fichaIcr, ok, positivo } from './fonteIcr.ts'
import { hollidaySegarMlDia } from './manutencao.ts'

// Lesões térmicas na criança — cap. 14 do Pronto-Socorro ICr-HCFMUSP (4ª ed.,
// 2023), p. 158–164. Superfície corporal queimada pelo esquema de Lund e
// Browder (Figura 1, p. 160) e reposição pela fórmula de Parkland como o livro
// traz. A fórmula é ponto de partida; o ajuste pela clínica é do profissional.

export const fichaQueimaduraPed = fichaIcr('ped-queimadura', 'Queimadura — superfície queimada e Parkland', 'cap. 14, p. 158–164')

// ---------------------------------------------------------------- Lund e Browder (Figura 1, p. 160)

export type ColunaLB = 0 | 1 | 5 | 10
/** Colunas pediátricas da tabela da Figura 1 (as colunas 15 e adulto ficam fora: a pediatria vai até antes dos 14 anos). */
export const COLUNAS_LB: Record<ColunaLB, { a: number; b: number; c: number }> = {
  0: { a: 9.5, b: 2.75, c: 2.5 },
  1: { a: 8.5, b: 3.25, c: 2.5 },
  5: { a: 6.5, b: 4.0, c: 2.75 },
  10: { a: 5.5, b: 4.5, c: 3.0 },
}

/** Coluna da tabela pela idade: a maior idade da tabela que não passa da idade da criança (o livro não diz como escolher). */
export function colunaPorIdade(idadeAnos: number): ColunaLB | null {
  if (!ok(idadeAnos) || idadeAnos < 0 || idadeAnos >= 14) return null
  if (idadeAnos >= 10) return 10
  if (idadeAnos >= 5) return 5
  if (idadeAnos >= 1) return 1
  return 0
}

export type Regiao = { id: string; nome: string; face: 'anterior' | 'posterior' | 'única'; valor: number | 'A' | 'B' | 'C' }

/** Superfícies da Figura 1 (frente e costas), com o valor fixo impresso ou a letra da tabela. */
export const REGIOES_LB: Regiao[] = [
  { id: 'cabeca-ant', nome: 'Cabeça', face: 'anterior', valor: 'A' },
  { id: 'cabeca-post', nome: 'Cabeça', face: 'posterior', valor: 'A' },
  { id: 'pescoco-ant', nome: 'Pescoço', face: 'anterior', valor: 1 },
  { id: 'pescoco-post', nome: 'Pescoço', face: 'posterior', valor: 1 },
  { id: 'tronco-ant', nome: 'Tronco', face: 'anterior', valor: 13 },
  { id: 'tronco-post', nome: 'Tronco', face: 'posterior', valor: 13 },
  { id: 'braco-d-ant', nome: 'Braço direito', face: 'anterior', valor: 2 },
  { id: 'braco-d-post', nome: 'Braço direito', face: 'posterior', valor: 2 },
  { id: 'braco-e-ant', nome: 'Braço esquerdo', face: 'anterior', valor: 2 },
  { id: 'braco-e-post', nome: 'Braço esquerdo', face: 'posterior', valor: 2 },
  { id: 'antebraco-d-ant', nome: 'Antebraço direito', face: 'anterior', valor: 1.5 },
  { id: 'antebraco-d-post', nome: 'Antebraço direito', face: 'posterior', valor: 1.5 },
  { id: 'antebraco-e-ant', nome: 'Antebraço esquerdo', face: 'anterior', valor: 1.5 },
  { id: 'antebraco-e-post', nome: 'Antebraço esquerdo', face: 'posterior', valor: 1.5 },
  { id: 'mao-d-ant', nome: 'Mão direita', face: 'anterior', valor: 1.25 },
  { id: 'mao-d-post', nome: 'Mão direita', face: 'posterior', valor: 1.25 },
  { id: 'mao-e-ant', nome: 'Mão esquerda', face: 'anterior', valor: 1.25 },
  { id: 'mao-e-post', nome: 'Mão esquerda', face: 'posterior', valor: 1.25 },
  { id: 'genitais', nome: 'Genitais', face: 'única', valor: 1 },
  { id: 'nadega-d', nome: 'Nádega direita', face: 'posterior', valor: 2.5 },
  { id: 'nadega-e', nome: 'Nádega esquerda', face: 'posterior', valor: 2.5 },
  { id: 'coxa-d-ant', nome: 'Coxa direita', face: 'anterior', valor: 'B' },
  { id: 'coxa-d-post', nome: 'Coxa direita', face: 'posterior', valor: 'B' },
  { id: 'coxa-e-ant', nome: 'Coxa esquerda', face: 'anterior', valor: 'B' },
  { id: 'coxa-e-post', nome: 'Coxa esquerda', face: 'posterior', valor: 'B' },
  { id: 'perna-d-ant', nome: 'Perna direita', face: 'anterior', valor: 'C' },
  { id: 'perna-d-post', nome: 'Perna direita', face: 'posterior', valor: 'C' },
  { id: 'perna-e-ant', nome: 'Perna esquerda', face: 'anterior', valor: 'C' },
  { id: 'perna-e-post', nome: 'Perna esquerda', face: 'posterior', valor: 'C' },
  { id: 'pe-d-ant', nome: 'Pé direito', face: 'anterior', valor: 1.75 },
  { id: 'pe-d-post', nome: 'Pé direito', face: 'posterior', valor: 1.75 },
  { id: 'pe-e-ant', nome: 'Pé esquerdo', face: 'anterior', valor: 1.75 },
  { id: 'pe-e-post', nome: 'Pé esquerdo', face: 'posterior', valor: 1.75 },
]

export function valorRegiao(r: Regiao, coluna: ColunaLB): number {
  if (typeof r.valor === 'number') return r.valor
  const c = COLUNAS_LB[coluna]
  return r.valor === 'A' ? c.a : r.valor === 'B' ? c.b : c.c
}

/** Soma de todas as superfícies na coluna (deveria dar 100%). */
export function totalCorpo(coluna: ColunaLB): number {
  return REGIOES_LB.reduce((s, r) => s + valorRegiao(r, coluna), 0)
}

/**
 * SCQ (%) = Σ valor da região × fração queimada (0 a 1). Só entram queimaduras de 2º e 3º graus (p. 159).
 * `fracoes`: id da região → fração da região queimada.
 */
export function superficieQueimada(coluna: ColunaLB, fracoes: Record<string, number>): number | null {
  let soma = 0
  for (const [id, f] of Object.entries(fracoes)) {
    const r = REGIOES_LB.find((x) => x.id === id)
    if (!r || !ok(f) || f < 0 || f > 1) return null
    soma += valorRegiao(r, coluna) * f
  }
  return soma
}

export const ERRATA_LUND_BROWDER = [
  'Figura 1 (p. 160): uma das mãos, na vista anterior, está com "1", e as outras três faces de mão com "1¼". Com "1" a coluna de 0 ano soma 99,75%; com 1¼ nas quatro faces as colunas 0, 1 e 5 anos somam 100%. A ferramenta usa 1¼ nas quatro faces.',
  'Figura 1 (p. 160): na coluna de 10 anos, B = 4,5 faz o corpo somar 101% (as colunas 0, 1 e 5 somam 100%). O valor impresso é mantido e o total da coluna aparece na tela.',
  'O livro não diz qual coluna usar entre as idades da tabela; a ferramenta usa a maior idade da tabela que não passa da idade da criança (0, 1, 5 ou 10 anos).',
]

/** Regra da mão espalmada: a mão da criança ≈ 1% da superfície corpórea (p. 159). */
export const MAO_ESPALMADA_PCT = 1

/** Grande queimado em pediatria: > 10% da superfície corporal (p. 159). */
export const GRANDE_QUEIMADO_PCT = 10

// ---------------------------------------------------------------- Parkland (p. 161–162)

/** Parkland: < 14 anos → 3 mL/kg/%SCQ; SCQ acima de 50% entra como 50% (p. 161). */
export const PARKLAND_ML_KG_PCT = 3
export const SCQ_TETO = 50

export type Parkland = {
  scqUsada: number
  totalMl: number
  primeiras8hMl: number
  seguintes16hMl: number
  /** mL/h no restante das primeiras 8 h a contar do acidente */
  mlHAte8h: number | null
  mlH16h: number
  horasRestantes8h: number
}

/**
 * 50% do volume nas primeiras 8 h a contar do acidente e 50% nas 16 h seguintes (p. 162).
 * `horasDesdeAcidente`: tempo já passado; a primeira metade é dividida pelo que resta das 8 h.
 */
export function parkland(pesoKg: number, scq: number, horasDesdeAcidente = 0): Parkland | null {
  if (!positivo(pesoKg, scq) || scq > 100 || !ok(horasDesdeAcidente) || horasDesdeAcidente < 0) return null
  const scqUsada = Math.min(scq, SCQ_TETO)
  const totalMl = PARKLAND_ML_KG_PCT * pesoKg * scqUsada
  const primeiras8hMl = totalMl / 2
  const horasRestantes8h = Math.max(0, 8 - horasDesdeAcidente)
  return {
    scqUsada,
    totalMl,
    primeiras8hMl,
    seguintes16hMl: totalMl / 2,
    mlHAte8h: horasRestantes8h > 0 ? primeiras8hMl / horasRestantes8h : null,
    mlH16h: totalMl / 2 / 16,
    horasRestantes8h,
  }
}

/** Em < 5 anos ou 30 kg o livro acrescenta soro de manutenção à Parkland (p. 161). */
export function somaManutencao(idadeAnos: number, pesoKg: number): boolean | null {
  if (!ok(idadeAnos) || !positivo(pesoKg) || idadeAnos < 0) return null
  return idadeAnos < 5 || pesoKg < 30
}

/** Manutenção de 24 h pela regra de Holliday-Segar do próprio livro (cap. 77, p. 840), para somar à Parkland. */
export const manutencao24hMl = hollidaySegarMlDia

export const NOTA_MANUTENCAO =
  'O cap. 14 diz só "acrescida de soro de manutenção" (p. 161); a conta usa a regra de Holliday-Segar do cap. 77 do mesmo livro (p. 840). "Menores de 5 anos ou 30 kg" é lido como menos de 5 anos ou menos de 30 kg.'

/** Diurese-alvo nas primeiras 24 h: até 30 kg 1–2 mL/kg/h; acima de 30 kg 0,5–1 mL/kg/h; dobro com hematúria/mioglobinúria (p. 162). */
export function diureseAlvo(pesoKg: number, pigmento = false): { mlKgH: [number, number]; mlH: [number, number] } | null {
  if (!positivo(pesoKg)) return null
  const base: [number, number] = pesoKg <= 30 ? [1, 2] : [0.5, 1]
  const mlKgH: [number, number] = pigmento ? [base[0] * 2, base[1] * 2] : base
  return { mlKgH, mlH: [mlKgH[0] * pesoKg, mlKgH[1] * pesoKg] }
}

/** Pré-hospitalar: SCQ > 10% ou transporte prolongado → SF ou Ringer lactato 10 mL/kg/h (p. 161). */
export const PRE_HOSPITALAR_ML_KG_H = 10

export const AVISO_ELETRICA =
  'Queimadura elétrica: o livro diz que as fórmulas não devem ser usadas para estimar o volume, porque subestimam a lesão; o alvo de diurese é > 2 mL/kg/h abaixo de 30 kg se houver hemocromógenos (p. 163–164).'
