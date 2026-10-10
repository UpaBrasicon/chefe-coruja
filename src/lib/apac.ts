// APAC (Fase 3, tarefa 5): formatos das RPCs e rótulos de tela. O servidor
// confere tudo de novo (migration 20261104000001_apac.sql). Os rótulos de tipo
// e caráter são os do leiaute do DATASUS (layout_Exportacao_APAC.pdf,
// 08/07/2026); códigos que o leiaute não lista são digitados.

export type StatusApac = 'solicitada' | 'autorizada' | 'rejeitada' | 'cancelada'
export const STATUS_APAC: Record<StatusApac, string> = {
  solicitada: 'Solicitada', autorizada: 'Autorizada', rejeitada: 'Rejeitada', cancelada: 'Cancelada',
}

/** apa_tipapac: 1 inicial, 2 continuidade, 3 única. */
export type TipoApac = '1' | '2' | '3'
export const TIPO_APAC: Record<TipoApac, string> = { '1': 'Inicial', '2': 'Continuidade', '3': 'Única' }

/** apa_carate (Portaria SAS 719/2007, citada no leiaute). */
export const CARATER_APAC: Record<string, string> = {
  '01': 'Eletivo',
  '02': 'Urgência',
  '03': 'Acidente no local de trabalho ou a serviço da empresa',
  '04': 'Acidente no trajeto para o trabalho',
  '05': 'Outros tipos de acidente de trânsito',
  '06': 'Outros tipos de lesões e envenenamentos por agentes químicos ou físicos',
}

export const EVENTO_APAC: Record<string, string> = {
  solicitada: 'Solicitada', autorizada: 'Autorizada', rejeitada: 'Rejeitada', cancelada: 'Cancelada',
  execucao_registrada: 'Execução registrada', execucao_cancelada: 'Execução cancelada',
}

export type CriticaApac = { codigo: string; texto: string; bloqueante?: boolean; campo?: string }
export type ProcedimentoExecutado = { procedimento: string; quantidade: number }
export type ExecucaoApac = {
  id: string; competencia: string; motivo_saida: string; tipo_atendimento: string; data_ocorrencia: string | null
  procedimentos: ProcedimentoExecutado[]; executante: string | null; registrado_em: string
}

export type Apac = {
  id: string; status: StatusApac; tipo: TipoApac; numero: string | null
  validade_inicio: string | null; validade_fim: string | null
  paciente_id: string; paciente: string; nascimento: string | null; sexo: string | null; cns: string | null
  procedimento: string; procedimento_nome: string | null
  cid_principal: string; cid_secundario: string | null; cid_causa: string | null
  carater: string; apac_anterior: string | null
  justificativa: { sinais?: string; exames?: string; justificativa?: string }
  solicitada_por: string | null; solicitada_em: string; solicitada_por_mim: boolean
  decidida_por: string | null; decidida_em: string | null; motivo: string | null
  criticas: CriticaApac[]; sigtap_competencia: string | null
  execucoes: ExecucaoApac[]
}

export type EventoApac = {
  evento: string; status_antes: string | null; status_depois: string
  detalhes: Record<string, unknown>; motivo: string | null; por: string | null; em: string
}

export type LinhaApac = { execucao_id: string; apac_id: string; numero: string; paciente: string; criticas: CriticaApac[] }
export type ConferenciaApac = {
  competencia: string
  globais: { tipo: 'bloqueio' | 'aviso'; codigo: string; texto: string }[]
  linhas: LinhaApac[]
  fechamento: {
    id: string; situacao: 'fechada' | 'reaberta'; apacs: number; controle: number
    fechado_em: string; fechado_por: string | null; reaberto_em: string | null; motivo_reabertura: string | null
  } | null
}
export type FechamentoApac = {
  id: string; competencia: string; situacao: 'fechada' | 'reaberta'; apacs: number; controle: number; excluidas: number
  fechado_por: string | null; fechado_em: string; reaberto_em: string | null; motivo_reabertura: string | null
}

/** Número da APAC: 12 de sequência + 1 dígito verificador; aceita separadores. */
export function numeroApac(v: string): string {
  return v.replace(/\D/g, '')
}
export function numeroApacValido(v: string): boolean {
  return /^\d{13}$/.test(numeroApac(v))
}

/** Competências (AAAAMM) cobertas pela validade, para a execução. */
export function competenciasDaValidade(inicio: string | null, fim: string | null): string[] {
  if (!inicio || !fim) return []
  const ini = inicio.slice(0, 7).replace('-', '')
  const f = fim.slice(0, 7).replace('-', '')
  const r: string[] = []
  let ano = Number(ini.slice(0, 4)), mes = Number(ini.slice(4))
  while (`${ano}${String(mes).padStart(2, '0')}` <= f && r.length < 24) {
    r.push(`${ano}${String(mes).padStart(2, '0')}`)
    mes += 1
    if (mes === 13) { mes = 1; ano += 1 }
  }
  return r
}
