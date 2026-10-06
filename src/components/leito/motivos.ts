// Motivos do bloqueio de leito (Fase 0, tarefa 7; decisão do responsável em
// 06/10/2026). O banco aceita os mesmos códigos em public.bloquear_leito.
export const MOTIVOS_BLOQUEIO = {
  manutencao: 'Manutenção',
  isolamento: 'Isolamento',
  falta_equipe: 'Falta de equipe',
  outro: 'Outro',
} as const
export type MotivoBloqueio = keyof typeof MOTIVOS_BLOQUEIO

/** Rótulo legível do motivo gravado ("isolamento: contato" → "Isolamento: contato"). */
export function rotuloMotivoBloqueio(motivo: string | null | undefined): string | null {
  if (!motivo) return null
  const [codigo, ...resto] = motivo.split(': ')
  const nome = MOTIVOS_BLOQUEIO[codigo as MotivoBloqueio]
  return nome ? [nome, ...resto].join(': ') : motivo
}
