import type { Ficha } from '../ficha.ts'

// Gestação na triagem (porte do protótipo, 24/09). Não entra no protocolo de
// classificação: vai junto do registro para o médico e para o resumo.
// Regra de Naegele: DPP = DUM + 280 dias; a idade gestacional conta os dias
// desde a DUM. O servidor refaz a mesma conta (private.normalizar_gestacao,
// migration 20261003000004) e guarda a dele.

export const fichaNaegele: Ficha = {
  id: 'triagem-gestacao-naegele',
  titulo: 'Idade gestacional e data provável do parto pela DUM (regra de Naegele)',
  versao: '2026-09-29.1',
  publico: 'ambos',
  fontes: [
    { citacao: 'American College of Obstetricians and Gynecologists. Committee Opinion No. 700: Methods for Estimating the Due Date. Obstet Gynecol. 2017;129(5):e150–e154.' },
  ],
  revisadoEm: '29/09/2026 (porte do protótipo)',
}

export type TipoGestacao = 'nao_gestante' | 'gestacao_unica' | 'gestacao_gemelar' | 'nao_informado'

export const TIPOS_GESTACAO: { id: TipoGestacao; rotulo: string }[] = [
  { id: 'nao_gestante', rotulo: 'Não gestante' },
  { id: 'gestacao_unica', rotulo: 'Gestação única' },
  { id: 'gestacao_gemelar', rotulo: 'Gestação gemelar' },
  { id: 'nao_informado', rotulo: 'Não informado' },
]

export const ehGestante = (t: TipoGestacao | null | undefined) => t === 'gestacao_unica' || t === 'gestacao_gemelar'

const DIA = 86_400_000

function utc(data: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(t)
  // recusa 2026-02-31 e afins
  return d.getUTCMonth() === Number(m[2]) - 1 ? t : null
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/** DPP pela regra de Naegele: DUM + 280 dias. */
export function dppPelaDum(dum: string): string | null {
  const t = utc(dum)
  return t === null ? null : iso(t + 280 * DIA)
}

/** Idade gestacional na data `hoje`; null se a DUM é inválida ou está no futuro. */
export function igPelaDum(dum: string, hoje: string): { semanas: number; dias: number } | null {
  const a = utc(dum)
  const b = utc(hoje)
  if (a === null || b === null || b < a) return null
  const total = Math.round((b - a) / DIA)
  return { semanas: Math.floor(total / 7), dias: total % 7 }
}

export type Gestacao = {
  tipo: TipoGestacao | null
  g: string
  p: string
  a: string
  dum: string
  dumNaoInformada: boolean
  igSemanas: string
  igDias: string
  dpp: string
  intercorrencias: boolean
  intercorrenciasTexto: string
  observacao: string
}

export const GESTACAO_VAZIA: Gestacao = {
  tipo: null, g: '', p: '', a: '', dum: '', dumNaoInformada: false, igSemanas: '', igDias: '', dpp: '',
  intercorrencias: false, intercorrenciasTexto: '', observacao: '',
}

const inteiro = (t: string) => (/^\d{1,2}$/.test(t.trim()) ? Number(t.trim()) : null)

/** Erro de preenchimento (texto para a tela) ou '' quando está coerente. */
export function erroGestacao(g: Gestacao, hoje: string): string {
  if (!g.tipo || !ehGestante(g.tipo)) return ''
  for (const [k, rot] of [['g', 'G'], ['p', 'P'], ['a', 'A']] as const) {
    if (g[k].trim() && inteiro(g[k]) === null) return `${rot} deve ser um número inteiro.`
  }
  if (g.dum && g.dumNaoInformada) return 'Marque "DUM não informada" ou preencha a DUM, não os dois.'
  if (g.dum && !igPelaDum(g.dum, hoje)) return 'A DUM não pode ser depois de hoje.'
  if (!g.dum) {
    if (g.igSemanas.trim() && inteiro(g.igSemanas) === null) return 'IG em semanas deve ser um número inteiro.'
    if (g.igDias.trim() && (inteiro(g.igDias) === null || inteiro(g.igDias)! > 6)) return 'IG em dias vai de 0 a 6.'
  }
  if (g.intercorrencias && !g.intercorrenciasTexto.trim()) return 'Descreva as intercorrências.'
  return ''
}

/** O que vai ao servidor (p_gestacao). IG e DPP pela DUM o servidor recalcula. */
export function registroGestacao(g: Gestacao) {
  if (!g.tipo) return null
  const obs = g.observacao.trim() || undefined
  if (!ehGestante(g.tipo)) return { tipo: g.tipo, observacao: obs }
  const n = (t: string) => inteiro(t) ?? undefined
  return {
    tipo: g.tipo,
    g: n(g.g), p: n(g.p), a: n(g.a),
    dum: g.dum || undefined,
    dum_nao_informada: g.dumNaoInformada,
    ig_semanas: g.dum ? undefined : n(g.igSemanas),
    ig_dias: g.dum ? undefined : n(g.igDias),
    dpp: g.dum ? undefined : g.dpp || undefined,
    intercorrencias: g.intercorrencias,
    intercorrencias_texto: g.intercorrencias ? g.intercorrenciasTexto.trim() : undefined,
    observacao: obs,
  }
}
