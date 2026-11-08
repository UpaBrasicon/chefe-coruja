// Regulação na alta por transferência (achado P2-2 do A01; decisão do RT em
// 07/11/2026: A em S1 a S6; migration 20270307000006).
//
// S4: nas três altas por transferência (porta, observação e internação), se o
// paciente tem regulação que o leva para outra unidade (leito ou
// transferência), autorizada, agendada ou em trânsito, a tela oferece essa
// regulação; o destino vem dela e a alta grava o id (detalhes.regulacao_id).
// O texto livre fica só para a transferência sem regulação. Quem decide se a
// regulação vale é o servidor (é deste paciente e desta origem).

export type RegulacaoDoHistorico = {
  id: string
  numero: number
  status: string
  tipo: string
  destino: string | null
  outra_unidade: boolean
  chegou_origem_aberta?: boolean
}

const STATUS_DA_ALTA = ['autorizada', 'agendada', 'em_transito']

/** As regulações que a alta por transferência pode fechar: desta unidade, que levam o paciente, ainda em curso, com destino. */
export function regulacoesDaAlta<T extends RegulacaoDoHistorico>(itens: readonly T[]): T[] {
  return itens.filter((r) => !r.outra_unidade && (r.tipo === 'leito' || r.tipo === 'transferencia')
    && STATUS_DA_ALTA.includes(r.status) && !!r.destino?.trim())
}

/** "Regulação nº 94 · Hospital F5", com "já chegou ao destino" quando o destino registrou a chegada. */
export function rotuloRegulacaoAlta(r: RegulacaoDoHistorico): string {
  return `Regulação nº ${r.numero} · ${r.destino ?? ''}${r.chegou_origem_aberta ? ' (já chegou ao destino)' : ''}`
}

/** Detalhes da alta: o destino da regulação escolhida e o id; sem regulação, o destino escrito. */
export function detalhesDaTransferencia(regulacao: RegulacaoDoHistorico | null, destinoEscrito: string): { destino: string; regulacao_id?: string } {
  return regulacao ? { destino: (regulacao.destino ?? '').trim(), regulacao_id: regulacao.id } : { destino: destinoEscrito.trim() }
}
