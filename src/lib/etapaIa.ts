// "Perguntar à IA": qual etapa a tela mostra enquanto espera (pedido do RT de
// 17/11/2026, "tipo o Claude, com as bolinhas mexendo"). A biblioteca manda
// {"type":"etapa"} ao ler a pergunta e ao procurar nas fontes; depois da meta,
// até chegar o primeiro pedaço do texto, a etapa é "escrevendo".

export type EtapaIa = 'lendo' | 'procurando' | 'escrevendo'

export const ROTULO_ETAPA: Record<EtapaIa, string> = {
  lendo: 'Lendo a pergunta',
  procurando: 'Procurando nas fontes',
  escrevendo: 'Escrevendo a resposta',
}

/** Etapa a mostrar com as bolinhas, ou null quando já há texto ou a consulta terminou. */
export function etapaVisivel(status: string, texto: string, etapa: EtapaIa | null): EtapaIa | null {
  if (status === 'loading') return etapa === 'escrevendo' ? 'escrevendo' : etapa ?? 'lendo'
  if (status === 'streaming' && !texto) return 'escrevendo'
  return null
}

/** Lê a etapa de um evento do stream; ignora valor desconhecido. */
export function etapaDoEvento(valor: unknown): EtapaIa | null {
  return valor === 'lendo' || valor === 'procurando' || valor === 'escrevendo' ? valor : null
}
