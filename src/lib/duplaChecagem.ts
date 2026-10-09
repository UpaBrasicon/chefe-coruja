// Dupla checagem de alta vigilância (Fase 2, tarefa 1): formatos das RPCs e a
// etapa em que um item está para o horário escolhido na checagem.

export type ConferenciaAberta = {
  horario: string | null; primeiro_por: string; primeiro_em: string
  segundo_por: string | null; segundo_em: string | null; sou_o_primeiro: boolean
}
export type EstadoDupla = { item_id: string; regra: string; abertas: ConferenciaAberta[] }

export type DuplaPendente = {
  item_id: string; horario: string | null; paciente: string; local: string | null
  descricao: string; dose: string | null; via: string | null; posologia: string | null; diluicao: string | null
  regra: string; primeiro_por: string; primeiro_em: string; sou_o_primeiro: boolean
}

export type ItemAltaVigilancia = {
  id: string; principio_ativo: string; apresentacao: string; concentracao: string | null
  cadastro: boolean; regra: string | null; exige: boolean
  ajuste: { exige: boolean; motivo: string; por: string | null; em: string } | null
}

export type EtapaDupla =
  | { etapa: 'nenhuma' }
  | { etapa: 'aguardando_segunda'; conferencia: ConferenciaAberta }
  | { etapa: 'pronta'; conferencia: ConferenciaAberta }

/** Conferência aberta do horário escolhido (sem horário = item não aprazado). A mais recente vale. */
export function etapaDupla(estado: EstadoDupla | undefined, horario: string | null): EtapaDupla {
  const doHorario = (estado?.abertas ?? []).filter((c) => (c.horario ?? null) === (horario || null))
  const c = doHorario[doHorario.length - 1]
  if (!c) return { etapa: 'nenhuma' }
  return c.segundo_por ? { etapa: 'pronta', conferencia: c } : { etapa: 'aguardando_segunda', conferencia: c }
}

/**
 * Dose única ("Agora", do Pronto-Socorro) já registrada como feita: não há
 * outra dose para conferir nem checar. Nova dose precisa de nova prescrição.
 */
export function doseUnicaFeita(posologia: string | null, seNecessario: boolean, ultimaSituacao: string | null): boolean {
  return !seNecessario && (posologia ?? '').trim().toLowerCase() === 'agora' && ultimaSituacao === 'feito'
}

/** De onde vem a exigência, para a farmácia conferir. */
export function origemAltaVigilancia(i: ItemAltaVigilancia): string {
  if (i.ajuste) return i.ajuste.exige ? 'Marcado pela unidade' : 'Desmarcado pela unidade'
  if (i.regra) return `ISMP Brasil 2019 — ${i.regra}`
  return i.cadastro ? 'Marcado no cadastro' : 'Sem marcação'
}
