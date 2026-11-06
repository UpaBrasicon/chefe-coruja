// Frequência com horário na prescrição do PS (achado guardado de 07/10/2026;
// decisão do RT em 06/11/2026: A em F1 a F6;
// docs/porta/FREQUENCIA-PRESCRICAO-PS-DIAGNOSTICO.md).
//
// Quem decide é o servidor (prescrever e private.frequencia_porta_reconhecida,
// migration 20270301000001). Aqui ficam os chips da porta, a mesma leitura do
// intervalo (para avisar antes de mandar), o resumo das doses por horário que o
// painel da porta devolve e a coluna de aprazamento da folha impressa.

export const FREQUENCIAS_PORTA = ['Agora', 'Se necessário', '4/4h', '6/6h', '8/8h', '12/12h', '24/24h'] as const
/** Chip que abre o campo livre; o servidor confere se entende o que foi escrito. */
export const OUTRA = 'Outra'

const INTERVALOS = [1, 2, 3, 4, 6, 8, 12, 24]
// \M do Postgres (fim de palavra), com acento
const FIM = '(?![\\p{L}\\p{N}_])'
const re = (s: string) => new RegExp(s, 'u')

/**
 * Intervalo em horas que a posologia diz, ou null. Espelho de
 * private.intervalo_posologia (migration 20261031000002): "8/8h", "de 6 em 6
 * h", "a cada 4 horas", "3x ao dia", "duas vezes ao dia".
 */
export function intervaloDaPosologia(p: string | null | undefined): number | null {
  const t = (p ?? '').toLowerCase()
  let n: number | null = null
  let m = t.match(re(`(\\d{1,2})\\s*/\\s*(\\d{1,2})\\s*(h|hs|hora|horas)${FIM}`))
  if (m && m[1] === m[2]) n = Number(m[1])
  if (n === null) {
    m = t.match(re(`de\\s+(\\d{1,2})\\s+em\\s+(\\d{1,2})\\s*(h|hs|hora|horas)${FIM}`))
    if (m && m[1] === m[2]) n = Number(m[1])
  }
  if (n === null) {
    m = t.match(re(`a\\s+cada\\s+(\\d{1,2})\\s*(h|hs|hora|horas)${FIM}`))
    if (m) n = Number(m[1])
  }
  if (n === null) {
    m = t.match(/(\d{1,2})\s*(x|vez|vezes)\s*(ao|por|\/|a)?\s*dia/)
    const k = m ? Number(m[1]) : 0
    if (k >= 1 && k <= 24 && 24 % k === 0) n = 24 / k
  }
  if (n === null && /uma\s+vez\s+(ao|por)\s+dia/.test(t)) n = 24
  if (n === null && /duas\s+vezes\s+(ao|por)\s+dia/.test(t)) n = 12
  if (n === null && /tr[eê]s\s+vezes\s+(ao|por)\s+dia/.test(t)) n = 8
  if (n === null && /quatro\s+vezes\s+(ao|por)\s+dia/.test(t)) n = 6
  return n !== null && INTERVALOS.includes(n) ? n : null
}

/**
 * Frequência que a porta aceita (F1): Agora, Contínuo, Se necessário (com a
 * marca de se necessário) ou um intervalo reconhecido. Espelho de
 * private.frequencia_porta_reconhecida.
 */
export function frequenciaPortaReconhecida(posologia: string, seNecessario: boolean): boolean {
  const t = posologia.trim().toLowerCase()
  if (['agora', 'contínuo', 'continuo'].includes(t)) return true
  if (['se necessário', 'se necessario'].includes(t)) return seNecessario
  return intervaloDaPosologia(t) !== null
}

// ── doses por horário (F2) ──────────────────────────────────────────────────
export type SituacaoDose = 'feito' | 'nao_feito' | 'recusado' | 'pendente' | 'atrasada'
/** Uma dose do item, como o painel da porta devolve (private.doses_do_item). */
export type DosePS = {
  horario: string; previsto_em: string; situacao: SituacaoDose
  em: string | null; por: string | null; motivo: string | null
}

export const ROTULO_DOSE: Record<SituacaoDose, string> = {
  feito: 'Feita', nao_feito: 'Não feita', recusado: 'Recusada', pendente: 'Pendente', atrasada: 'Atrasada',
}

export function resumoDoses(doses: DosePS[]) {
  const n = (s: SituacaoDose) => doses.filter((d) => d.situacao === s).length
  return { feitas: n('feito'), naoFeitas: n('nao_feito'), recusadas: n('recusado'), atrasadas: n('atrasada'), pendentes: n('pendente') }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "1 feita · 1 atrasada · 2 pendentes" (sem as partes zeradas). */
export function textoResumoDoses(doses: DosePS[]): string {
  const r = resumoDoses(doses)
  return [
    r.feitas && plural(r.feitas, 'feita', 'feitas'),
    r.naoFeitas && plural(r.naoFeitas, 'não feita', 'não feitas'),
    r.recusadas && plural(r.recusadas, 'recusada', 'recusadas'),
    r.atrasadas && plural(r.atrasadas, 'atrasada', 'atrasadas'),
    r.pendentes && plural(r.pendentes, 'pendente', 'pendentes'),
  ].filter(Boolean).join(' · ')
}

/**
 * Vermelho: dose vencida sem resolver (atrasada ou recusada; a alta após
 * medicação espera feito ou "não feito" com motivo). Âmbar: falta dose. Verde:
 * todas resolvidas.
 */
export function tomDoses(doses: DosePS[]): 'vermelho' | 'ambar' | 'verde' {
  const r = resumoDoses(doses)
  if (r.atrasadas > 0 || r.recusadas > 0) return 'vermelho'
  return r.pendentes > 0 ? 'ambar' : 'verde'
}

/** Frequência com intervalo, ainda sem os horários da enfermagem. */
export function aguardaAprazamento(i: { posologia: string | null; se_necessario: boolean; horarios?: string[] | null }): boolean {
  return !i.se_necessario && intervaloDaPosologia(i.posologia) !== null && (i.horarios ?? []).length === 0
}

/** Coluna "aprazamento" da folha impressa (F6): os horários, separados por espaço. */
export function aprazamentoImpresso(horarios: string[] | null | undefined): string {
  return (horarios ?? []).join(' ')
}
