// Gêmeos e homônimos na fila (correções do portão, tarefa 8): duas fichas do
// mesmo nome civil e da mesma data de nascimento ficam idênticas na linha. A
// tela marca essas linhas e mostra o que as separa (prontuário, mãe ou
// responsável). Sem data de nascimento não há como afirmar: não marca.

export type PacienteDaFila = {
  nome: string
  data_nascimento: string | null
  prontuario?: string | null
  nome_mae?: string | null
  responsavel_nome?: string | null
} | null

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function chaveHomonimo(p: PacienteDaFila): string | null {
  if (!p?.data_nascimento || !p.nome?.trim()) return null
  return `${normalizar(p.nome)}|${p.data_nascimento}`
}

/** Ids das linhas que têm outra linha com o mesmo nome e nascimento. */
export function homonimos<T extends { id: string; paciente: PacienteDaFila }>(lista: readonly T[]): Set<string> {
  const porChave = new Map<string, string[]>()
  for (const x of lista) {
    const k = chaveHomonimo(x.paciente)
    if (k) porChave.set(k, [...(porChave.get(k) ?? []), x.id])
  }
  return new Set([...porChave.values()].filter((ids) => ids.length > 1).flat())
}

/** O que separa a linha das outras: prontuário e, se houver, mãe ou responsável. */
export function diferenciador(p: PacienteDaFila): string {
  if (!p) return ''
  return [
    p.prontuario ? `Prontuário ${p.prontuario}` : '',
    p.nome_mae?.trim() ? `Mãe: ${p.nome_mae.trim()}` : p.responsavel_nome?.trim() ? `Responsável: ${p.responsavel_nome.trim()}` : '',
  ].filter(Boolean).join(' · ')
}
