// Alteração versionada de item de prescrição (Fase 2, tarefa 6): formato da
// RPC alteracoes_de_itens e o resumo do que mudou (migration 20261031000004).

export type CamposItem = { dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean; observacao?: string | null }
export type Alteracao = {
  item_id: string; versao: number; motivo: string | null; alterado_em: string; alterado_por: string | null
  anterior: CamposItem & { horarios: string[] | null }
}

/** "dose 1 g → 2 g; frequência 12/12h → 24/24h". */
export function resumoMudanca(antes: CamposItem, agora: CamposItem): string {
  const partes: string[] = []
  const campo = (rotulo: string, a: string | null | undefined, b: string | null | undefined) => {
    if ((a ?? '') !== (b ?? '')) partes.push(`${rotulo} ${a || '—'} → ${b || '—'}`)
  }
  campo('dose', antes.dose, agora.dose)
  campo('via', antes.via, agora.via)
  campo('frequência', antes.posologia, agora.posologia)
  if (antes.se_necessario !== agora.se_necessario) partes.push(agora.se_necessario ? 'passou a "se necessário"' : 'deixou de ser "se necessário"')
  if (antes.observacao !== undefined && agora.observacao !== undefined) campo('observação', antes.observacao, agora.observacao)
  return partes.join('; ')
}
