// Solicitação de regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026).
// Rótulos e a conferência do formulário antes de enviar; o banco confere de
// novo (migration 20261107000001_regulacao_solicitacao.sql).

export type TipoSolicitacao = 'consulta' | 'exame' | 'leito' | 'transferencia'
export type Prioridade = 'emergencia' | 'urgencia' | 'prioritaria' | 'eletiva'
export type DestinoTipo = 'rede' | 'externo' | 'a_definir'
export type StatusRegulacao = 'enviada' | 'em_analise' | 'aceita' | 'recusada' | 'devolvida' | 'cancelada' | 'concluida'

export const TIPOS: Record<TipoSolicitacao, string> = {
  consulta: 'Consulta', exame: 'Exame', leito: 'Leito', transferencia: 'Transferência',
}

/** Ordem de gravidade: emergência primeiro. */
export const PRIORIDADES: Record<Prioridade, { rotulo: string; descricao: string; tom: 'critico' | 'atencao' | 'info' | 'neutro' }> = {
  emergencia: { rotulo: 'Emergência', descricao: 'Risco de vida imediato', tom: 'critico' },
  urgencia: { rotulo: 'Urgência', descricao: 'Precisa de resolução em horas', tom: 'atencao' },
  prioritaria: { rotulo: 'Prioritária', descricao: 'Não urgente, mas não pode esperar a fila comum', tom: 'info' },
  eletiva: { rotulo: 'Eletiva', descricao: 'Pode aguardar a fila', tom: 'neutro' },
}

export const TIPOS_LEITO: Record<string, string> = {
  enfermaria: 'Enfermaria', uti_adulto: 'UTI adulto', uti_pediatrica: 'UTI pediátrica', uti_neonatal: 'UTI neonatal',
  semi_intensiva: 'Semi-intensiva', isolamento: 'Isolamento', obstetrico: 'Obstétrico', psiquiatria: 'Psiquiatria', outro: 'Outro',
}

export const TRANSPORTES: Record<string, string> = {
  ambulancia_basica: 'Ambulância básica (USB)', ambulancia_avancada: 'Ambulância avançada (USA)', uti_movel: 'UTI móvel',
  transporte_sanitario: 'Transporte sanitário', aereo: 'Aéreo', meios_proprios: 'Meios próprios',
}

export const STATUS: Record<StatusRegulacao, string> = {
  enviada: 'Enviada', em_analise: 'Em análise', aceita: 'Aceita', recusada: 'Recusada',
  devolvida: 'Devolvida', cancelada: 'Cancelada', concluida: 'Concluída',
}

export type Formulario = {
  tipo: TipoSolicitacao
  especialidade: string
  procedimento: string
  tipo_leito: string
  transporte: string
  destino_tipo: DestinoTipo
  destino_unidade_id: string
  destino_externo: string
  prioridade: Prioridade | ''
  cid: string
  justificativa: string
}

export const FORMULARIO_VAZIO: Formulario = {
  tipo: 'leito', especialidade: '', procedimento: '', tipo_leito: '', transporte: '',
  destino_tipo: 'a_definir', destino_unidade_id: '', destino_externo: '', prioridade: '', cid: '', justificativa: '',
}

/** O que falta preencher, na ordem do formulário (vazio = pode enviar). */
export function faltasFormulario(f: Formulario): string[] {
  const faltas: string[] = []
  if (f.tipo === 'consulta' && !f.especialidade.trim()) faltas.push('especialidade')
  if (f.tipo === 'exame' && !f.procedimento.trim()) faltas.push('procedimento do SIGTAP')
  if (f.tipo === 'leito' && !f.tipo_leito) faltas.push('tipo de leito')
  if (f.tipo === 'transferencia' && !f.transporte) faltas.push('transporte')
  if (f.destino_tipo === 'rede' && !f.destino_unidade_id) faltas.push('unidade de destino')
  if (f.destino_tipo === 'externo' && f.destino_externo.trim().length < 3) faltas.push('serviço de destino')
  if (!f.prioridade) faltas.push('prioridade')
  if (!f.cid.trim()) faltas.push('CID-10')
  if (f.justificativa.trim().length < 20) faltas.push('justificativa (mínimo de 20 letras)')
  return faltas
}

/** Só os campos do tipo escolhido vão para o banco. */
export function dadosParaEnvio(f: Formulario, extra: { episodio_id?: string | null; internacao_id?: string | null; medico_assistente_id?: string | null }) {
  return {
    tipo: f.tipo,
    especialidade: f.tipo === 'consulta' ? f.especialidade.trim() : null,
    procedimento: f.tipo === 'exame' ? f.procedimento : null,
    tipo_leito: f.tipo === 'leito' ? f.tipo_leito : null,
    transporte: f.tipo === 'transferencia' ? f.transporte : null,
    destino_tipo: f.destino_tipo,
    destino_unidade_id: f.destino_tipo === 'rede' ? f.destino_unidade_id : null,
    destino_externo: f.destino_tipo === 'externo' ? f.destino_externo.trim() : null,
    prioridade: f.prioridade,
    cid: f.cid,
    justificativa: f.justificativa.trim(),
    episodio_id: extra.episodio_id ?? null,
    internacao_id: extra.internacao_id ?? null,
    medico_assistente_id: extra.medico_assistente_id ?? null,
  }
}

/** "Leito · UTI adulto", "Exame · 0206010079 TOMOGRAFIA…", "Consulta · Cardiologia". */
export function resumoPedido(s: { tipo: TipoSolicitacao; especialidade?: string | null; procedimento?: string | null;
  procedimento_nome?: string | null; tipo_leito?: string | null; transporte?: string | null }): string {
  const det = s.tipo === 'consulta' ? s.especialidade
    : s.tipo === 'exame' ? [s.procedimento, s.procedimento_nome].filter(Boolean).join(' ')
    : s.tipo === 'leito' ? (s.tipo_leito ? TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito : null)
    : s.transporte ? TRANSPORTES[s.transporte] ?? s.transporte : null
  return det ? `${TIPOS[s.tipo]} · ${det}` : TIPOS[s.tipo]
}
