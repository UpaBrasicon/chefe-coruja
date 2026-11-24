// Plantão e Internação do médico (RT, 24/11/2026): o Plantão tem as abas Meu
// turno, Minha agenda e Prontuários; a Internação, item novo do menu, tem as
// abas Internação, Observação e Passômetro. A Evolução clínica saiu: a evolução
// mora no caderno do leito (Resumo e Evoluções). As rotas antigas redirecionam
// para a aba certa (App.tsx).

export const ROTA_PLANTAO = '/plantao'
export const ROTA_PLANTAO_AGENDA = '/plantao/agenda'
export const ROTA_PLANTAO_PRONTUARIOS = '/plantao/prontuarios'

/** Base da Internação do médico: o item do menu acende em tudo que começa aqui (o leito aberto inclusive). */
export const ROTA_INTERNACAO_MEDICO = '/plantao/internacao'
/** Lista de pacientes internados; com `?paciente=` abre o leito (ver `rotaDoLeito`). */
export const ROTA_INTERNADOS = '/plantao/internacao/pacientes'
export const ROTA_OBSERVACAO_MEDICO = '/plantao/internacao/observacao'
export const ROTA_PASSOMETRO = '/plantao/internacao/passometro'

export type AbaArea = {
  to: string
  rotulo: string
  /** A aba acende nesta rota. */
  casa: (pathname: string) => boolean
}

const so = (rota: string) => (p: string) => p === rota || p === `${rota}/`

export const ABAS_PLANTAO: AbaArea[] = [
  { to: ROTA_PLANTAO, rotulo: 'Meu turno', casa: so(ROTA_PLANTAO) },
  { to: ROTA_PLANTAO_AGENDA, rotulo: 'Minha agenda', casa: so(ROTA_PLANTAO_AGENDA) },
  { to: ROTA_PLANTAO_PRONTUARIOS, rotulo: 'Prontuários', casa: so(ROTA_PLANTAO_PRONTUARIOS) },
]

export const ABAS_INTERNACAO: AbaArea[] = [
  {
    to: ROTA_INTERNADOS,
    rotulo: 'Internação',
    casa: (p) => p.startsWith(ROTA_INTERNACAO_MEDICO) && !so(ROTA_OBSERVACAO_MEDICO)(p) && !so(ROTA_PASSOMETRO)(p),
  },
  { to: ROTA_OBSERVACAO_MEDICO, rotulo: 'Observação', casa: so(ROTA_OBSERVACAO_MEDICO) },
  { to: ROTA_PASSOMETRO, rotulo: 'Passômetro', casa: so(ROTA_PASSOMETRO) },
]

/**
 * Fora da UBS, as telas soltas que viraram aba: o endereço antigo leva à aba.
 * Na UBS não há Plantão nem Internação, e Minha agenda e Prontuários continuam
 * no menu como antes.
 */
export const ABA_NO_PLANTAO: Record<string, string> = {
  '/agenda': ROTA_PLANTAO_AGENDA,
  '/prontuarios': ROTA_PLANTAO_PRONTUARIOS,
}
