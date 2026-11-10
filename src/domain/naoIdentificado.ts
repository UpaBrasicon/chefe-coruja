// Paciente não identificado (lacuna 1 do Portão de 11/10/2026; decisão do RT
// em 10/11/2026, A em N1–N4). O servidor gera o nome provisório
// ("Não identificado <prontuário>"), guarda a marca identidade_desconhecida e
// os sinais ("SAMU, ocorrência 123; tatuagem no braço direito"). As filas
// mostram o selo com os sinais para separar dois desconhecidos. Toda regra
// também está no servidor (registrar_nao_identificado, identificar_paciente);
// aqui só o que a tela confere antes de enviar.

export const SINAIS_MAX = 500

export type PacienteMarcado = {
  identidade_desconhecida?: boolean | null
  sinais_identificacao?: string | null
} | null | undefined

export const ehNaoIdentificado = (p: PacienteMarcado): boolean => p?.identidade_desconhecida === true

/** Os sinais numa linha só (o texto pode ter vindo com quebras). */
export const sinaisDoSelo = (p: PacienteMarcado): string =>
  (p?.sinais_identificacao ?? '').replace(/\s+/g, ' ').trim()

/** Só as letras, sem acento e em minúsculas ("João 2" → "joao"). */
const letras = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

/**
 * Idade estimada digitada em anos ("40", "0,5" = seis meses). Vazio = null;
 * texto que não é número ou fora de 0 a 130 = NaN.
 */
export function lerIdadeEstimada(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  if (!/^\d{1,3}(\.\d+)?$/.test(t)) return Number.NaN
  const n = Number(t)
  return n >= 0 && n <= 130 ? n : Number.NaN
}

/** O que impede abrir a ficha do não identificado (as mesmas recusas do servidor). */
export function erroNaoIdentificado(c: { queixa: string; idade: string; sinais: string }): string | null {
  if (c.queixa.trim().length < 3) return 'Escreva a queixa referida ou o motivo da vinda.'
  if (Number.isNaN(lerIdadeEstimada(c.idade))) return 'Idade estimada: um número de anos, de 0 a 130.'
  if (c.sinais.trim().length > SINAIS_MAX) return `Sinais e quem trouxe: no máximo ${SINAIS_MAX} letras.`
  return null
}

/** O nome que identifica: 3 letras ou mais, e não o nome provisório. */
export function erroNomeIdentificado(nome: string): string | null {
  if (letras(nome).length < 3) return 'Escreva o nome do paciente (ao menos 3 letras).'
  if (letras(nome).startsWith('naoidentificado')) return 'Escreva o nome verdadeiro do paciente.'
  return null
}

export type Candidato = {
  id: string
  nome: string
  nome_social: string | null
  data_nascimento: string | null
  nome_mae: string | null
  prontuario: string | null
  ativo: boolean
  aberto: boolean
  regra: 'documento' | 'nome_nascimento'
}

export type ResultadoIdentificacao =
  | { identificado: true; paciente_id: string; prontuario: string | null; nome: string }
  | { identificado: false; motivo: 'documento' | 'nome_nascimento'; candidatos: Candidato[] }

/** Linha de apoio do candidato: nascimento, prontuário e mãe. */
export function rotuloCandidato(c: Pick<Candidato, 'data_nascimento' | 'prontuario' | 'nome_mae'>): string {
  return [
    c.data_nascimento ? `nasc. ${c.data_nascimento.split('-').reverse().join('/')}` : '',
    c.prontuario ? `pront. ${c.prontuario}` : '',
    c.nome_mae?.trim() ? `Mãe: ${c.nome_mae.trim()}` : '',
  ].filter(Boolean).join(' · ')
}

/** Motivo inicial do pedido de unificação (a pessoa pode reescrever). */
export const motivoUnificacao = (prontuario: string | null | undefined) =>
  `Paciente não identificado${prontuario ? ` (prontuário ${prontuario})` : ''} reconhecido como este cadastro.`
