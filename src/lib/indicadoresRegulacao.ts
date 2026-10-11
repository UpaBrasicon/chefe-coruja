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

/** Tempo em segundos para leitura ("—" sem dado). */
export function tempo(seg: number | null | undefined): string {
  return seg == null ? '—' : formatarEspera(seg)
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
