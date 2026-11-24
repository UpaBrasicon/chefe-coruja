// IA1 e IA2 da busca com IA (RT, 24/11/2026): conversa de seguimento e
// perguntas sugeridas. A conversa fica só na memória da página (some ao sair
// ou ao fechar a resposta; nada vai para localStorage). Cada pergunta passa
// pela máscara de dados pessoais no servidor, e a conversa anterior também.

/** No máximo as 2 últimas trocas vão junto da pergunta nova. */
export const MAX_TROCAS = 2
export const MAX_SUGESTOES = 3
/** Limite da pergunta, o mesmo da Edge. */
export const MAX_PERGUNTA = 800

export type Troca = { pergunta: string; resposta: string }

/** A troca que acabou de terminar entra no fim; ficam só as últimas. */
export function proximoHistorico(historico: Troca[], troca: Troca): Troca[] {
  return [...historico, troca].slice(-MAX_TROCAS)
}

/** Troca a guardar depois da resposta pronta: "não encontrei" guarda a pergunta sem resposta. */
export function trocaDaResposta(pergunta: string, texto: string, naoEncontrou: boolean): Troca {
  return { pergunta, resposta: naoEncontrou ? '' : texto.trim() }
}

/** Sugestões que a biblioteca mandou: só textos curtos, sem repetir, no máximo 3. */
export function lerSugestoes(itens: unknown): string[] {
  if (!Array.isArray(itens)) return []
  const vistos = new Set<string>()
  const lista: string[] = []
  for (const i of itens) {
    if (typeof i !== 'string') continue
    const s = i.trim()
    const chave = s.toLowerCase()
    if (s.length < 3 || s.length > 120 || vistos.has(chave)) continue
    vistos.add(chave)
    lista.push(s)
    if (lista.length === MAX_SUGESTOES) break
  }
  return lista
}

/** Texto do campo de seguimento pronto para enviar? */
export function seguimentoValido(texto: string): boolean {
  const t = texto.trim()
  return t.length >= 3 && t.length <= MAX_PERGUNTA
}
