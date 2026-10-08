// Regras da tela Porta (Dashboard PS/UPA do gestor, Fase 1, tarefa 2): o
// formato devolvido por porta_agora(), o tempo por extenso e a etapa gargalo.
import type { CorRisco } from '@/domain/risco'

export type EtapaChave = 'triagem' | 'aguardando_medico' | 'em_atendimento' | 'medicacao_pendente' | 'observacao' | 'altas_hoje'
export type Paciente = {
  nome: string; etapa: 'triagem' | 'aguardando_medico' | 'em_atendimento' | 'observacao'; cor: CorRisco | null
  setor: string | null; leito: string | null; espera_min: number; fora_alvo: boolean; medicacao_pendente: boolean
}
export type Porta = {
  gerado_em: string
  tempos: Record<CorRisco, number>
  etapas: Record<EtapaChave, { n: number; espera_max_min?: number | null; fora_alvo?: number; acima_6h?: number }>
  aguardando_por_cor: Record<CorRisco, { n: number; fora_alvo: number; alvo_min: number }>
  pacientes: Paciente[]
}

export function tempo(min: number | null | undefined): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Atraso (cor fora do alvo, observação acima de 6 h) é crítico; sem atraso, a maior fila é o gargalo. */
export function gargalo(p: Pick<Porta, 'etapas'>): { chave: EtapaChave; motivo: string; critico: boolean } | null {
  const e = p.etapas
  const atrasos: { chave: EtapaChave; n: number; motivo: string }[] = [
    { chave: 'aguardando_medico', n: e.aguardando_medico.fora_alvo ?? 0, motivo: 'fora do tempo-alvo da cor' },
    { chave: 'observacao', n: e.observacao.acima_6h ?? 0, motivo: 'acima de 6 horas' },
  ]
  const pior = atrasos.filter((a) => a.n > 0).sort((a, b) => b.n - a.n)[0]
  if (pior) return { chave: pior.chave, motivo: `${pior.n} ${pior.motivo}`, critico: true }
  const filas: EtapaChave[] = ['triagem', 'aguardando_medico', 'em_atendimento', 'medicacao_pendente', 'observacao']
  const maior = filas.map((c) => ({ c, n: e[c].n })).sort((a, b) => b.n - a.n)[0]
  return maior && maior.n > 0 ? { chave: maior.c, motivo: 'maior fila agora', critico: false } : null
}

