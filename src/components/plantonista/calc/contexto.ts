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

/**
 * Seção da Central quando a ferramenta abre fora da rota dela: na janela por
 * cima do atendimento (F3 das ferramentas pelo CID). Sem isso a tela lê a
 * seção do endereço; trocar o endereço dentro do /atendimento quebra o roteador.
 */
export const SecaoDaFerramentaContexto = createContext<string | null>(null)

export function useSecaoDaFerramenta() {
  return useContext(SecaoDaFerramentaContexto)
}

/**
 * Lugar do resumo do cálculo (F5, RT em 24/11/2026). O ToolLayout fornece: na
 * tela larga (1280 px ou mais) o resumo vai para a coluna fixa da direita
 * (`lado`); no celular a barra fica presa ao pé e o ToolLayout reserva no fim
 * da página o espaço dela (`reservar`), para não cobrir o último conteúdo.
 */
export type LugarDoResumo = {
  lado: HTMLElement | null
  avisar: (presente: boolean) => void
  reservar: (altura: number) => void
}

export const LugarDoResumoContexto = createContext<LugarDoResumo | null>(null)

export function useLugarDoResumo() {
  return useContext(LugarDoResumoContexto)
}
