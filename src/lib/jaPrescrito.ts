// Aviso "Já prescrito" (achado P2-1 do A01; decisão do RT em 07/11/2026: A em
// M1 a M5; docs/teste-rede/CORRECOES-A01-DIAGNOSTICO.md).
//
// M4: ao escolher um medicamento que já tem item ativo na mesma via, a tela
// mostra o item que já existe antes de gravar, sem pedir justificativa. Quem
// decide se o item novo entra é o servidor (public.prescrever, migration
// 20270307000002): o "Agora" (ataque) convive com a manutenção; dois "Agora"
// só depois da dose feita; duas manutenções, não.

export type ItemAtivo = {
  medicamento_id: string | null
  descricao: string
  via: string | null
  posologia: string | null
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()

/** Itens ativos do mesmo medicamento e da mesma via (sem diferença de maiúsculas). */
export function jaPrescritos<T extends ItemAtivo>(itens: readonly T[], medicamentoId: string | null | undefined, via: string | null | undefined): T[] {
  if (!medicamentoId || !norm(via)) return []
  return itens.filter((i) => i.medicamento_id === medicamentoId && norm(i.via) === norm(via))
}

/** "Já prescrito: Sulfato de magnésio … EV, Agora" (um item) ou a lista separada por "; ". */
export function textoJaPrescrito(itens: readonly ItemAtivo[]): string | null {
  if (itens.length === 0) return null
  const partes = itens.map((i) => [i.descricao, norm(i.via)].filter(Boolean).join(' ') + (i.posologia?.trim() ? `, ${i.posologia.trim()}` : ''))
  return `Já prescrito: ${partes.join('; ')}`
}
