// Turno e janela de observação — cálculo puro; a hora entra por parâmetro e
// vem sempre do servidor (ADR 0003: nenhuma regra usa o relógio do aparelho).

export type Nivel = 'ok' | 'atencao' | 'critico'

/** Turnos como o banco atual os declara (private.turno_atual), hora de Brasília. */
export const TURNOS = {
  manha: { inicio: 7, fim: 13 },
  tarde: { inicio: 13, fim: 19 },
  noite: { inicio: 19, fim: 7 },
} as const
export type Turno = keyof typeof TURNOS

/** Minutos desde a meia-noite em America/Sao_Paulo para um instante. */
export function minutosEmBrasilia(instante: Date): number {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante)
  const h = Number(partes.find((p) => p.type === 'hour')?.value)
  const m = Number(partes.find((p) => p.type === 'minute')?.value)
  return h * 60 + m
}

/**
 * Quanto falta para o fim do turno e quanto ele dura, em minutos.
 * O turno da noite atravessa a meia-noite.
 */
export function tempoDeTurno(turno: Turno, agoraServidor: Date): { restante: number; duracao: number } {
  const { inicio, fim } = TURNOS[turno]
  const agora = minutosEmBrasilia(agoraServidor)
  const ini = inicio * 60
  let f = fim * 60
  if (f <= ini) f += 24 * 60
  let a = agora
  if (a < ini) a += 24 * 60
  const duracao = f - ini
  const restante = Math.max(0, Math.min(duracao, f - a))
  return { restante, duracao }
}

/** Fim de turno: atenção na última hora, crítico nos últimos 15 minutos. */
export function nivelDoTurno(restante: number): Nivel {
  if (restante <= 15) return 'critico'
  if (restante <= 60) return 'atencao'
  return 'ok'
}

/** A janela de observação: 6 horas. Estourá-la é o alerta mais frequente do produto. */
export const JANELA_OBSERVACAO_MIN = 360

/** Verde com mais de 1 h restante, âmbar na última hora, vermelho depois de 6 h. */
export function nivelDaObservacao(minutos: number): Nivel {
  if (minutos > JANELA_OBSERVACAO_MIN) return 'critico'
  if (minutos >= JANELA_OBSERVACAO_MIN - 60) return 'atencao'
  return 'ok'
}

/** "3h05", "45 min" — para numeral com unidade separada, use `partesDuracao`. */
export function formatarDuracao(minutos: number): string {
  const m = Math.max(0, Math.round(minutos))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}`
}

/**
 * Tempo restante de um plantão com janela conhecida (início e fim vindos da
 * escala, ADR 0003). Preferir a `tempoDeTurno`, que só conhece o rótulo.
 */
export function tempoDaJanela(inicio: Date, fim: Date, agoraServidor: Date): { restante: number; duracao: number } {
  const duracao = Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 60_000))
  const restante = Math.max(0, Math.min(duracao, Math.round((fim.getTime() - agoraServidor.getTime()) / 60_000)))
  return { restante, duracao }
}
