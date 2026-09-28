import type { Faixa } from './fonteP2.ts'

// Lote P5 — base comum das ferramentas pediátricas do livro Pronto-Socorro
// ICr-HCFMUSP (4ª ed., 2023). As fichas usam `fichaP4` (mesma fonte e mesmo
// padrão de dose do lote P4). Aqui ficam só os auxiliares novos: conta por
// superfície corpórea (m²) e por peso com faixa. O livro NÃO traz fórmula de
// superfície corpórea; quando a dose é por m², o valor é informado pelo médico.

export const SC_INFORMADA =
  'A superfície corpórea (m²) é informada pelo médico: o livro não traz fórmula para calculá-la, e a ferramenta não a estima.'

export const positivoP5 = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x > 0)

/** Faixa do livro multiplicada pela superfície corpórea informada. */
export function porSC(f: Faixa, scM2: number): Faixa | null {
  return positivoP5(scM2) ? [f[0] * scM2, f[1] * scM2] : null
}

/** Faixa do livro multiplicada pelo peso. */
export function porPeso(f: Faixa, pesoKg: number): Faixa | null {
  return positivoP5(pesoKg) ? [f[0] * pesoKg, f[1] * pesoKg] : null
}

/** Faixa com teto (as duas pontas limitadas). */
export const comTeto = (f: Faixa, max: number): Faixa => [Math.min(f[0], max), Math.min(f[1], max)]

/** Referência do livro (texto + página). */
export type ItemLivro = { texto: string; pagina: string }
