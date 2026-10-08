// Evasão (Fase 1, tarefa 6): o motivo de lista curta pedido ao registrar a
// evasão (decisão do RT, 07/10/2026) e os rótulos do indicador. O motivo vai
// para os detalhes do desfecho (motivo_evasao); a justificativa escrita continua.

export const MOTIVOS_EVASAO = [
  { valor: 'demora', rotulo: 'Demora no atendimento' },
  { valor: 'melhorou', rotulo: 'Melhorou' },
  { valor: 'outro_servico', rotulo: 'Foi a outro serviço' },
  { valor: 'sem_informacao', rotulo: 'Sem informação' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

export type MotivoEvasao = (typeof MOTIVOS_EVASAO)[number]['valor']

export const MOMENTOS_EVASAO = [
  { valor: 'antes_triagem', rotulo: 'Antes da triagem' },
  { valor: 'aguardando_medico', rotulo: 'Esperando o médico' },
  { valor: 'durante_atendimento', rotulo: 'Durante o atendimento' },
  { valor: 'observacao', rotulo: 'Na observação' },
] as const

export type MomentoEvasao = (typeof MOMENTOS_EVASAO)[number]['valor']

export const rotuloMotivo = (v: string) => MOTIVOS_EVASAO.find((m) => m.valor === v)?.rotulo ?? v
export const rotuloMomento = (v: string) => MOMENTOS_EVASAO.find((m) => m.valor === v)?.rotulo ?? v

/** Taxa em % com uma casa ("—" sem chegadas): 3 de 40 → "7,5%". */
export function taxa(n: number, chegadas: number): string {
  if (!chegadas) return '—'
  return `${((n / chegadas) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export type IndicadorEvasao = {
  de: string; ate: string; chegadas: number; evasoes: number; alta_a_pedido: number
  por_momento: Record<MomentoEvasao, number>
  por_motivo: Record<MotivoEvasao, number>
  por_cor: Record<'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'sem_classificacao', number>
  por_turno: Record<'manha' | 'tarde' | 'noite', number>
  por_dia: { dia: string; chegadas: number; evasoes: number; alta_a_pedido: number }[]
  casos: { nome: string; chegada_em: string; saiu_em: string | null; cor: string | null; momento: MomentoEvasao; motivo: MotivoEvasao; justificativa: string | null }[]
}
