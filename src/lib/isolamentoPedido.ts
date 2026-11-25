// Isolamentos do pedido de regulação, quando são mais de um (decisão do RT de
// 25/11/2026, achado B-04 do teste de fluxo B: os isolamentos se somam).
//
// O servidor manda o tipo principal em `isolamento_tipo` e todos os tipos em
// `isolamento_tipos` (aerossol, gotícula, contato, reverso; nos pedidos antigos
// vem só o tipo do pedido e pode vir vazio). A tela mostra todos; sem a lista,
// vale o tipo principal. Só rótulo: nenhuma regra de vaga muda aqui.
import { ISOLAMENTOS } from './regulacao.ts'

export type IsolamentoDoPedido = { isolamento_tipo?: string | null; isolamento_tipos?: readonly string[] | null }

/**
 * Os tipos a mostrar, na ordem do servidor. "Contato + aerossol" pedido como
 * tipo principal continua sendo um tipo só (tem rótulo e precaução próprios),
 * em vez de aparecer desmembrado em contato e aerossol.
 */
export function tiposDoIsolamento(p: IsolamentoDoPedido): string[] {
  const principal = p.isolamento_tipo || null
  const tipos = [...new Set((p.isolamento_tipos ?? []).filter((t) => typeof t === 'string' && t !== ''))]
  if (tipos.length === 0) return principal ? [principal] : []
  if (principal === 'contato_aerossol' && tipos.includes('contato') && tipos.includes('aerossol')) {
    const resto = tipos.filter((t) => t !== 'contato' && t !== 'aerossol' && t !== 'contato_aerossol')
    return ['contato_aerossol', ...resto]
  }
  return tipos
}

/** Um rótulo por tipo (tipo desconhecido sai como veio). */
export function rotulosIsolamento(p: IsolamentoDoPedido): string[] {
  return tiposDoIsolamento(p).map((t) => ISOLAMENTOS[t] ?? t)
}

const minuscula = (s: string) => s.charAt(0).toLocaleLowerCase('pt-BR') + s.slice(1)

/** Todos numa frase: "Gotícula e reverso (protetor)", "Aerossol, gotícula e contato". Sem tipo → null. */
export function textoIsolamento(p: IsolamentoDoPedido): string | null {
  const r = rotulosIsolamento(p)
  if (r.length === 0) return null
  if (r.length === 1) return r[0]
  const resto = r.slice(1).map(minuscula)
  return `${r[0]}, ${resto.join(', ')}`.replace(/, ([^,]*)$/, ' e $1')
}
