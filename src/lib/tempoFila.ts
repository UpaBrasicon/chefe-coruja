// Tempo nas filas da porta (RF1, revisão do perfil Recepção, RT 24/11/2026).
// Uma conta só para todas as telas da recepção: quem espera conta desde a
// classificação (fila médica) ou desde a ficha (triagem e UBS, que não
// classifica); quem está em atendimento conta desde o início do atendimento.
// Antes, a linha "em atendimento" da recepção mostrava a espera congelada
// (classificação até o início), e a enfermagem mostrava o tempo desde o início:
// o mesmo paciente aparecia com 1h05 numa tela e 34 dias na outra.
import { ALVO_MIN, type CorRisco } from '../domain/risco.ts'
import { formatarDuracao } from '../domain/plantao.ts'
import { dataIso, diaMes, hora } from './formato.ts'

export type LinhaTempo = {
  etapa: string
  chegada_em: string
  classificado_em: string | null
  atendimento_iniciado_em: string | null
  cor_atual?: CorRisco | null
}

export type TempoFila = {
  /** espera: ainda não foi atendido; atendimento: o médico já começou */
  tipo: 'espera' | 'atendimento'
  /** instante de onde a conta parte */
  desde: string
  minutos: number
}

const minutosEntre = (desde: string, agora: number) => Math.max(0, Math.round((agora - new Date(desde).getTime()) / 60_000))

/** De onde conta a espera: da classificação na fila médica (fora da UBS), senão da ficha. */
export function inicioDaEspera(e: LinhaTempo, ubs = false): string {
  return e.etapa === 'atendimento' && !ubs ? (e.classificado_em ?? e.chegada_em) : e.chegada_em
}

export function tempoNaFila(e: LinhaTempo, agora: number, ubs = false): TempoFila {
  if (e.atendimento_iniciado_em) {
    return { tipo: 'atendimento', desde: e.atendimento_iniciado_em, minutos: minutosEntre(e.atendimento_iniciado_em, agora) }
  }
  const desde = inicioDaEspera(e, ubs)
  return { tipo: 'espera', desde, minutos: minutosEntre(desde, agora) }
}

/** "espera 25 min" ou "em atendimento há 1h05". */
export function textoTempo(t: TempoFila): string {
  return t.tipo === 'atendimento' ? `em atendimento há ${formatarDuracao(t.minutos)}` : `espera ${formatarDuracao(t.minutos)}`
}

/** Alvo da cor em minutos, só para quem espera o médico fora da UBS. */
export function alvoDaLinha(e: LinhaTempo, ubs = false): number | null {
  return e.etapa === 'atendimento' && !ubs && !e.atendimento_iniciado_em && e.cor_atual ? ALVO_MIN[e.cor_atual] : null
}

/** Passou do alvo da cor (quem ainda espera o médico). */
export function acimaDoAlvo(e: LinhaTempo, agora: number, ubs = false): boolean {
  const alvo = alvoDaLinha(e, ubs)
  return alvo !== null && tempoNaFila(e, agora, ubs).minutos > alvo
}

/** Maior espera de quem ainda não foi atendido, por extenso; "—" sem ninguém esperando. */
export function maiorEspera(itens: LinhaTempo[], agora: number, ubs = false): string {
  const minutos = itens.filter((e) => !e.atendimento_iniciado_em).map((e) => tempoNaFila(e, agora, ubs).minutos)
  return minutos.length ? formatarDuracao(Math.max(...minutos)) : '—'
}

/** "Ficha às 11:49" hoje; "Ficha em 21/10 às 11:49" em outro dia. */
export function horaDaFicha(chegada: string, hoje: string): string {
  return dataIso(chegada) === hoje ? `Ficha às ${hora(chegada)}` : `Ficha em ${diaMes(chegada)} às ${hora(chegada)}`
}
