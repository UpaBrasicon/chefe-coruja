// Alta vigilância (Fase 2, tarefa 1). Desde 09/10/2026 (decisão do RT) o
// controle é a LIBERAÇÃO DA FARMÁCIA: o farmacêutico valida o item da
// prescrição; sem liberação, a enfermagem administra com justificativa e a
// administração entra na lista da farmácia (migration 20261101000002). A
// dupla conferência de enfermagem saiu da tela.

export type ItemAltaVigilancia = {
  id: string; principio_ativo: string; apresentacao: string; concentracao: string | null
  cadastro: boolean; regra: string | null; exige: boolean
  ajuste: { exige: boolean; motivo: string; por: string | null; em: string } | null
}

/** liberacao_farmacia: só vem para os itens que exigem liberação. */
export type Liberacao = {
  item_id: string; regra: string; situacao: 'confere' | 'devolvido' | null
  motivo: string | null; por: string | null; em: string | null
}

/** administracoes_sem_liberacao: administradas com justificativa, para a farmácia conferir. */
export type SemLiberacao = {
  id: string; item_id: string; paciente: string; local: string | null
  descricao: string; dose: string | null; via: string | null; posologia: string | null
  horario: string | null; justificativa: string | null; administrado_por: string | null; administrado_em: string
}

export type EstadoLiberacao = 'nao_exige' | 'liberado' | 'devolvido' | 'aguardando'

export function estadoLiberacao(l: Liberacao | undefined): EstadoLiberacao {
  if (!l) return 'nao_exige'
  if (l.situacao === 'confere') return 'liberado'
  return l.situacao === 'devolvido' ? 'devolvido' : 'aguardando'
}

/** Mínimo da justificativa para administrar sem liberação (o servidor exige o mesmo). */
export const MINIMO_JUSTIFICATIVA = 10

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
