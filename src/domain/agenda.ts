// Agenda de consultas da UBS (5A, tarefa 3; decisões F1 a F6 do RT em
// 02/11/2026; tela opção B). Tipos do retorno de agenda_dia e agenda_configuracao
// (migration 20270214000001_agenda_ubs.sql) e as regras da tela, que repetem as
// do servidor (Manual do PEC do e-SUS APS): cancelar só antes do horário, falta
// só depois e desfeita só no dia, chegada só no dia.

export type SituacaoAgendamento = 'agendado' | 'presente' | 'realizado' | 'nao_aguardou' | 'nao_compareceu' | 'cancelado'

export type Agendamento = {
  id: string
  tipo: 'consulta' | 'reserva'
  situacao: SituacaoAgendamento
  inicio: string
  fim: string
  paciente_id: string | null
  nome: string | null
  nome_social: string | null
  data_nascimento: string | null
  tipo_atendimento_aps: 'consulta_agendada' | 'consulta_programada' | null
  observacao: string | null
  motivo_reserva: MotivoReserva | null
  especifique: string | null
  episodio_id: string | null
}

export type HorarioAgenda = { inicio: string; fim: string; na_escala: boolean; agendamento: Agendamento | null }

export type ProfissionalDoDia = {
  perfil_id: string
  nome: string
  fechamento: { id: string; motivo: MotivoFechamento; especifique: string | null } | null
  horarios: HorarioAgenda[]
  fora_da_grade: Agendamento[]
}

export type AgendaDia = { data: string; profissionais: ProfissionalDoDia[] }

export type Periodo = 'manha' | 'tarde' | 'noite'
export type HorarioConfig = { dia: number; periodo: Periodo; inicio: string; fim: string; duracao: number }
export type FechamentoConfig = { id: string; inicio: string; fim: string; motivo: MotivoFechamento; especifique: string | null }
export type ProfissionalConfig = {
  perfil_id: string; nome: string; papel: 'plantonista' | 'enfermeiro'; horarios: HorarioConfig[]; fechamentos: FechamentoConfig[]
}

export type MotivoReserva = 'atendimento_externo' | 'atividade_coletiva' | 'reuniao' | 'outro'
export type MotivoFechamento = 'atestado' | 'curso' | 'ferias' | 'licenca' | 'reuniao' | 'outro'

// PEC, seção 5.2 (reserva) e 3.5.6 (fechamento)
export const MOTIVOS_RESERVA: { valor: MotivoReserva; rotulo: string }[] = [
  { valor: 'atendimento_externo', rotulo: 'Atendimento externo' },
  { valor: 'atividade_coletiva', rotulo: 'Atividade coletiva' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'outro', rotulo: 'Outro' },
]
export const MOTIVOS_FECHAMENTO: { valor: MotivoFechamento; rotulo: string }[] = [
  { valor: 'atestado', rotulo: 'Atestado' },
  { valor: 'curso', rotulo: 'Curso' },
  { valor: 'ferias', rotulo: 'Férias' },
  { valor: 'licenca', rotulo: 'Licença' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'outro', rotulo: 'Outro' },
]
export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'noite', rotulo: 'Noite' },
]
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const SITUACAO: Record<SituacaoAgendamento, { rotulo: string; tom: 'cinza' | 'ambar' | 'verde' | 'vermelho' | 'teal' }> = {
  agendado: { rotulo: 'Agendado', tom: 'cinza' },
  presente: { rotulo: 'Presente', tom: 'ambar' },
  realizado: { rotulo: 'Realizado', tom: 'verde' },
  nao_aguardou: { rotulo: 'Não aguardou', tom: 'vermelho' },
  nao_compareceu: { rotulo: 'Não compareceu', tom: 'vermelho' },
  cancelado: { rotulo: 'Cancelado', tom: 'cinza' },
}

export const rotuloMotivo = (lista: { valor: string; rotulo: string }[], v: string | null | undefined) =>
  lista.find((m) => m.valor === v)?.rotulo ?? v ?? ''

/** Uma linha da lista do dia (opção B): o agendamento e o profissional. */
export type LinhaDia = Agendamento & { perfil_id: string; profissional: string; na_escala: boolean }

/** Tudo o que está marcado no dia, em ordem de horário, com quem atende. */
export function linhasDoDia(dia: AgendaDia | undefined): LinhaDia[] {
  const linhas: LinhaDia[] = []
  for (const p of dia?.profissionais ?? []) {
    for (const h of p.horarios) {
      if (h.agendamento) linhas.push({ ...h.agendamento, perfil_id: p.perfil_id, profissional: p.nome, na_escala: h.na_escala })
    }
    for (const a of p.fora_da_grade) linhas.push({ ...a, perfil_id: p.perfil_id, profissional: p.nome, na_escala: true })
  }
  return linhas.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.profissional.localeCompare(b.profissional))
}

/** Horários livres para marcar: sem agendamento, no futuro, e o dia sem fechamento. */
export function horariosLivres(p: ProfissionalDoDia | undefined, agora: number): HorarioAgenda[] {
  if (!p || p.fechamento) return []
  return p.horarios.filter((h) => !h.agendamento && new Date(h.inicio).getTime() > agora)
}

export type AcaoAgenda = 'chegou' | 'falta' | 'desfazer_falta' | 'cancelar'

/** O que a linha permite agora (o servidor confere de novo). `hoje` é a data
 *  em America/Sao_Paulo (YYYY-MM-DD) e `diaDaLinha` a do agendamento. */
export function acoesDaLinha(l: Pick<Agendamento, 'tipo' | 'situacao' | 'inicio'>, agora: number, hoje: string, diaDaLinha: string): AcaoAgenda[] {
  const passou = new Date(l.inicio).getTime() <= agora
  if (l.situacao === 'nao_compareceu') return diaDaLinha === hoje ? ['desfazer_falta'] : []
  if (l.situacao !== 'agendado') return []
  if (l.tipo === 'reserva') return passou ? [] : ['cancelar']
  const acoes: AcaoAgenda[] = []
  if (diaDaLinha === hoje) acoes.push('chegou')
  acoes.push(passou ? 'falta' : 'cancelar')
  return acoes
}

/** Contagem dos filtros da lista do dia. */
export function contagem(linhas: LinhaDia[]) {
  const consultas = linhas.filter((l) => l.tipo === 'consulta')
  return {
    todos: linhas.length,
    agendados: consultas.filter((l) => l.situacao === 'agendado').length,
    presentes: consultas.filter((l) => l.situacao === 'presente').length,
    faltas: consultas.filter((l) => l.situacao === 'nao_compareceu').length,
  }
}

/** F6: atalho para marcar na agenda a partir da consulta ou da escuta. A agenda
 *  abre com o paciente escolhido e guarda o episódio de origem. */
export function linkMarcarNaAgenda(pacienteId: string, origemEpisodio: string, tipo: 'consulta_agendada' | 'consulta_programada' = 'consulta_agendada') {
  return `/agenda-consultas?${new URLSearchParams({ paciente: pacienteId, origem: origemEpisodio, consulta: tipo })}`
}
