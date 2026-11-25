// Indicadores de regulação (Fase 4, tarefa 10): tipos, taxas e as linhas do
// CSV. Migration 20261118000001_indicadores_regulacao.sql.
import { formatarEspera } from './regulacao.ts'

export type Estat = { n: number; mediana: number | null; p90: number | null }
export type EstatGrupo = Estat & { grupo: string }
export type BlocoTempo = { geral: Estat | null; por_prioridade: EstatGrupo[]; por_tipo: EstatGrupo[] }
export type Cumprimento = { n: number; no_prazo: number }

export type Indicadores = {
  periodo: { de: string; ate: string }
  escopo: 'rede' | 'unidades'
  total: number
  tempos: { decisao: BlocoTempo; aceite: BlocoTempo; chegada: BlocoTempo }
  fila_atual: { por_tipo: Record<string, number>; por_prioridade: Record<string, number> }
  volume: { por_dia: { dia: string; n: number }[]; por_tipo: Record<string, number>; por_origem: { unidade: string; n: number }[]; por_destino: { unidade: string; n: number }[] }
  desfechos: {
    autorizadas: number; negadas: number; devolvidas: number; canceladas: number; realizadas: number; faltas: number
    negacao_por_motivo: Record<string, number>; respostas_destino: number; recusas_destino: number; recusa_por_motivo: Record<string, number>
  }
  prazos: { fila: Cumprimento; pendencia: Cumprimento; evolucao: Cumprimento; destino: Cumprimento }
  gargalos: {
    por_origem: { unidade: string; n: number; decisao_mediana: number | null; devolvidas: number; negadas: number }[]
    por_destino: { unidade: string; respostas: number; recusas: number; aceite_mediana: number | null }[]
    por_tipo_leito: { tipo_leito: string; n: number; decisao_mediana: number | null; recusas: number }[]
  }
}

export type FiltrosIndicadores = { de: string; ate: string; tipo?: string; prioridade?: string; origem_id?: string; destino_id?: string }

/** Porcentagem inteira, ou "—" sem base. */
export function taxa(parte: number, total: number): string {
  if (!total) return '—'
  return `${Math.round((parte / total) * 100)}%`
}

/**
 * Tempo em segundos para leitura ("—" sem dado). Indicador é duração, não
 * relógio: menos de um minuto é "0 min", nunca "agora" (RC5 da revisão unslop).
 */
export function tempo(seg: number | null | undefined): string {
  if (seg == null) return '—'
  return seg < 60 ? '0 min' : formatarEspera(seg)
}

/** "1 pedido", "3 pedidos" (em vez de "pedido(s)"). */
export function plural(n: number, um: string, varios = `${um}s`): string {
  return `${n} ${n === 1 ? um : varios}`
}

const PESO_PRIORIDADE: Record<string, number> = { nao_classificada: 0, emergencia: 1, urgencia: 2, prioritaria: 3, eletiva: 4 }
const pesoGrupo = (g: string) => PESO_PRIORIDADE[g] ?? 10

/** Contagens por grupo na ordem da prioridade (1 → 4); o que não é prioridade, depois, como veio. */
export function emOrdem(m: Record<string, number>): [string, number][] {
  return Object.entries(m).sort((a, b) => pesoGrupo(a[0]) - pesoGrupo(b[0]))
}

export type LinhaDesdobramento = { grupo: string; tipo: 'prioridade' | 'tipo'; decisao: Estat | null; aceite: Estat | null; chegada: Estat | null }

/**
 * RC5: uma tabela com os três tempos por grupo (prioridade 1 → 4, depois o
 * tipo do pedido), em vez de três cartões com listas. Grupo sem caso num
 * tempo fica null nesse tempo.
 */
export function desdobramento(t: Indicadores['tempos']): LinhaDesdobramento[] {
  const linhas = new Map<string, LinhaDesdobramento>()
  for (const chave of ['decisao', 'aceite', 'chegada'] as const) {
    for (const [tipo, lista] of [['prioridade', t[chave].por_prioridade], ['tipo', t[chave].por_tipo]] as const) {
      for (const g of lista) {
        const k = `${tipo}:${g.grupo}`
        if (!linhas.has(k)) linhas.set(k, { grupo: g.grupo, tipo, decisao: null, aceite: null, chegada: null })
        linhas.get(k)![chave] = { n: g.n, mediana: g.mediana, p90: g.p90 }
      }
    }
  }
  return [...linhas.values()].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'prioridade' ? -1 : 1)
    || (a.tipo === 'prioridade' ? pesoGrupo(a.grupo) - pesoGrupo(b.grupo) : 0))
}

/** Filtros sem os campos vazios. */
export function filtrosIndicadoresParaEnvio(f: FiltrosIndicadores): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'string' && v.trim() !== '')) as Record<string, string>
}

/** Linhas do CSV: seção, indicador, grupo, valor (tempos em minutos). */
export function linhasCsvIndicadores(ind: Indicadores, rotulos: { tempo: Record<string, string>; grupo: (g: string) => string }): (string | number)[][] {
  const min = (s: number | null) => (s == null ? '' : Math.round(s / 60))
  const linhas: (string | number)[][] = [['Volume', 'Pedidos no período', '', ind.total]]
  for (const chave of ['decisao', 'aceite', 'chegada'] as const) {
    const b = ind.tempos[chave]
    const nome = rotulos.tempo[chave] ?? chave
    if (b.geral) linhas.push([nome, 'Mediana (min)', 'geral', min(b.geral.mediana)], [nome, 'Percentil 90 (min)', 'geral', min(b.geral.p90)], [nome, 'Pedidos', 'geral', b.geral.n])
    for (const g of [...b.por_prioridade, ...b.por_tipo]) {
      linhas.push([nome, 'Mediana (min)', rotulos.grupo(g.grupo), min(g.mediana)], [nome, 'Percentil 90 (min)', rotulos.grupo(g.grupo), min(g.p90)])
    }
  }
  const d = ind.desfechos
  linhas.push(
    ['Desfechos', 'Autorizadas', '', d.autorizadas], ['Desfechos', 'Negadas', '', d.negadas], ['Desfechos', 'Devolvidas', '', d.devolvidas],
    ['Desfechos', 'Canceladas', '', d.canceladas], ['Desfechos', 'Realizadas', '', d.realizadas], ['Desfechos', 'Faltas', '', d.faltas],
    ['Desfechos', 'Respostas do destino', '', d.respostas_destino], ['Desfechos', 'Recusas do destino', '', d.recusas_destino],
  )
  for (const [k, n] of Object.entries(d.negacao_por_motivo)) linhas.push(['Desfechos', 'Negação por motivo', k, n])
  for (const [k, n] of Object.entries(d.recusa_por_motivo)) linhas.push(['Desfechos', 'Recusa por motivo', k, n])
  for (const [k, c] of Object.entries(ind.prazos)) linhas.push(['Prazos', 'No prazo', k, c.no_prazo], ['Prazos', 'Avaliados', k, c.n])
  for (const o of ind.gargalos.por_origem) linhas.push(['Gargalos', 'Mediana da decisão (min) por origem', o.unidade, min(o.decisao_mediana)])
  for (const o of ind.gargalos.por_destino) linhas.push(['Gargalos', 'Recusas por destino', o.unidade, o.recusas])
  return linhas
}

// ── período sem pedido (revisão do perfil Médico regulador, RD3 = A, RT 24/11/2026) ──

/** Quais seções têm o que mostrar: as vazias somem da tela. */
export function secoesComDados(d: Indicadores) {
  const comTempo = (['decisao', 'aceite', 'chegada'] as const).some((k) => (d.tempos[k].geral?.n ?? 0) > 0)
  return {
    tempos: comTempo,
    fila: Object.keys(d.fila_atual.por_tipo).length > 0,
    desfechos: d.total > 0,
    prazos: Object.values(d.prazos).some((c) => c.n > 0),
    gargalos: d.gargalos.por_origem.length + d.gargalos.por_destino.length + d.gargalos.por_tipo_leito.length > 0,
    volume: d.volume.por_dia.length > 0,
  }
}

/** Data AAAA-MM-DD em DD/MM, com o ano quando é outro que o de referência. */
export function dataCurta(iso: string, anoRef?: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return anoRef && a !== anoRef ? `${d}/${m}/${a}` : `${d}/${m}`
}

/** "Nenhum pedido entre 26/10 e 24/11; o último foi em 11/10." Com filtro, sem o último (ele não sabe dos filtros). */
export function avisoPeriodoVazio(de: string, ate: string, ultimo: string | null, comFiltro = false): string {
  const ano = ate.slice(0, 4)
  const base = `Nenhum pedido${comFiltro ? ' com esses filtros' : ''} entre ${dataCurta(de, ano)} e ${dataCurta(ate, ano)}`
  return ultimo && !comFiltro ? `${base}; o último foi em ${dataCurta(ultimo, ano)}.` : `${base}.`
}

/** Dias do período, contando o primeiro e o último. */
export function diasDoPeriodo(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1
}
