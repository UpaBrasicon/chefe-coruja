// Prioridade legal (CONTEXT.md): 60+ e 80+ vêm da idade, calculadas no
// servidor; as demais são informadas na ficha.
// Na fila da triagem ela ordena antes da chegada; na fila médica só desempata
// dentro da mesma classificação de risco.

export type PrioridadeLegal = 'idoso_60' | 'idoso_80' | 'gestante' | 'lactante_crianca_colo' | 'pcd' | 'tea'

export const PRIORIDADE_ROTULO: Record<PrioridadeLegal, string> = {
  idoso_80: '80 anos ou mais',
  idoso_60: '60 anos ou mais',
  gestante: 'Gestante',
  lactante_crianca_colo: 'Lactante ou com criança de colo',
  pcd: 'Pessoa com deficiência',
  tea: 'Pessoa com TEA',
}

/** As que a Recepção marca; 60+/80+ o servidor calcula pela idade. */
export const PRIORIDADES_INFORMADAS: PrioridadeLegal[] = ['gestante', 'lactante_crianca_colo', 'pcd', 'tea']

/** 0 = 80+, 1 = outra prioridade legal, 2 = nenhuma. */
export function pesoPrioridade(prioridades: readonly string[]): number {
  if (prioridades.includes('idoso_80')) return 0
  return prioridades.length > 0 ? 1 : 2
}

/** Fila da triagem: 80+ → demais prioridades legais → ordem de chegada. */
export function ordemTriagem<T extends { prioridades_legais: string[]; chegada_em: string }>(a: T, b: T): number {
  return pesoPrioridade(a.prioridades_legais) - pesoPrioridade(b.prioridades_legais) || a.chegada_em.localeCompare(b.chegada_em)
}

/** Rótulos para exibir, 80+ primeiro e sem repetir 60+ quando há 80+. */
export function rotulosPrioridade(prioridades: readonly string[]): string[] {
  const lista = prioridades.includes('idoso_80') ? prioridades.filter((p) => p !== 'idoso_60') : [...prioridades]
  return lista
    .sort((a, b) => (a === 'idoso_80' ? -1 : b === 'idoso_80' ? 1 : 0))
    .map((p) => PRIORIDADE_ROTULO[p as PrioridadeLegal] ?? p)
}
