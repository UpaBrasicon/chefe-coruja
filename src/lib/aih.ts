// AIH (Fase 3, tarefa 1): formatos das RPCs e as regras de tela do ciclo
// solicitada → aprovada | rejeitada → cancelada. O servidor confere tudo de
// novo (migration 20261102000002_aih_ciclo.sql).

export type StatusAih = 'solicitada' | 'aprovada' | 'rejeitada' | 'cancelada'

/** aihs_da_unidade: a fila do regulador (e a leitura do gestor). */
export type AihFila = {
  id: string; status: StatusAih; numero: string | null; competencia: string | null; competencia_sugerida: string
  paciente_id: string; paciente: string; sexo: string | null; nascimento: string | null; cns: string | null
  local: string | null; internacao_id: string | null; internado_em?: string | null; alta_em: string | null
  solicitada_por: string | null; solicitada_em: string; solicitada_por_mim: boolean
  decidida_por: string | null; decidida_em: string | null; motivo: string | null
  laudo_numero: string | null; laudo_versao: number
  carater: string | null; diagnostico: string | null; cid: string | null; cid_sec: string | null
  proc_cod: string | null; proc_desc: string | null; clinica: string | null
  /** Fase 3, tarefa 2: críticas gravadas na AIH, competência do SIGTAP e alertas de prazo. */
  criticas?: CriticaAih[]; sigtap_competencia?: string | null; alerta_72h?: boolean; alerta_competencia?: boolean
}

/** aihs_dos_laudos: a AIH de cada laudo, para o médico. */
export type AihDoLaudo = {
  laudo_id: string; aih_id: string; status: StatusAih; numero: string | null; competencia: string | null
  motivo: string | null; decidida_por: string | null; decidida_em: string | null; solicitada_por_mim: boolean
}

export type EventoAih = {
  evento: 'solicitada' | 'laudo_retificado' | 'aprovada' | 'rejeitada' | 'cancelada' | 'competencia_ajustada'
  status_antes: StatusAih | null; status_depois: StatusAih; numero: string | null; competencia: string | null
  motivo: string | null; por: string | null; em: string
}

export const STATUS_AIH: Record<StatusAih, { rotulo: string; variante: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  solicitada: { rotulo: 'solicitada', variante: 'warning' },
  aprovada: { rotulo: 'aprovada', variante: 'success' },
  rejeitada: { rotulo: 'rejeitada', variante: 'destructive' },
  cancelada: { rotulo: 'cancelada', variante: 'secondary' },
}

export const EVENTO_AIH: Record<EventoAih['evento'], string> = {
  solicitada: 'Solicitada (laudo emitido)',
  laudo_retificado: 'Laudo retificado',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  competencia_ajustada: 'Competência ajustada',
}

/** Só os dígitos do número digitado (aceita pontos, traços e espaços). */
export function numeroAih(texto: string): string {
  return texto.replace(/\D/g, '')
}

/** Número da AIH: 13 dígitos. O dígito verificador não é conferido (sem fonte oficial do algoritmo). */
export function numeroAihValido(texto: string): boolean {
  return /^\d{13}$/.test(numeroAih(texto))
}

/** Competência digitada como MM/AAAA ou AAAAMM → AAAAMM; inválida → null. */
export function lerCompetencia(texto: string): string | null {
  const t = texto.trim()
  const m = /^(\d{1,2})\/(\d{4})$/.exec(t)
  const valor = m ? `${m[2]}${m[1].padStart(2, '0')}` : t
  return /^\d{4}(0[1-9]|1[0-2])$/.test(valor) ? valor : null
}

/** AAAAMM → MM/AAAA, para a tela. */
export function competenciaNaTela(competencia: string | null): string {
  return competencia && /^\d{6}$/.test(competencia) ? `${competencia.slice(4)}/${competencia.slice(0, 4)}` : '—'
}

/** Mínimos de motivo (o servidor exige o mesmo). */
export const MINIMO_REJEICAO = 10
export const MINIMO_AJUSTE = 10
export const MINIMO_CANCELAMENTO = 15

/** Crítica da AIH (Fase 3, tarefa 2): a bloqueante impede emitir o laudo. */
export type CriticaAih = { codigo: string; campo: string; texto: string; bloqueante: boolean }

/** criticas_aih_da_unidade: o catálogo, com o padrão e o ajuste do gestor. */
export type ConfigCritica = {
  codigo: string; titulo: string; padrao: boolean; bloqueante: boolean
  ajuste: { motivo: string; por: string | null; em: string } | null
}

/** AAAAMM + n meses. */
export function somarMeses(competencia: string, n: number): string {
  const ano = Number(competencia.slice(0, 4))
  const mes = Number(competencia.slice(4)) - 1 + n
  const a = ano + Math.floor(mes / 12)
  const m = ((mes % 12) + 12) % 12 + 1
  return `${a}${String(m).padStart(2, '0')}`
}

/**
 * Competência além de 3 meses da alta (a AIH vale até 3 competências depois
 * da alta; pesquisa do NIR, Manual do SIH). Sem alta, não há alerta.
 */
export function competenciaForaDoPrazo(competencia: string | null, competenciaDaAlta: string | null): boolean {
  if (!competencia || !competenciaDaAlta) return false
  return competencia > somarMeses(competenciaDaAlta, 3)
}

/** Competência (AAAAMM) de uma data, no fuso de Brasília. */
export function competenciaDaData(iso: string | null): string | null {
  if (!iso) return null
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(iso))
  return p.replace('-', '')
}
