// Avisos no topo da Internação do NIR (NI1 = A, RT 24/11/2026). Os avisos da
// regulação viram uma linha por pedido: "Regulação nº 1 · 72 h sem evolução ·
// 30 avisos desde 14/11", com a ação do que o aviso pede. Os outros avisos
// repetidos viram uma linha pelo mesmo texto (src/lib/avisos.ts).
// node --experimental-strip-types --test src/lib/avisosNir.test.ts
import { agruparAvisos, type Aviso } from './avisos.ts'

export type AcaoAviso = 'evolucao' | 'responder' | 'abrir'
export type LinhaAviso = {
  chave: string
  /** Número do pedido de regulação (null nos avisos que não são de um pedido). */
  numero: number | null
  /** O que o aviso diz, curto ("72 h sem evolução"). */
  motivo: string
  vezes: number
  desde: string
  ultimo: string
  naoLidos: string[]
  acao: AcaoAviso | null
}

/** O número do pedido no tipo do aviso da regulação ("reg_prazo_72h_12" → 12). */
export function numeroDoPedido(tipo: string): number | null {
  const m = /^reg_.*_(\d+)$/.exec(tipo)
  return m ? Number(m[1]) : null
}

/** "Regulação nº 1: 72 h sem evolução; a central pode…" → "72 h sem evolução". */
export function motivoDoAviso(mensagem: string): string {
  const sem = mensagem.trim().replace(/^Regulação nº \d+:\s*/, '')
  const corte = sem.search(/[;.](\s|$)/)
  return (corte >= 0 ? sem.slice(0, corte) : sem).trim()
}

export function acaoDoAviso(tipo: string): AcaoAviso | null {
  if (/^reg_prazo_(72h|evolucao)_/.test(tipo)) return 'evolucao'
  if (/^reg_(prazo_pendencia|pendencia)/.test(tipo)) return 'responder'
  return tipo.startsWith('reg_') ? 'abrir' : null
}

/** Uma linha por pedido (os da regulação) ou pelo mesmo texto (os outros); mais novo primeiro. Só os não lidos. */
export function linhasDeAvisos(lista: readonly Aviso[]): LinhaAviso[] {
  const naoLidos = lista.filter((n) => !n.lida)
  const porPedido = new Map<number, Aviso[]>()
  const outros: Aviso[] = []
  for (const n of naoLidos) {
    const numero = numeroDoPedido(n.tipo)
    if (numero == null) outros.push(n)
    else porPedido.set(numero, [...(porPedido.get(numero) ?? []), n])
  }
  const linhas: LinhaAviso[] = [...porPedido.entries()].map(([numero, avs]) => {
    const ordem = [...avs].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const ultimo = ordem[0]
    return {
      chave: `pedido-${numero}`, numero, motivo: motivoDoAviso(ultimo.mensagem), vezes: avs.length,
      desde: ordem[ordem.length - 1].created_at, ultimo: ultimo.created_at, naoLidos: avs.map((a) => a.id), acao: acaoDoAviso(ultimo.tipo),
    }
  })
  for (const g of agruparAvisos(outros)) {
    linhas.push({ chave: g.chave, numero: null, motivo: g.mensagem.trim(), vezes: g.vezes, desde: g.primeiro, ultimo: g.ultimo, naoLidos: g.naoLidos, acao: null })
  }
  return linhas.sort((a, b) => b.ultimo.localeCompare(a.ultimo))
}

export const ROTULO_ACAO: Record<AcaoAviso, string> = { evolucao: 'Atualizar evolução', responder: 'Responder', abrir: 'Abrir' }
