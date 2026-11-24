// Textos fixos da biblioteca quando não há resposta (R2-11 e R2-13, 13/10/2026).
// A tela mostra só a frase: sem a lista de assuntos que o modelo às vezes
// acrescenta e sem fontes ou ferramentas que não têm relação com a pergunta.

export const NAO_ENCONTREI = 'Não encontrei isso no material de referência.'
export const SEM_PEDIATRIA = 'Não há referência pediátrica no material para esta pergunta.'

const INICIOS = [NAO_ENCONTREI, SEM_PEDIATRIA].map((s) => s.slice(0, -1))

/** A frase de "sem resposta", quando o texto começa por ela; senão, null. */
export function semResposta(texto: string): string | null {
  const t = texto.trim()
  const inicio = INICIOS.find((s) => t.startsWith(s))
  if (!inicio) return null
  const fim = t.indexOf('.', inicio.length)
  return fim === -1 ? t : t.slice(0, fim + 1)
}

/** Números [n] citados no texto da resposta ("[1]", "[2, 3]"). */
export function citacoes(texto: string): Set<number> {
  const s = new Set<number>()
  for (const m of texto.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)) for (const n of m[1].split(/,\s*/)) s.add(Number(n))
  return s
}

/** Resposta pronta: só as fontes que o texto cita (as outras não sustentam nada do que foi dito). */
export function fontesCitadas<T extends { n: number }>(texto: string, fontes: T[]): T[] {
  const c = citacoes(texto)
  return c.size ? fontes.filter((f) => c.has(f.n)) : fontes
}

/** E4: confiança pelas fontes que a resposta de fato cita. Alta com duas ou mais
 *  fontes diferentes acima do corte; moderada com uma; sem os campos (resposta
 *  antiga em cache), fica o nível que a biblioteca mandou. */
export function confiancaDasCitadas(
  citadas: { fonte_id?: string; acima_do_corte?: boolean }[],
  daBiblioteca: string | null | undefined,
): string | null {
  if (!citadas.length || citadas.some((f) => f.acima_do_corte === undefined)) return daBiblioteca ?? null
  const fontes = new Set(citadas.filter((f) => f.acima_do_corte).map((f) => f.fonte_id))
  return fontes.size >= 2 ? 'alta' : fontes.size === 1 ? 'moderada' : null
}

/** E5: a lista do PubMed ao vivo só aparece quando o material não respondeu
 *  (sem resposta pelo corte, ou a resposta é "não encontrei"). */
export function mostrarPubmed(status: string, curto: string | null, artigos: unknown[]): boolean {
  if (!artigos.length) return false
  return status === 'blocked' || (status === 'done' && curto !== null)
}

/** E4 (decisão do RT de 12/11/2026): texto do nível de confiança da resposta.
 *  Baixa e ausente não aparecem: com baixa, a IA não responde. */
export function textoConfianca(confianca: string | null | undefined): string | null {
  if (confianca === 'alta') return 'Confiança alta: mais de uma fonte do material trata do assunto.'
  if (confianca === 'moderada') return 'Confiança moderada: só uma fonte do material trata do assunto. Confira na fonte antes de seguir.'
  return null
}

/** IA3 (RT, 24/11/2026): a numeração na tela segue a ordem em que o texto cita
 *  (1, 2, 3...), não o número do trecho na biblioteca. Chave: número da
 *  biblioteca; valor: número na tela. */
export function numeracaoNaTela(texto: string): Map<number, number> {
  const mapa = new Map<number, number>()
  for (const m of texto.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)) {
    for (const n of m[1].split(/,\s*/)) if (!mapa.has(Number(n))) mapa.set(Number(n), mapa.size + 1)
  }
  return mapa
}

/** As fontes na ordem da tela, cada uma com o número da tela (`na`). Sem
 *  citação no texto, ficam todas na ordem em que vieram. */
export function fontesNaTela<T extends { n: number }>(texto: string, fontes: T[]): (T & { na: number })[] {
  const mapa = numeracaoNaTela(texto)
  if (!mapa.size) return fontes.map((f, i) => ({ ...f, na: i + 1 }))
  return fontes
    .filter((f) => mapa.has(f.n))
    .map((f) => ({ ...f, na: mapa.get(f.n)! }))
    .sort((a, b) => a.na - b.na)
}

/** Caminho cru de ferramenta que o modelo às vezes escreve no texto. */
export const ROTA_NO_TEXTO = /\(?\/plantonista\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\)?/g

type FonteCopia = { n: number; titulo: string; editor: string; ano: number; secao: string; pagina: number | null }

/** IA6: resposta em texto simples para colar na evolução, com as fontes numeradas como na tela. */
export function textoParaCopiar(pergunta: string, texto: string, fontes: FonteCopia[]): string {
  const mapa = numeracaoNaTela(texto)
  const corpo = texto
    .replace(/\r/g, '')
    .replace(ROTA_NO_TEXTO, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*#{1,4}\s+/gm, '')
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_, ns: string) => `[${ns.split(/,\s*/).map((n) => mapa.get(Number(n)) ?? n).join(', ')}]`)
    .replace(/[ \t]+([.,;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const lista = fontesNaTela(texto, fontes).map((f) =>
    `${f.na}. ${f.titulo} — ${f.editor}, ${f.ano}${f.secao ? `, ${f.secao}` : ''}${f.pagina ? `, p. ${f.pagina}` : ''}`)
  return [`Pergunta: ${pergunta}`, '', corpo, ...(lista.length ? ['', 'Fontes:', ...lista] : [])].join('\n')
}
