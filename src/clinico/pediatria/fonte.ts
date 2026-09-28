import type { Ficha, Fonte } from '../ficha.ts'
import { MANUAL_HC } from '../adulto/fonte.ts'

// Fontes das ferramentas pediátricas com dose (Fase 5.4).
//
// Principal: o livro do Instituto da Criança do HCFMUSP (PS Pediatria, 4ª ed.,
// 2023), sobretudo o Apêndice "Medicamentos habitualmente usados no
// pronto-socorro pediátrico" (tabelas 1 e 2). As páginas citadas seguem a
// numeração do PDF do livro (o arquivo não traz fólio impresso). O próprio
// apêndice avisa que doses do período neonatal NÃO foram contempladas.
//
// Secundária: o manual de emergência do HCFMUSP (adulto, 3ª ed., 2022) — só o
// Anexo 2 dele (padrão de diluição em crianças), usado como nota de divergência
// ou nas ferramentas que já o citavam. Nada é convertido do adulto; o que os
// livros não trazem não entra (casco).

export const LIVRO_PS_PED: Fonte = {
  citacao:
    'Schvartsman C, et al. (coords.). Pronto-Socorro — Pediatria ICr-HCFMUSP. 4ª ed. Santana de Parnaíba: Manole; 2023. ISBN 978-65-5576-759-9.',
  pediatrica: true,
}

export const VERSAO_FICHAS_PEDIATRICAS = '2026-09-27.3'

/** Fonte com as páginas usadas; a pediátrica continua marcada como tal. */
const comPaginas = (fonte: Fonte, paginas: string): Fonte => ({
  citacao: `${fonte.citacao} ${paginas}.`,
  pediatrica: true,
})

/**
 * Ficha de uma ferramenta pediátrica. `fonte` é o livro de onde saem os
 * números (padrão: manual do HCFMUSP, para manter as fichas antigas); `outras`
 * lista fontes secundárias com as páginas usadas.
 */
export function fichaPediatrica(
  id: string,
  titulo: string,
  paginas: string,
  fonte: Fonte = MANUAL_HC,
  outras: { fonte: Fonte; paginas: string }[] = [],
): Ficha {
  return {
    id,
    titulo,
    versao: VERSAO_FICHAS_PEDIATRICAS,
    publico: 'pediatrico',
    fontes: [comPaginas(fonte, paginas), ...outras.map((o) => comPaginas(o.fonte, o.paginas))],
    revisadoEm: '27/09/2026 (conferido no livro, com errata anotada)',
  }
}
