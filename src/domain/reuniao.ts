// Agenda do administrador (pedido do RT, 24/11/2026): reuniões com o link
// colado (Meet, Zoom, Teams ou outra plataforma), sem integração com Google ou
// Microsoft. As regras do link são as mesmas do banco (private.link_reuniao_ok
// e private.plataforma_reuniao, migration 20270421000030).

export type Plataforma = 'Google Meet' | 'Zoom' | 'Microsoft Teams' | 'Outra plataforma'

export type Convidado = { id: string; nome: string }

export type Reuniao = {
  id: string
  titulo: string
  inicio: string
  fim: string
  link: string | null
  plataforma: Plataforma | null
  pauta: string | null
  cancelada: boolean
  sou_criador: boolean
  criador_nome: string
  convidados: Convidado[]
}

const LINK_OK = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(:[0-9]{1,5})?([/?#][^\s<>"]*)?$/i

/** O link só vale com https:// e um endereço de verdade (sem usuário@, sem espaço). */
export function linkValido(link: string): boolean {
  const l = link.trim()
  return l.length > 0 && l.length <= 500 && LINK_OK.test(l)
}

/** A plataforma pelo endereço; null quando o link não vale. */
export function plataformaDoLink(link: string | null | undefined): Plataforma | null {
  const l = (link ?? '').trim()
  if (!linkValido(l)) return null
  if (/^https:\/\/meet\.google\.com([/?#:]|$)/i.test(l)) return 'Google Meet'
  if (/^https:\/\/([a-z0-9-]+\.)*zoom\.(us|com)([/?#:]|$)/i.test(l)) return 'Zoom'
  if (/^https:\/\/(teams\.microsoft\.com|teams\.live\.com)([/?#:]|$)/i.test(l)) return 'Microsoft Teams'
  return 'Outra plataforma'
}

export const LIMITE_TITULO = 120
export const LIMITE_PAUTA = 2000
export const LIMITE_CONVIDADOS = 50

export type FormReuniao = { titulo: string; data: string; inicio: string; fim: string; link: string; pauta: string; convidados: string[] }

/** O que falta para salvar (o banco confere de novo). */
export function problemaDaReuniao(f: FormReuniao): string | null {
  const titulo = f.titulo.trim()
  if (titulo.length < 3 || titulo.length > LIMITE_TITULO) return 'Dê um título à reunião (de 3 a 120 letras).'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return 'Escolha o dia.'
  if (!/^\d{2}:\d{2}$/.test(f.inicio) || !/^\d{2}:\d{2}$/.test(f.fim)) return 'Informe o início e o fim.'
  const dur = minutos(f.fim) - minutos(f.inicio)
  if (dur <= 0) return 'O fim tem de ser depois do início.'
  if (dur > 12 * 60) return 'A reunião pode durar até 12 horas.'
  if (f.link.trim() && !linkValido(f.link)) return 'Cole o endereço completo da reunião, começando com https://.'
  if (f.pauta.trim().length > LIMITE_PAUTA) return 'A pauta pode ter até 2.000 letras.'
  if (f.convidados.length > LIMITE_CONVIDADOS) return 'Convide até 50 pessoas por reunião.'
  return null
}

/** "14:30" → 870 */
export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// ── dias (YYYY-MM-DD, sem fuso: o dia de Brasília já vem pronto) ─────────────
const comoUtc = (iso: string) => new Date(iso + 'T12:00:00Z')
const paraIso = (d: Date) => d.toISOString().slice(0, 10)

export function somarDias(iso: string, n: number): string {
  const d = comoUtc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return paraIso(d)
}

/** A segunda-feira da semana do dia. */
export function inicioDaSemana(iso: string): string {
  const dow = comoUtc(iso).getUTCDay() // 0 = domingo
  return somarDias(iso, dow === 0 ? -6 : 1 - dow)
}

/** Os sete dias (segunda a domingo) da semana do dia. */
export function diasDaSemana(iso: string): string[] {
  const seg = inicioDaSemana(iso)
  return Array.from({ length: 7 }, (_, i) => somarDias(seg, i))
}
