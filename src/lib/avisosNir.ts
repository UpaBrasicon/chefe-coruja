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

/**
 * Uma linha por pedido (os da regulação) ou pelo mesmo texto (os outros); mais
 * novo primeiro. Só os não lidos; com `lidos`, só os já lidos (aba "Lidos",
 * NI6 da revisão unslop, RT 25/11/2026).
 */
export function linhasDeAvisos(lista: readonly Aviso[], o: { lidos?: boolean } = {}): LinhaAviso[] {
  const escolhidos = lista.filter((n) => n.lida === !!o.lidos)
  const porPedido = new Map<number, Aviso[]>()
  const outros: Aviso[] = []
  for (const n of escolhidos) {
    const numero = numeroDoPedido(n.tipo)
    if (numero == null) outros.push(n)
    else porPedido.set(numero, [...(porPedido.get(numero) ?? []), n])
  }
  const linhas: LinhaAviso[] = [...porPedido.entries()].map(([numero, avs]) => {
    const ordem = [...avs].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const ultimo = ordem[0]
    return {
      chave: `pedido-${numero}`, numero, motivo: motivoDoAviso(ultimo.mensagem), vezes: avs.length,
      desde: ordem[ordem.length - 1].created_at, ultimo: ultimo.created_at, naoLidos: avs.filter((a) => !a.lida).map((a) => a.id), acao: acaoDoAviso(ultimo.tipo),
    }
  })
  for (const g of agruparAvisos(outros)) {
    linhas.push({ chave: g.chave, numero: null, motivo: g.mensagem.trim(), vezes: g.vezes, desde: g.primeiro, ultimo: g.ultimo, naoLidos: g.naoLidos, acao: null })
  }
  return linhas.sort((a, b) => b.ultimo.localeCompare(a.ultimo))
}

export const ROTULO_ACAO: Record<AcaoAviso, string> = { evolucao: 'Atualizar evolução', responder: 'Responder', abrir: 'Abrir' }

/**
 * NI6: o selo conta o que a pessoa precisa ler (avisos distintos não lidos,
 * uma linha por pedido ou texto), não as repetições: 24 avisos diários do
 * mesmo pedido + 1 outro = 2, não 25.
 */
export const contarNaoLidos = (linhas: readonly LinhaAviso[]) => linhas.filter((l) => l.naoLidos.length > 0).length

/**
 * NI6: o motivo da linha com o tempo real. O aviso diário guarda o texto do
 * dia em que nasceu ("72 h sem evolução"); se o pedido segue sem evolução, a
 * linha mostra quanto tempo é hoje (`atual`, ex.: "45 d 0 h sem evolução").
 */
export function motivoComTempoReal(l: Pick<LinhaAviso, 'motivo' | 'acao'>, atual: string | null | undefined): string {
  return l.acao === 'evolucao' && atual ? atual : l.motivo
}

/** NI6: a repetição em texto mudo: "repetido 24× desde 21/10". */
export function textoRepeticao(vezes: number, desde: string): string | null {
  return vezes > 1 ? `repetido ${vezes}× desde ${desde}` : null
}
