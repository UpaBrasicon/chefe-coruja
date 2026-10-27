// Livro do estoque da farmácia (telas do farmacêutico, ponto 5; decisões do RT
// de 27/10/2026): os tipos de movimento que o banco grava e os rótulos da tela.
// Migration 20270110000001_movimentos_estoque.sql.

export const TIPOS_MOVIMENTO = [
  ['saldo_inicial', 'Saldo inicial'], ['entrada', 'Entrada'], ['saida_prescricao', 'Saída por prescrição'],
  ['saida_avulsa', 'Saída avulsa'], ['devolucao', 'Devolução'], ['ajuste_inventario', 'Ajuste de inventário'],
] as const
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number][0]

export function rotuloMovimento(t: string): string {
  return TIPOS_MOVIMENTO.find(([k]) => k === t)?.[1] ?? t
}

/** Quantidade com sinal, como no extrato: "+10", "−3", "0". */
export function comSinal(q: number): string {
  if (q > 0) return `+${q.toLocaleString('pt-BR')}`
  if (q < 0) return `−${Math.abs(q).toLocaleString('pt-BR')}`
  return '0'
}

/** Uma linha do extrato (extrato_estoque). */
export type Movimento = {
  id: string; em: string; tipo: TipoMovimento; quantidade: number; saldo_depois: number
  documento: string | null; motivo: string | null; por: string | null; paciente: string | null
}

/** Períodos do Registro de dispensações (horas que o banco aceita: 1 a 720). */
export const PERIODOS_REGISTRO = [[24, '24 h'], [72, '72 h'], [168, '7 dias'], [720, '30 dias']] as const
