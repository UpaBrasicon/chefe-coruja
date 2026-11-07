// Histórico encerrado no prontuário (Fase 1, tarefa 8): formato de
// historico_encerrado() e o nome por extenso dos desfechos (porta e alta).

import { dataIso } from './formato.ts'

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

// Item 7 dos achados guardados (A em H1 a H5, 06/11/2026): o cartão mostra os
// 5 mais recentes, um resumo por desfecho e o resto agrupado por ano.
export const INICIAIS_HISTORICO = 5

export type ResumoHistorico = { total: number; porDesfecho: { rotulo: string; quantidade: number }[]; ultimo: string | null }

/** Total, contagem por rótulo de desfecho (mais frequente primeiro) e a chegada mais recente. */
export function resumoHistorico(lista: AtendimentoEncerrado[]): ResumoHistorico {
  const conta = new Map<string, number>()
  for (const a of lista) {
    const r = rotuloDesfechoFinal(a.desfecho)
    conta.set(r, (conta.get(r) ?? 0) + 1)
  }
  const porDesfecho = [...conta].map(([rotulo, quantidade]) => ({ rotulo, quantidade }))
    .sort((x, y) => y.quantidade - x.quantidade || x.rotulo.localeCompare(y.rotulo, 'pt-BR'))
  const ultimo = lista.reduce<string | null>((m, a) => (m === null || a.chegada_em > m ? a.chegada_em : m), null)
  return { total: lista.length, porDesfecho, ultimo }
}

const anoBrasilia = (iso: string) => Number(dataIso(iso).slice(0, 4))

/** Agrupa por ano de chegada (horário de Brasília), do ano mais recente ao mais antigo, mantendo a ordem da lista. */
export function agruparPorAno(lista: AtendimentoEncerrado[]): { ano: number; itens: AtendimentoEncerrado[] }[] {
  const grupos = new Map<number, AtendimentoEncerrado[]>()
  for (const a of lista) {
    const ano = anoBrasilia(a.chegada_em)
    grupos.set(ano, [...(grupos.get(ano) ?? []), a])
  }
  return [...grupos].sort((x, y) => y[0] - x[0]).map(([ano, itens]) => ({ ano, itens }))
}
