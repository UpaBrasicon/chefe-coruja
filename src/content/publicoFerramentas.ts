// Para quem vale cada ferramenta da Central (P/index.html: PEDI, SO_PEDI,
// "MODO DE IDADE"). A regra do projeto: ferramenta de adulto não calcula para
// criança, e nada é convertido do adulto por peso (src/clinico/ficha.ts).
//
//  * 'pediatrico': só vale em criança (seção Pediatria, do livro do ICr).
//  * 'ambos': a ferramenta tem fonte PEDIÁTRICA declarada na ficha e trata os
//    dois públicos por dentro.
//  * 'sem_idade': não calcula nada de paciente (jogos).
//  * 'adulto': todo o resto. É o padrão: marcar outra coisa aqui é ato clínico
//    e exige a fonte pediátrica na ficha da ferramenta.
//
// Uma ferramenta nova pode declarar o público no próprio registro
// (`publico` no ToolDef); o que não declara cai nestas regras.

export type PublicoFerramenta = 'adulto' | 'pediatrico' | 'ambos' | 'sem_idade'

const POR_SECAO: Record<string, PublicoFerramenta> = {
  pediatria: 'pediatrico',
  'infusoes-pediatria': 'pediatrico',
  games: 'sem_idade',
}

const POR_CHAVE: Record<string, PublicoFerramenta> = {
  // Dengue — criança: o mesmo componente da seção Pediatria (DenguePed).
  'dengue/manual-dengue': 'pediatrico',
  // Hiperpotassemia: ficha 'ambos' com fonte pediátrica (src/clinico/hiperpotassemia.ts).
  'protocolos/hiperpotassemia': 'ambos',
}

export function publicoDaFerramenta(secao: string, slug: string, declarado?: PublicoFerramenta): PublicoFerramenta {
  return declarado ?? POR_CHAVE[`${secao}/${slug}`] ?? POR_SECAO[secao] ?? 'adulto'
}

/** Tem referência pediátrica (calcula em criança). */
export const valeEmCrianca = (p: PublicoFerramenta) => p === 'pediatrico' || p === 'ambos' || p === 'sem_idade'

/** Vale em adulto. */
export const valeEmAdulto = (p: PublicoFerramenta) => p !== 'pediatrico'

/** Leva o selo "Sem referência pediátrica". */
export const semReferenciaPediatrica = (p: PublicoFerramenta) => p === 'adulto'
