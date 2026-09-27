// Ficha de uma ferramenta clínica (Fase 5): toda regra do pacote declara de
// onde veio, para quem vale e em que versão está. A decisão continua sendo do
// profissional (ADR 0007): a ferramenta calcula e mostra a referência.

export type Publico = 'adulto' | 'pediatrico' | 'ambos'

export type Fonte = {
  citacao: string
  url?: string
  /** a fonte traz dado pediátrico próprio (não é adulto convertido) */
  pediatrica?: boolean
}

export type Ficha = {
  id: string
  titulo: string
  /** muda sempre que a regra muda; vai junto no que for registrado (ADR 0004) */
  versao: string
  publico: Publico
  fontes: Fonte[]
  revisadoEm: string
}

/** Pediatria: de 1 dia de vida até antes de completar 14 anos (CLAUDE.md). */
export const IDADE_ADULTO_ANOS = 14

/**
 * Casco: a ferramenta só calcula para criança quando a ficha é pediátrica ou
 * mista E declara fonte pediátrica. Nada é convertido de adulto para criança.
 */
export function temReferenciaPediatrica(ficha: Ficha): boolean {
  return ficha.publico !== 'adulto' && ficha.fontes.some((f) => f.pediatrica)
}

export function textoFontes(ficha: Ficha): string {
  return ficha.fontes.map((f) => f.citacao).join(' · ')
}

export const SEM_REFERENCIA_PEDIATRICA =
  'Sem referência pediátrica declarada para esta ferramenta. Nada aqui é convertido do adulto para a criança.'
