// Histórico encerrado no prontuário (Fase 1, tarefa 8): formato de
// historico_encerrado() e o nome por extenso dos desfechos (porta e alta).

export type AtendimentoEncerrado = {
  id: string; chegada_em: string; encerrado_em: string | null; setor: string
  cor: string | null; desfecho: string | null; cid: string | null; medico: string | null
}
export type HistoricoEncerrado = {
  pode_abrir_detalhe: boolean
  detalhe_liberado_ate: string | null
  atendimentos: AtendimentoEncerrado[]
}

const DESFECHOS: Record<string, string> = {
  alta: 'Alta', alta_apos_medicacao: 'Alta após medicação', alta_a_pedido: 'Alta a pedido',
  transferencia: 'Transferência', evasao: 'Evasão', obito: 'Óbito', cancelado: 'Cancelado',
  observacao: 'Observação', internacao: 'Internação',
  // desfecho da observação/internação (status da internação)
  alta_melhorada: 'Alta', alta_pedido: 'Alta a pedido', alta_evasao: 'Evasão',
  transferencia_externa: 'Transferência', transferencia_interna: 'Transferência interna',
}

export const rotuloDesfechoFinal = (d: string | null | undefined) => (d ? DESFECHOS[d] ?? d.replace(/_/g, ' ') : 'Encerrado')

/** Motivo para abrir o detalhe: mínimo de 10 letras (igual ao banco). */
export const motivoValido = (m: string) => m.trim().length >= 10
