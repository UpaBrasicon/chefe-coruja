// Atraso na checagem (lacuna 9 do Portão de 11/10/2026; decisão do RT em
// 10/11/2026: A em A1 a A9; docs/porta/LACUNA-09-ATRASADO-CHECAGEM-DIAGNOSTICO.md).
//
// Quem decide é o servidor (migration 20270331000001): checar recusa o "feito"
// atrasado sem motivo e grava atraso_min e atrasada; o job registra a dose
// atrasada e a omissão. Aqui ficam os espelhos para a tela avisar antes de
// mandar (private.janela_atraso, private.item_conta_atraso,
// private.horario_previsto), a lista de motivos e as contas do indicador.

/** Portaria MS 2.095/2013, Anexo 03, e a regra da unidade (RT, 30/09/2026). */
export const FONTE_ATRASO =
  'Portaria MS 2.095/2013, Anexo 03: atrasar a dose só com o consentimento do enfermeiro (item IV), registrar o horário e a ocorrência (item VI) e comunicar a omissão (item 7.2). Regra da unidade: tolerância de 2 h; depois de 12 h sem checagem, omissão.'

export const MOTIVOS_ATRASO = [
  { valor: 'fora_do_setor_exame', rotulo: 'Paciente fora do setor ou em exame' },
  { valor: 'falta_medicamento', rotulo: 'Falta do medicamento' },
  { valor: 'sem_acesso_venoso', rotulo: 'Sem acesso venoso' },
  { valor: 'jejum_procedimento', rotulo: 'Jejum ou procedimento' },
  { valor: 'aguardando_farmacia', rotulo: 'Aguardando a farmácia' },
  { valor: 'intercorrencia', rotulo: 'Intercorrência' },
  { valor: 'outro', rotulo: 'Outro' },
] as const
export type MotivoAtraso = (typeof MOTIVOS_ATRASO)[number]['valor']

/** "Outro" pede texto com pelo menos isto de letras (o servidor também exige). */
export const MINIMO_OUTRO = 5
export const JANELA_PADRAO_MIN = 120
export const OMISSAO_MIN = 12 * 60
const ANTES_MIN = 2 * 60
const DEPOIS_MIN = 22 * 60
const MIN = 60_000
const DIA = 24 * 60 * MIN
/** Brasília não tem horário de verão desde 2019. */
const FUSO_MIN = -3 * 60
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/

export function rotuloMotivoAtraso(v: string | null | undefined): string | null {
  return MOTIVOS_ATRASO.find((m) => m.valor === v)?.rotulo ?? null
}

/** Motivo pronto para mandar: da lista e, se "outro", com texto. */
export function motivoAtrasoValido(motivo: string, texto: string): boolean {
  if (!rotuloMotivoAtraso(motivo)) return false
  return motivo !== 'outro' || texto.trim().length >= MINIMO_OUTRO
}

const minutosDoDia = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))

/**
 * Janela de tolerância em minutos: 2 h, ou o menor intervalo entre dois
 * horários do item (dando a volta no dia). Espelho de private.janela_atraso.
 */
export function janelaAtrasoMin(horarios: readonly string[] | null | undefined): number {
  const m = [...new Set((horarios ?? []).filter((h) => HORARIO.test(h)).map(minutosDoDia))].sort((a, b) => a - b)
  if (m.length === 0) return JANELA_PADRAO_MIN
  let menor = 1440
  m.forEach((x, i) => { menor = Math.min(menor, (i + 1 < m.length ? m[i + 1] : m[0] + 1440) - x) })
  return Math.min(JANELA_PADRAO_MIN, menor)
}

export type ItemAtraso = {
  tipo: string; posologia: string | null; se_necessario: boolean; vasoativo?: boolean | null; horarios: readonly string[] | null
}

/**
 * O item entra na regra do atraso: aprazado, fora "Agora", "Se necessário",
 * contenção e infusão (contínuo, bomba, BIC ou vasoativo). Espelho de
 * private.item_conta_atraso.
 */
export function contaAtraso(i: ItemAtraso): boolean {
  if (i.tipo === 'contencao' || i.se_necessario || (i.horarios?.length ?? 0) === 0) return false
  const p = (i.posologia ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (p === 'agora') return false
  if (/(continu|bomba|(^|[^a-z0-9_])bic($|[^a-z0-9_]))/.test(p)) return false
  return !i.vasoativo
}

/**
 * Instante (ms) do horário aprazado a que uma checagem feita em `em` se
 * refere: de 2 h antes a 22 h depois. Espelho de private.horario_previsto.
 */
export function previstoDoHorario(h: string, em: number): number | null {
  if (!HORARIO.test(h)) return null
  const local = em + FUSO_MIN * MIN
  const dia = Math.floor(local / DIA) * DIA
  for (const k of [-1, 0, 1]) {
    const s = dia + k * DIA + minutosDoDia(h) * MIN - FUSO_MIN * MIN
    if (em >= s - ANTES_MIN * MIN && em < s + DEPOIS_MIN * MIN) return s
  }
  return null
}

/** "3 h 10 min", "45 min" (como private.duracao_texto). */
export function duracaoTexto(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}

export type ChecagemHorario = { situacao: string; em: string; atrasada?: boolean | null; atraso_min?: number | null; motivo_atraso?: string | null; motivo_atraso_texto?: string | null }
export type EstadoHorario =
  | { tipo: 'checado'; checagem: ChecagemHorario }
  | { tipo: 'no_prazo' }
  | { tipo: 'atrasado'; minutos: number }
  | { tipo: 'omitido'; minutos: number }
  | { tipo: 'fora' }

/**
 * Situação do horário agora, pela regra do servidor: checado (a checagem
 * deste dia), no prazo, atrasado (passou da janela) ou omitido (12 h sem
 * checagem). Horário anterior à prescrição ou posterior à validade não é dose.
 */
export function estadoDoHorario(
  item: ItemAtraso & { prescrito_em?: string | null; valida_ate?: string | null },
  h: string, checagem: ChecagemHorario | null | undefined, agora: number,
): EstadoHorario {
  const s = previstoDoHorario(h, agora)
  if (s === null) return { tipo: 'fora' }
  if (checagem && Date.parse(checagem.em) >= s - ANTES_MIN * MIN) return { tipo: 'checado', checagem }
  if (!contaAtraso(item)) return { tipo: 'fora' }
  const prescrito = item.prescrito_em ? Math.floor(Date.parse(item.prescrito_em) / MIN) * MIN : null
  if (prescrito !== null && s < prescrito) return { tipo: 'no_prazo' }
  if (item.valida_ate && s >= Date.parse(item.valida_ate)) return { tipo: 'fora' }
  const passou = (agora - s) / MIN
  if (passou > OMISSAO_MIN) return { tipo: 'omitido', minutos: passou }
  if (passou > janelaAtrasoMin(item.horarios)) return { tipo: 'atrasado', minutos: passou }
  return { tipo: 'no_prazo' }
}

/**
 * Minutos de atraso de um "feito" agora no horário h, ou null se não estiver
 * atrasado (o servidor pede o motivo nesse caso). O atraso conta da
 * prescrição quando o horário é anterior a ela.
 */
export function atrasoDoFeito(item: ItemAtraso & { prescrito_em?: string | null }, h: string, agora: number): number | null {
  if (!contaAtraso(item)) return null
  const s = previstoDoHorario(h, agora)
  if (s === null) return null
  const prescrito = item.prescrito_em ? Math.floor(Date.parse(item.prescrito_em) / MIN) * MIN : -Infinity
  const passou = (agora - Math.max(s, prescrito)) / MIN
  return passou > janelaAtrasoMin(item.horarios) ? passou : null
}

// ── indicador do gestor (Anexo 03, item 7.3.1) ──────────────────────────────
export type LinhaIndicadorAtraso = {
  mes: string; setor_id: string | null; setor: string | null; previstas: number; feitas: number; atrasadas: number; omissoes: number
}
export type IndicadorAtraso = {
  de: string; ate: string; linhas: LinhaIndicadorAtraso[]
  total: { previstas: number; feitas: number; atrasadas: number; omissoes: number }
}

/** "12,5%", ou "—" sem denominador. */
export function taxa(numerador: number, denominador: number): string {
  if (!denominador) return '—'
  const v = Math.round((numerador / denominador) * 1000) / 10
  return `${String(v).replace('.', ',')}%`
}

/** "11/2026" de "2026-11". */
export const rotuloMes = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`

export const CABECALHO_CSV_ATRASO = ['Mês', 'Setor', 'Doses previstas', 'Doses feitas', 'Feitas com atraso', 'Taxa de atraso', 'Omissões', 'Taxa de omissão']

export function linhasCsvAtraso(d: IndicadorAtraso): (string | number)[][] {
  const linhas = d.linhas.map((l) => [rotuloMes(l.mes), l.setor ?? 'Sem setor', l.previstas, l.feitas, l.atrasadas, taxa(l.atrasadas, l.feitas), l.omissoes, taxa(l.omissoes, l.previstas)])
  const t = d.total
  return [...linhas, ['Total', '', t.previstas, t.feitas, t.atrasadas, taxa(t.atrasadas, t.feitas), t.omissoes, taxa(t.omissoes, t.previstas)]]
}
