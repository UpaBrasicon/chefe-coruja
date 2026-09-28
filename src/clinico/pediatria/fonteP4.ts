import type { Ficha } from '../ficha.ts'
import { LIVRO_PS_PED, fichaPediatrica } from './fonte.ts'
import type { Faixa } from './fonteP2.ts'

// Lote P4 — ferramentas pediátricas do livro Pronto-Socorro ICr-HCFMUSP
// (4ª ed., 2023). Só entra o que o livro traz para a criança, com página
// (numeração do PDF). Máximos de antibióticos e analgésicos que o capítulo não
// traz saem da Tabela 2 do Apêndice (p. 897–910) e são citados como tal. O que
// falta no livro fica de fora; nada é convertido do adulto; erros de impressão
// conferidos no PDF ficam como errata junto da regra.

export const fichaP4 = (id: string, titulo: string, paginas: string): Ficha =>
  fichaPediatrica(id, titulo, paginas, LIVRO_PS_PED)

/** Recém-nascido: o capítulo não traz valor neonatal explícito para este cálculo. */
export const SEM_VALOR_NEONATAL_P4 =
  'O capítulo não traz valor explícito para o recém-nascido neste cálculo. Para o período neonatal a ferramenta não calcula dose nem volume.'

export type Unidade = 'mg' | 'µg' | 'g' | 'UI' | 'mEq' | 'mL'

/**
 * Dose de um medicamento como o livro escreve: por kg por DIA dividida em
 * doses, por kg por DOSE, ou dose fixa. Máximos por dose e por dia na mesma
 * unidade. `neonatal`: o livro dá o valor explicitamente para o recém-nascido.
 */
export type DoseLivro = {
  id: string
  nome: string
  unidade: Unidade
  porKgDia?: Faixa
  porKgDose?: Faixa
  fixo?: Faixa
  /** número de doses por dia (igual nas duas pontas quando é fixo) */
  doses?: Faixa
  maxDose?: number
  maxDia?: number
  /** de onde vem o máximo, quando não é do próprio capítulo */
  fonteMaximo?: string
  via: string
  pagina: string
  neonatal?: boolean
  nota?: string
  errata?: string
}

export type DoseLivroCalculada = {
  /** dose por tomada */
  porDose: Faixa | null
  /** total do dia */
  dia: Faixa | null
  /** alguma ponta foi limitada a um máximo */
  noMaximo: boolean
}

const ok = (x: number) => Number.isFinite(x) && x > 0
const teto = (f: Faixa, max?: number): Faixa => (max === undefined ? f : [Math.min(f[0], max), Math.min(f[1], max)])
const passou = (f: Faixa, max?: number) => max !== undefined && f[1] > max + 1e-9

/**
 * Conta do livro para o peso. Por dia: total × peso (teto do dia) e por dose =
 * total ÷ nº de doses (a faixa mais larga: menor total ÷ mais doses, maior
 * total ÷ menos doses), com teto por dose. Por dose: × peso (teto por dose) e
 * total = dose × nº de doses (teto do dia). Peso inválido: null.
 */
export function calcularDoseLivro(d: DoseLivro, pesoKg: number): DoseLivroCalculada | null {
  if (!ok(pesoKg)) return null
  let noMaximo = false
  if (d.porKgDia) {
    const bruto: Faixa = [d.porKgDia[0] * pesoKg, d.porKgDia[1] * pesoKg]
    noMaximo ||= passou(bruto, d.maxDia)
    const dia = teto(bruto, d.maxDia)
    let porDose: Faixa | null = null
    if (d.doses) {
      const pd: Faixa = [dia[0] / d.doses[1], dia[1] / d.doses[0]]
      noMaximo ||= passou(pd, d.maxDose)
      porDose = teto(pd, d.maxDose)
    }
    return { porDose, dia, noMaximo }
  }
  if (d.porKgDose || d.fixo) {
    const bruto: Faixa = d.porKgDose ? [d.porKgDose[0] * pesoKg, d.porKgDose[1] * pesoKg] : [d.fixo![0], d.fixo![1]]
    noMaximo ||= passou(bruto, d.maxDose)
    const porDose = teto(bruto, d.maxDose)
    let dia: Faixa | null = null
    if (d.doses) {
      const t: Faixa = [porDose[0] * d.doses[0], porDose[1] * d.doses[1]]
      noMaximo ||= passou(t, d.maxDia)
      dia = teto(t, d.maxDia)
    }
    return { porDose, dia, noMaximo }
  }
  return null
}

/** Texto do que o livro escreve para a dose (para a tela). */
export function textoDoseLivro(d: DoseLivro): string {
  const f = (x: Faixa) => (x[0] === x[1] ? `${x[0]}` : `${x[0]} a ${x[1]}`).replace(/\./g, ',')
  const partes: string[] = []
  if (d.porKgDia) partes.push(`${f(d.porKgDia)} ${d.unidade}/kg/dia`)
  if (d.porKgDose) partes.push(`${f(d.porKgDose)} ${d.unidade}/kg/dose`)
  if (d.fixo) partes.push(`${f(d.fixo)} ${d.unidade}`)
  if (d.doses) partes.push(`em ${f(d.doses)} ${d.doses[1] === 1 ? 'dose' : 'doses'}/dia`)
  if (d.maxDose !== undefined) partes.push(`máx. ${d.maxDose.toLocaleString('pt-BR')} ${d.unidade}/dose`)
  if (d.maxDia !== undefined) partes.push(`máx. ${d.maxDia.toLocaleString('pt-BR')} ${d.unidade}/dia`)
  return partes.join(' · ')
}

/** Item de referência (critério, tabela, conduta do livro) sem cálculo. */
export type Referencia = { rotulo: string; texto: string; pagina: string }
