// Guia da ferramenta no modelo das calculadoras (pedido do RT de 16/11/2026,
// modelo do MDCalc). Cada frase tem fonte; o que a fonte não diz fica de fora
// e a aba não aparece. Próximos passos: decisão do RT de 16/11/2026 (opção A),
// o que a fonte citada recomenda para a faixa do resultado, com classe e
// página — substitui, só nas ferramentas com guia, a regra antiga de o escore
// não falar de conduta (ADR 0007). Comentário do RT: texto do responsável
// técnico, com nome e data (opção A da mesma data).

export type RefGuia = { fonte: string; pagina?: string; grau?: string }

export type ItemGuia = { texto: string; ref: RefGuia }

/** `faixas`: estados do resultado (0, 1, 2) em que o passo vale; sem `faixas`, vale para todos. */
export type PassoGuia = ItemGuia & { tema?: string; faixas?: (0 | 1 | 2)[] }

export type Guia = {
  resumo?: string
  instrucoes?: string
  quandoUsar?: ItemGuia[]
  armadilhas?: ItemGuia[]
  porQueUsar?: ItemGuia[]
  proximosPassos?: PassoGuia[]
  evidencias?: ItemGuia[]
  comentarioRT?: { texto: string; autor: string; data: string }
}

/** Passos que valem para a faixa do resultado (estado do escore). */
export function passosDaFaixa(guia: Guia | undefined, estado: 0 | 1 | 2 | undefined): PassoGuia[] {
  const todos = guia?.proximosPassos ?? []
  if (estado === undefined) return todos.filter((p) => !p.faixas)
  return todos.filter((p) => !p.faixas || p.faixas.includes(estado))
}

export function textoRef(r: RefGuia): string {
  return [r.fonte, r.grau, r.pagina].filter(Boolean).join('; ')
}
