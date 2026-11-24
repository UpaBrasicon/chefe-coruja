// Ronda da checagem por horário (CK1–CK3, revisão do perfil Enfermeiro, RT
// 24/11/2026). A ronda de medicação é por hora, cruzando pacientes: o que está
// atrasado, o que é agora (30 min antes e depois), as próximas 2 h e o resto.
// Só arruma a tela: quem decide atraso, validade e o que se pode checar segue
// sendo o servidor (checar, aprazar, pedir_renovacao) e os espelhos de
// lib/atraso e lib/validadePrescricao.
import { estadoDoHorario, janelaAtrasoMin, type ChecagemHorario, type ItemAtraso } from './atraso.ts'
import { doseUnicaFeita } from './duplaChecagem.ts'
import { validadeDoItem } from './validadePrescricao.ts'

export type GrupoRonda = 'atrasadas' | 'agora' | 'proximas' | 'mais_tarde' | 'sem_horario' | 'feitos'

export const GRUPOS_RONDA: readonly { id: GrupoRonda; rotulo: string }[] = [
  { id: 'atrasadas', rotulo: 'Atrasadas' },
  { id: 'agora', rotulo: 'Agora' },
  { id: 'proximas', rotulo: 'Próximas 2 h' },
  { id: 'mais_tarde', rotulo: 'Mais tarde' },
  { id: 'sem_horario', rotulo: 'Se necessário e sem horário' },
  { id: 'feitos', rotulo: 'Feitos neste plantão' },
]

export type ItemRonda = ItemAtraso & {
  prescrito_em?: string | null
  valida_ate?: string | null
  validade?: string | null
  ultima_situacao: string | null
  por_horario: Record<string, ChecagemHorario> | null
}

const MIN = 60_000
const DIA = 24 * 60 * MIN
/** Brasília, sem horário de verão desde 2019 (como lib/atraso). */
const FUSO_MIN = -3 * 60
/** "Agora" é de 30 min antes a 30 min depois do horário. */
export const JANELA_AGORA_MIN = 30
export const JANELA_PROXIMAS_MIN = 120

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/
const ehAgora = (posologia: string | null) => (posologia ?? '').trim().toLowerCase() === 'agora'

/** As ocorrências de "HH:MM" de ontem, hoje e amanhã (horário de Brasília), em ms. */
function ocorrencias(h: string, agora: number): number[] {
  if (!HORARIO.test(h)) return []
  const minutos = Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
  const dia = Math.floor((agora + FUSO_MIN * MIN) / DIA) * DIA
  return [-1, 0, 1].map((k) => dia + k * DIA + minutos * MIN - FUSO_MIN * MIN)
}

/** Este horário já foi checado na ocorrência `s` (a checagem vale de 2 h antes em diante, como no servidor). */
const checadoEm = (c: ChecagemHorario | undefined, s: number) => !!c && Date.parse(c.em) >= s - 2 * 60 * MIN

export type EstadoFicha = 'feito' | 'atrasado' | 'agora' | 'proximo' | 'depois'

/**
 * CK3: o estado de cada horário aprazado, para a ficha "06:00 · feito".
 * Atrasado e omitido seguem a regra do servidor (estadoDoHorario).
 */
export function estadoDaFicha(l: ItemRonda, h: string, agora: number): EstadoFicha {
  const e = estadoDoHorario(l, h, l.por_horario?.[h], agora)
  if (e.tipo === 'checado') return 'feito'
  if (e.tipo === 'atrasado' || e.tipo === 'omitido') return 'atrasado'
  const prox = proximaOcorrencia(l, h, agora)
  if (prox === null) return 'depois'
  const delta = (prox - agora) / MIN
  if (delta <= JANELA_AGORA_MIN) return 'agora'
  if (delta <= JANELA_PROXIMAS_MIN) return 'proximo'
  return 'depois'
}

/**
 * A ocorrência pendente mais próxima: a que ainda está dentro da tolerância
 * (passou, mas não está atrasada) ou a seguinte. Horário antes da prescrição
 * ou depois da validade não é dose (como estadoDoHorario).
 */
function proximaOcorrencia(l: ItemRonda, h: string, agora: number): number | null {
  const c = l.por_horario?.[h]
  const prescrito = l.prescrito_em ? Math.floor(Date.parse(l.prescrito_em) / MIN) * MIN : -Infinity
  const ate = l.valida_ate ? Date.parse(l.valida_ate) : Infinity
  const desde = agora - Math.max(JANELA_AGORA_MIN, janelaAtrasoMin(l.horarios)) * MIN
  const s = ocorrencias(h, agora).filter((x) => x >= desde && x >= prescrito && x < ate && !checadoEm(c, x))
  return s.length ? Math.min(...s) : null
}

/**
 * CK1: em que grupo da ronda o item entra, pelo horário mais urgente.
 * Dose única já feita vai para "Feitos neste plantão" (CK2). "Agora" sem
 * horário é para já. Se necessário e item ainda sem aprazamento ficam à parte.
 */
export function grupoDoItem(l: ItemRonda, agora: number): { grupo: GrupoRonda; instante: number | null } {
  if (doseUnicaFeita(l.posologia, l.se_necessario, l.ultima_situacao)) return { grupo: 'feitos', instante: null }
  const horarios = l.horarios ?? []
  if (horarios.length === 0) {
    if (!l.se_necessario && ehAgora(l.posologia)) return { grupo: 'agora', instante: null }
    return { grupo: 'sem_horario', instante: null }
  }
  if (l.se_necessario) return { grupo: 'sem_horario', instante: null }
  let atrasado: number | null = null
  for (const h of horarios) {
    const e = estadoDoHorario(l, h, l.por_horario?.[h], agora)
    if (e.tipo === 'atrasado' || e.tipo === 'omitido') atrasado = Math.max(atrasado ?? 0, e.minutos)
  }
  if (atrasado !== null) return { grupo: 'atrasadas', instante: agora - atrasado * MIN }
  const proximas = horarios.map((h) => proximaOcorrencia(l, h, agora)).filter((x): x is number => x !== null)
  if (proximas.length === 0) return { grupo: 'mais_tarde', instante: null }
  const s = Math.min(...proximas)
  const delta = (s - agora) / MIN
  if (delta <= JANELA_AGORA_MIN) return { grupo: 'agora', instante: s }
  if (delta <= JANELA_PROXIMAS_MIN) return { grupo: 'proximas', instante: s }
  return { grupo: 'mais_tarde', instante: s }
}

/** Os itens arrumados nos grupos da ronda, cada grupo pelo horário (o mais antigo primeiro). */
export function agruparRonda<T extends ItemRonda>(itens: readonly T[], agora: number): { id: GrupoRonda; rotulo: string; itens: T[] }[] {
  const comGrupo = itens.map((l) => ({ l, ...grupoDoItem(l, agora) }))
  return GRUPOS_RONDA.map((g) => ({
    ...g,
    itens: comGrupo
      .filter((x) => x.grupo === g.id)
      .sort((a, b) => (a.instante ?? Infinity) - (b.instante ?? Infinity))
      .map((x) => x.l),
  }))
}

/** CK2: prescrição vencida: só a faixa, "Pedir renovação" e "Não feito". */
export const itemVencido = (l: { valida_ate?: string | null; validade?: string | null }, agora: number) => validadeDoItem(l, agora) === 'vencido'
