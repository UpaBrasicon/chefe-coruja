import { createContext, type ReactNode } from 'react'

/**
 * Faixa de parâmetros da página inicial do papel: a casca (AppShell) a põe no
 * contexto e o título da página (TituloPagina) a desenha logo abaixo de si, na
 * coluna do conteúdo (revisão visual 3.1, pedido do RT de 21/10/2026). Telas
 * montadas dentro de abas recebem o contexto vazio (TabsPagina) para não
 * repeti-la.
 */
export const FaixaDaPagina = createContext<ReactNode>(null)
