// Fichas de hoje na Nova ficha (RE1, revisão do perfil Recepção, RT
// 24/11/2026): a recepção responde ao acompanhante sem trocar de tela. Cada
// ficha aberta hoje na porta aparece com a etapa em que está. Só etapa, sem
// dado clínico: a recepção não lê prontuário.

export type EtapaFicha = {
  etapa: string
  atendimento_iniciado_em: string | null
  desfecho: string | null
}

/** espera: ainda na fila; andamento: com a equipe; alta: saiu de alta; saida: saiu de outro jeito */
export type TomEtapa = 'espera' | 'andamento' | 'alta' | 'saida'

const FIM: Record<string, string> = {
  alta: 'Alta', alta_apos_medicacao: 'Alta', alta_a_pedido: 'Alta a pedido',
  transferencia: 'Transferido', evasao: 'Evadiu', obito: 'Óbito', cancelado: 'Saiu da fila',
}

/** A etapa da ficha em palavras da recepção e o tom do ponto ao lado. */
export function rotuloEtapa(f: EtapaFicha, ubs = false): { rotulo: string; tom: TomEtapa } {
  switch (f.etapa) {
    case 'triagem':
      return { rotulo: ubs ? 'Aguardando a escuta' : 'Aguardando triagem', tom: 'espera' }
    case 'atendimento':
      return f.atendimento_iniciado_em
        ? { rotulo: 'Em atendimento', tom: 'andamento' }
        : { rotulo: ubs ? 'Aguardando consulta' : 'Aguardando médico', tom: 'espera' }
    case 'observacao':
      return { rotulo: 'Em observação', tom: 'andamento' }
    case 'internacao':
      return { rotulo: 'Internação', tom: 'andamento' }
    default:
      return { rotulo: (f.desfecho && FIM[f.desfecho]) || 'Encerrada', tom: f.desfecho?.startsWith('alta') ? 'alta' : 'saida' }
  }
}

/** Começo do dia em Brasília (sem horário de verão desde 2019), para filtrar por chegada. */
export const inicioDoDia = (hoje: string) => `${hoje}T00:00:00-03:00`
