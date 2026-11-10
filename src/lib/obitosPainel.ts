// Óbitos em Indicadores do gestor (lacuna 10; decisão do RT em 10/11/2026, A
// em P1 a P8; migration 20270328000001). O formato de public.indicador_obitos,
// os rótulos da tela e as linhas do CSV (só números, sem nome: P8).
//
// Referência de nomenclatura: Portaria SAS/MS nº 312/2002 (censo hospitalar).
// A UPA não é hospital: o número é "óbitos sobre saídas", com numerador e
// denominador à vista (o nome da taxa da portaria não é usado).

import { ROTULO_TIPO_MORTE } from './obito.ts'

export const FONTE_OBITOS =
  'Referência de nomenclatura: Portaria SAS/MS nº 312/2002, do censo hospitalar. A UPA não é hospital, e estes números não são um censo hospitalar.'

export const ORIGENS = [
  { valor: 'porta', rotulo: 'Porta' },
  { valor: 'observacao', rotulo: 'Observação' },
  { valor: 'internacao', rotulo: 'Internação' },
] as const
export type OrigemObito = (typeof ORIGENS)[number]['valor']

export const TIPOS = [
  { valor: 'natural_assistida', rotulo: ROTULO_TIPO_MORTE.natural_assistida },
  { valor: 'natural_sem_assistencia_ou_a_esclarecer', rotulo: ROTULO_TIPO_MORTE.natural_sem_assistencia_ou_a_esclarecer },
  { valor: 'violenta_ou_suspeita', rotulo: ROTULO_TIPO_MORTE.violenta_ou_suspeita },
  { valor: 'registro_anterior', rotulo: 'Registro anterior' },
] as const
export type TipoObito = (typeof TIPOS)[number]['valor']

export const ENCAMINHAMENTOS = [
  { valor: 'unidade', rotulo: 'A unidade atesta' },
  { valor: 'causa_desconhecida', rotulo: 'Unidade, causa desconhecida' },
  { valor: 'svo', rotulo: 'SVO' },
  { valor: 'iml', rotulo: 'IML' },
  { valor: 'registro_anterior', rotulo: 'Registro anterior' },
] as const
export type EncaminhamentoObito = (typeof ENCAMINHAMENTOS)[number]['valor']

export const FAIXAS = [
  { valor: 'adulto', rotulo: 'Adulto' },
  { valor: 'pediatrico', rotulo: 'Pediátrico (até 13 anos)' },
  { valor: 'sem_data_nascimento', rotulo: 'Sem data de nascimento' },
] as const
export type FaixaObito = (typeof FAIXAS)[number]['valor']

export const TEMPOS = [
  { valor: 'menos_de_24h', rotulo: 'Menos de 24 h' },
  { valor: 'de_24h_ou_mais', rotulo: '24 h ou mais' },
  { valor: 'sem_chegada', rotulo: 'Sem hora de chegada' },
] as const
export type TempoObito = (typeof TEMPOS)[number]['valor']

export type CasoObito = {
  nome: string
  hora_obito: string
  chegada_em: string | null
  origem: OrigemObito
  setor: string | null
  tipo_morte: Exclude<TipoObito, 'registro_anterior'> | null
  encaminhamento: Exclude<EncaminhamentoObito, 'registro_anterior'> | null
  registro_anterior: boolean
  faixa: FaixaObito
  tempo: TempoObito
}

/** public.indicador_obitos */
export type IndicadorObitos = {
  de: string; ate: string; setor_id: string | null
  total: number
  registro_anterior: number
  por_origem: Record<OrigemObito, number>
  por_tipo: Record<TipoObito, number>
  por_encaminhamento: Record<EncaminhamentoObito, number>
  por_faixa: Record<FaixaObito, number>
  por_tempo: Record<TempoObito, number>
  por_setor: { setor_id: string | null; setor: string; obitos: number }[]
  por_dia: { dia: string; obitos: number }[]
  saidas: Record<OrigemObito | 'total', number>
  obitos_sobre_saidas: { numerador: number; denominador: number; percentual: number | null }
  setores: { id: string; nome: string }[]
  casos: CasoObito[]
}

const rotulo = (lista: readonly { valor: string; rotulo: string }[], v: string | null | undefined) =>
  lista.find((i) => i.valor === v)?.rotulo ?? (v || '—')

export const rotuloOrigem = (v: string) => rotulo(ORIGENS, v)
export const rotuloTipo = (v: string | null, anterior = false) => (anterior ? 'Registro anterior' : rotulo(TIPOS, v))
export const rotuloEncaminhamento = (v: string | null, anterior = false) => (anterior ? 'Registro anterior' : rotulo(ENCAMINHAMENTOS, v))
export const rotuloFaixa = (v: string) => rotulo(FAIXAS, v)
export const rotuloTempo = (v: string) => rotulo(TEMPOS, v)

/** "85,7%" com uma casa e vírgula; sem saída no período, "—". */
export function percentualObitos(numerador: number, denominador: number): string {
  if (!denominador) return '—'
  const v = Math.round((numerador / denominador) * 1000) / 10
  return `${String(v).replace('.', ',')}%`
}

/** Numerador e denominador escritos: "6 óbitos de 7 saídas". */
export function fracaoObitos(numerador: number, denominador: number): string {
  return `${numerador} ${numerador === 1 ? 'óbito' : 'óbitos'} de ${denominador} ${denominador === 1 ? 'saída' : 'saídas'}`
}

export const CABECALHO_CSV_OBITOS = ['Recorte', 'Categoria', 'Valor']

/** Linhas do CSV (P8): Recorte; Categoria; Valor. Só números, sem nome. */
export function linhasCsvObitos(r: IndicadorObitos): (string | number | null)[][] {
  const o = r.obitos_sobre_saidas
  const linhas: (string | number | null)[][] = [
    ['Total', 'Óbitos no período', r.total],
    ['Total', 'Registros anteriores (sem tipo de morte)', r.registro_anterior],
    ['Óbitos sobre saídas', 'Numerador (óbitos)', o.numerador],
    ['Óbitos sobre saídas', 'Denominador (saídas)', o.denominador],
    ['Óbitos sobre saídas', 'Percentual (%)', o.percentual],
  ]
  for (const i of ORIGENS) linhas.push(['Saídas', i.rotulo, r.saidas[i.valor] ?? 0])
  const grupo = <K extends string>(titulo: string, lista: readonly { valor: K; rotulo: string }[], valores: Record<K, number>) => {
    for (const i of lista) linhas.push([titulo, i.rotulo, valores[i.valor] ?? 0])
  }
  grupo('Origem', ORIGENS, r.por_origem)
  for (const s of r.por_setor) linhas.push(['Setor do óbito', s.setor, s.obitos])
  grupo('Tipo de morte', TIPOS, r.por_tipo)
  grupo('Encaminhamento', ENCAMINHAMENTOS, r.por_encaminhamento)
  grupo('Faixa etária', FAIXAS, r.por_faixa)
  grupo('Tempo desde a chegada', TEMPOS, r.por_tempo)
  for (const d of r.por_dia) linhas.push(['Dia do plantão', d.dia.split('-').reverse().join('/'), d.obitos])
  return linhas
}
