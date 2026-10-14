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
