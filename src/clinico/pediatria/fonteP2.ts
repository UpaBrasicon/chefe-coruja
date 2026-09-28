import type { Ficha } from '../ficha.ts'
import { LIVRO_PS_PED } from './fonte.ts'

// Fonte das ferramentas pediátricas do lote P2: o livro de pronto-socorro do
// Instituto da Criança (ICr-HCFMUSP, 4ª ed., 2023). Só entra o que o livro traz
// para a criança, com página (paginação do PDF da edição digital); o que falta
// no livro fica de fora (casco). Erros de impressão conferidos no PDF ficam
// anotados como errata junto da regra. Nada é convertido do adulto.

/** Mesma citação do livro que as demais fichas pediátricas usam (fonte.ts). */
export const CITACAO_PS_PED = LIVRO_PS_PED.citacao

export function fichaP2(id: string, titulo: string, paginas: string): Ficha {
  return {
    id,
    titulo,
    versao: '2026-09-27.3',
    publico: 'pediatrico',
    fontes: [{ citacao: `${CITACAO_PS_PED} ${paginas}.`, pediatrica: true }],
    revisadoEm: '27/09/2026 (conferido no livro, com errata anotada)',
  }
}

/** Recém-nascido: só calcula onde o livro dá valor neonatal explícito (CLAUDE.md). */
export const SEM_VALOR_NEONATAL_P2 =
  'O capítulo não traz valor explícito para o recém-nascido neste cálculo. Para o período neonatal a ferramenta não calcula dose nem volume.'

export type Faixa = [number, number]

export type DosePeso = {
  id: string
  nome: string
  /** unidade da dose; nas infusões, por minuto ou por hora conforme o livro */
  unidade: 'mg' | 'µg' | 'mEq' | 'g' | 'mL' | 'mL/h' | 'J' | 'mg/h' | 'µg/min'
  /** faixa por kg na unidade acima (igual nas duas pontas quando é dose única) */
  porKg: Faixa
  /** máximo por dose, na mesma unidade */
  maximo?: number
  /** concentração da solução do livro (unidade da dose por mL) → volume */
  porMl?: number
  /** volume por kg quando o livro dá o volume direto (sem concentração limpa) */
  mlPorKg?: Faixa
  solucao?: string
  via: string
  pagina: string
  nota?: string
  errata?: string
}

export type DoseCalculadaP2 = {
  dose: Faixa
  /** a ponta de cima (ou as duas) foi limitada ao máximo do livro */
  noMaximo: boolean
  volumeMl: Faixa | null
}

const lim = (x: number, max?: number) => (max !== undefined ? Math.min(x, max) : x)

/** Dose para o peso; peso inválido não calcula. Volume pela concentração ou pelo mL/kg do livro. */
export function calcularDose(d: DosePeso, pesoKg: number): DoseCalculadaP2 | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const bruto: Faixa = [d.porKg[0] * pesoKg, d.porKg[1] * pesoKg]
  const dose: Faixa = [lim(bruto[0], d.maximo), lim(bruto[1], d.maximo)]
  const noMaximo = d.maximo !== undefined && bruto[1] > d.maximo
  let volumeMl: Faixa | null = null
  if (d.porMl) volumeMl = [dose[0] / d.porMl, dose[1] / d.porMl]
  else if (d.mlPorKg && d.maximo === undefined) volumeMl = [d.mlPorKg[0] * pesoKg, d.mlPorKg[1] * pesoKg]
  return { dose, noMaximo, volumeMl }
}

/** Idade exata em dias a partir de anos, meses e dias completos (ano = 365,25 d; mês = 30,4375 d). */
export function idadeEmDias(anos: number, meses = 0, dias = 0): number | null {
  if (![anos, meses, dias].every((x) => Number.isFinite(x) && x >= 0)) return null
  return anos * 365.25 + meses * 30.4375 + dias
}

export const DIAS_ANO = 365.25
export const DIAS_MES = 30.4375
