import { createContext, useContext } from 'react'

// Ligações das peças do piloto das calculadoras que não são componentes.

export type IdAba = 'proximos' | 'armadilhas' | 'evidencias' | 'comentario'

/** id da seção das abas abaixo do resultado (o resumo flutuante rola até ela) */
export const ID_ABAS_RESULTADO = 'abas-resultado'

export type Relacionada = { to: string; rotulo: string; descricao: string }

/** O ToolRouter fornece; o ToolLayout desenha na coluna da direita (tela larga) ou no fim. */
export const RelacionadasContexto = createContext<Relacionada[]>([])

export function useRelacionadas() {
  return useContext(RelacionadasContexto)
}
