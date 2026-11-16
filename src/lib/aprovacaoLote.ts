// Aprovar em lote na Revisão Clínica (pedido do RT de 11/11/2026). Cada versão
// continua passando por decidir_versao_ferramenta, uma por vez, com o nome e o
// registro do responsável técnico e a auditoria de cada uma. A ordem importa:
// aprovar uma versão substitui a aprovada antes, então, na mesma ferramenta, a
// mais antiga vai primeiro e a mais nova fica aprovada no fim.

export type VersaoNaFila = { ferramenta_id: string; versao: string }

export const chaveVersao = (v: VersaoNaFila) => `${v.ferramenta_id}@${v.versao}`

/** Ordem de aprovação: por ferramenta e, dentro dela, da versão mais antiga para a mais nova. */
export function ordemDeAprovacao<T extends VersaoNaFila>(itens: T[]): T[] {
  return [...itens].sort((a, b) => a.ferramenta_id.localeCompare(b.ferramenta_id) || a.versao.localeCompare(b.versao))
}

/** Texto do resultado do lote: quantas foram aprovadas e quais falharam, com o motivo. */
export function resumoDoLote(total: number, falhas: { chave: string; erro: string }[]): string {
  const ok = total - falhas.length
  const base = ok === 1 ? '1 versão aprovada.' : `${ok} versões aprovadas.`
  if (falhas.length === 0) return base
  return `${base} ${falhas.length === 1 ? 'Uma não foi' : `${falhas.length} não foram`}: ${falhas.map((f) => `${f.chave} (${f.erro})`).join('; ')}.`
}
