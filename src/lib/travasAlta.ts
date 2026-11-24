// Travas de alta numa lista curta agrupada (AL3; e as pendências do
// encaminhamento, MA2 — revisão da Internação aprovada pelo RT em 24/11/2026).
// O servidor devolve uma linha por item ("Exame sem resultado: Hemograma");
// aqui elas viram um grupo por tipo ("9 exames sem resultado"), com os itens
// e os ids para agir em lote. A regra de o que trava continua no servidor.

export type Trava = { tipo?: string; id?: string; descricao: string }
export type GrupoTravas = { chave: string; tipo: string; titulo: string; itens: string[]; ids: string[] }

/** "Exame sem resultado: Hemograma" → ["Exame sem resultado", "Hemograma"]; sem dois-pontos, o texto inteiro é o título. */
function partes(descricao: string): [string, string] {
  const i = descricao.indexOf(': ')
  return i > 0 ? [descricao.slice(0, i).trim(), descricao.slice(i + 2).trim()] : [descricao.trim(), '']
}

export function agruparTravas(lista: readonly (Trava | string)[]): GrupoTravas[] {
  const grupos = new Map<string, GrupoTravas>()
  for (const x of lista) {
    const t = typeof x === 'string' ? { descricao: x } : x
    const [titulo, item] = partes(t.descricao)
    const chave = `${t.tipo ?? ''}|${titulo}`
    const g = grupos.get(chave) ?? { chave, tipo: t.tipo ?? '', titulo, itens: [], ids: [] }
    if (item) g.itens.push(item)
    if (t.id) g.ids.push(t.id)
    grupos.set(chave, g)
  }
  return [...grupos.values()]
}

/** Título com a contagem: "9 exames sem resultado", "1 agravo suspeito sem notificação registrada". */
export function tituloGrupo(g: GrupoTravas): string {
  const n = Math.max(g.itens.length, 1)
  if (g.tipo === 'exame') return `${n} ${n === 1 ? 'exame sem resultado' : 'exames sem resultado'}`
  if (g.tipo === 'agravo') return `${n} ${n === 1 ? 'agravo suspeito' : 'agravos suspeitos'} sem notificação`
  return g.itens.length > 1 ? `${g.titulo} (${g.itens.length})` : g.titulo
}

/** "Dar alta (2 pendências)": a contagem é de grupos, como a lista mostra. */
export function rotuloDarAlta(grupos: readonly GrupoTravas[]): string {
  return grupos.length ? `Dar alta (${grupos.length} ${grupos.length === 1 ? 'pendência' : 'pendências'})` : 'Dar alta'
}
