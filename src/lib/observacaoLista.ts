// Lista da Observação (OB1 e OB2, revisão aprovada pelo RT em 24/11/2026):
// um tempo só por linha, a situação em palavras do plantão, a ação principal
// conforme a situação e os vencidos primeiro. O estado continua vindo do
// servidor (painel_observacao); aqui só se rotula, conta e ordena.
// Sem dependência de tela: os testes rodam no node.
import { dataHora, hora } from './formato.ts'

export type EstadoObs = 'nao' | 'atendimento' | 'reavaliacao' | 'encaminhado' | 'finalizado'
export type TomSituacao = 'cinza' | 'teal' | 'ambar' | 'verde' | 'vermelho'

/** Situação da linha: Não atendido, Em conduta, Aguardando exame, Aguardando regulação (e Finalizado). */
export function situacaoObservacao(estado: EstadoObs, c: { examePendente?: boolean; encaminhado?: boolean } = {}): { rotulo: string; tom: TomSituacao } {
  if (estado === 'finalizado') return { rotulo: 'Finalizado', tom: 'verde' }
  if (estado === 'nao') return { rotulo: 'Não atendido', tom: 'cinza' }
  if (estado === 'encaminhado' || c.encaminhado) return { rotulo: 'Aguardando regulação', tom: 'teal' }
  if (c.examePendente) return { rotulo: 'Aguardando exame', tom: 'ambar' }
  return { rotulo: 'Em conduta', tom: 'teal' }
}

/** "há 45 min", "há 5 h 20 min", "há 45 d 15 h". */
export function haQuanto(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h${m % 60 ? ` ${m % 60} min` : ''}`
  const d = Math.floor(h / 24)
  return `há ${d} d${h % 24 ? ` ${h % 24} h` : ''}`
}

/** O único tempo da linha e o "desde", com a data quando passa de 24 horas. */
export function tempoNaObservacao(entrada: string, agora: number): { ha: string; desde: string } {
  const min = (agora - Date.parse(entrada)) / 60_000
  return { ha: haQuanto(min), desde: min >= 24 * 60 ? `desde ${dataHora(entrada)}` : `desde ${hora(entrada)}` }
}

export type AcaoPrincipal = 'atender' | 'conduta'

/** OB2: "Atender" se ninguém atendeu; atendido, "Definir conduta". */
export const acaoPrincipal = (estado: EstadoObs): AcaoPrincipal | null =>
  estado === 'finalizado' ? null : estado === 'nao' ? 'atender' : 'conduta'

/** Vencidos (passou das 6 h) primeiro; depois quem chegou antes. */
export function ordenarObservacao<T extends { entrada: string; prazo: string }>(lista: readonly T[], agora: number): T[] {
  const venceu = (x: T) => Date.parse(x.prazo) <= agora
  return [...lista].sort((a, b) => Number(venceu(b)) - Number(venceu(a)) || Date.parse(a.entrada) - Date.parse(b.entrada))
}

/** OO1: "Reavaliar às" com atalhos: a hora de agora + N minutos, no formato do campo (HH:MM, fuso de Brasília). */
export function horaMais(agora: number, minutos: number): string {
  return hora(new Date(agora + minutos * 60_000).toISOString())
}
