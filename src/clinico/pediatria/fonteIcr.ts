import type { Ficha, Fonte } from '../ficha.ts'

// Fonte das ferramentas pediátricas do lote P3: o livro de pronto-socorro do
// Instituto da Criança (ICr-HCFMUSP, 4ª ed., 2023). Só entra o que o livro traz
// para a criança, com página; o que falta no livro fica de fora (casco).
// Erros de impressão conferidos no PDF ficam anotados como errata junto da regra.

export const LIVRO_ICR: Fonte = {
  citacao:
    'Schvartsman C, et al. (coords.). Pronto-Socorro. 4ª ed. Santana de Parnaíba: Manole; 2023. (Pediatria ICr-HCFMUSP). ISBN 978-65-5576-759-9.',
  pediatrica: true,
}

export function fichaIcr(id: string, titulo: string, paginas: string): Ficha {
  return {
    id,
    titulo,
    versao: '2026-09-27.3',
    publico: 'pediatrico',
    fontes: [{ citacao: `${LIVRO_ICR.citacao} ${paginas}.`, pediatrica: true }],
    revisadoEm: '27/09/2026 (conferido no livro, com errata anotada)',
  }
}

/**
 * Recém-nascido: o capítulo não traz valor neonatal explícito para o cálculo
 * de dose/volume — a ferramenta não calcula (regra do projeto). Fórmulas de
 * interpretação (ânion-gap, osmolalidade, compensação) continuam disponíveis.
 */
export const SEM_VALOR_NEONATAL =
  'O capítulo não traz valor neonatal explícito para este cálculo. Para recém-nascido a ferramenta não calcula dose nem volume.'

export const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x))
export const positivo = (...xs: number[]) => ok(...xs) && xs.every((x) => x > 0)

/** Faixa [a, b] multiplicada por um fator. */
export const faixaVezes = (f: [number, number], k: number): [number, number] => [f[0] * k, f[1] * k]

/** Limita cada ponta de uma faixa a um máximo. */
export const faixaTeto = (f: [number, number], max: number): [number, number] => [Math.min(f[0], max), Math.min(f[1], max)]
