// Painel "Uso do app" do administrador geral (Fase 1, item 14; PH1 a PH3 = A
// do RT em 23/11/2026). Funções puras sobre o que public.uso_app_painel devolve:
// contagens sem pessoa e sem paciente.

export type EventoUsoApp = 'central_aba' | 'ferramenta' | 'censo'

export type LinhaUso = {
  dia: string
  unidade_id: string
  unidade: string
  papel: string
  evento: EventoUsoApp
  detalhe: string
  total: number
}
export type EntradaDia = { dia: string; entradas: number; pessoas: number }
export type FerramentaTotal = { chave: string; usos: number }
export type PainelUsoApp = {
  desde: string
  eventos: LinhaUso[]
  entradas: EntradaDia[]
  ferramentas_desde_inicio: FerramentaTotal[]
}

export const ROTULO_EVENTO: Record<EventoUsoApp, string> = {
  central_aba: 'Abas da Central',
  ferramenta: 'Ferramentas abertas',
  censo: 'Censo aberto',
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

/** Lê o jsonb do banco sem confiar no formato. */
export function lerPainel(json: unknown): PainelUsoApp {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  return {
    desde: String(o.desde ?? ''),
    eventos: lista(o.eventos).map((e) => ({
      dia: String(e.dia ?? ''),
      unidade_id: String(e.unidade_id ?? ''),
      unidade: String(e.unidade ?? ''),
      papel: String(e.papel ?? ''),
      evento: String(e.evento ?? '') as EventoUsoApp,
      detalhe: String(e.detalhe ?? ''),
      total: num(e.total),
    })),
    entradas: lista(o.entradas).map((e) => ({ dia: String(e.dia ?? ''), entradas: num(e.entradas), pessoas: num(e.pessoas) })),
    ferramentas_desde_inicio: lista(o.ferramentas_desde_inicio).map((e) => ({ chave: String(e.chave ?? ''), usos: num(e.usos) })),
  }
}

export type LinhaUnidadePapel = {
  unidade_id: string
  unidade: string
  papel: string
  central_aba: number
  ferramenta: number
  censo: number
  total: number
}

/** Soma o período por unidade e papel, do mais usado ao menos usado. */
export function porUnidadePapel(eventos: LinhaUso[]): LinhaUnidadePapel[] {
  const m = new Map<string, LinhaUnidadePapel>()
  for (const e of eventos) {
    if (!(e.evento in ROTULO_EVENTO)) continue
    const k = `${e.unidade_id}|${e.papel}`
    const l = m.get(k) ?? { unidade_id: e.unidade_id, unidade: e.unidade, papel: e.papel, central_aba: 0, ferramenta: 0, censo: 0, total: 0 }
    l[e.evento] += e.total
    l.total += e.total
    m.set(k, l)
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.unidade.localeCompare(b.unidade) || a.papel.localeCompare(b.papel))
}

/** Total do período por detalhe de um evento (aba ou ferramenta), do maior ao menor. */
export function ranking(eventos: LinhaUso[], evento: EventoUsoApp, limite = 15): { detalhe: string; total: number }[] {
  const m = new Map<string, number>()
  for (const e of eventos) if (e.evento === evento && e.detalhe) m.set(e.detalhe, (m.get(e.detalhe) ?? 0) + e.total)
  return [...m.entries()]
    .map(([detalhe, total]) => ({ detalhe, total }))
    .sort((a, b) => b.total - a.total || a.detalhe.localeCompare(b.detalhe))
    .slice(0, limite)
}

/** Soma das entradas do período (sessões abertas). Pessoas não se somam entre dias. */
export function totalEntradas(entradas: EntradaDia[]): number {
  return entradas.reduce((n, e) => n + e.entradas, 0)
}

/** Total de um evento no período. */
export function totalEvento(eventos: LinhaUso[], evento: EventoUsoApp): number {
  return eventos.reduce((n, e) => (e.evento === evento ? n + e.total : n), 0)
}
