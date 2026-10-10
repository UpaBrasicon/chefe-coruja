import type { Papel, StatusLeito, TipoLeito, TipoSetor, TipoUnidade } from '@/types/database'

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  plantonista: 'Plantonista',
  enfermeiro: 'Enfermeiro',
  tecnico_enfermagem: 'Técnico de Enfermagem',
  recepcao: 'Recepção',
  farmaceutico: 'Farmacêutico',
  telemedicina: 'Telemedicina',
  regulador: 'Médico regulador',
  faturamento: 'Faturamento',
}

export const PAPEL_DESCRIPTION: Record<Papel, string> = {
  admin: 'Todas as unidades da organização (sem identidade de paciente)',
  gestor: 'Gestão da unidade — setores, leitos e equipe',
  plantonista: 'Acesso aos pacientes sob seu cuidado',
  enfermeiro: 'Triagem, classificação de risco e cuidados de enfermagem',
  tecnico_enfermagem: 'Cuidados de enfermagem e sinais vitais',
  recepcao: 'Ficha de chegada e fila de atendimento',
  farmaceutico: 'Diluição padrão, validação de prescrição e faltas',
  telemedicina: 'Teleinterconsulta de apoio ao plantonista',
  regulador: 'Autoriza a AIH: aprova (número e competência) ou rejeita',
  faturamento: 'BPA: confere, fecha a competência e gera o arquivo do SUS',
}

export const TIPO_UNIDADE_LABEL: Record<TipoUnidade, string> = {
  hospital: 'Hospital',
  upa: 'UPA',
  clinica: 'Clínica',
}

export const TIPO_SETOR_LABEL: Record<TipoSetor, string> = {
  emergencia: 'Emergência',
  observacao: 'Observação',
  internacao: 'Internação',
  isolamento: 'Isolamento',
  uti: 'UTI',
  outro: 'Outro',
}

export const TIPO_LEITO_LABEL: Record<TipoLeito, string> = {
  clinico: 'Clínico',
  isolamento: 'Isolamento',
  estabilizacao: 'Estabilização',
  observacao: 'Observação',
}

export const STATUS_LEITO_LABEL: Record<StatusLeito, string> = {
  livre: 'Livre',
  ocupado: 'Ocupado',
  bloqueado: 'Bloqueado',
  higienizacao: 'Higienização',
  reservado: 'Reservado',
}

// Leito ocupado é o normal de uma enfermaria, não alarme: vermelho é estado
// crítico na gramática do Monitor de Cabeceira.
export const STATUS_LEITO_VARIANT: Record<StatusLeito, 'success' | 'secondary' | 'warning' | 'info'> = {
  livre: 'success',
  ocupado: 'secondary',
  bloqueado: 'warning',
  higienizacao: 'info',
  reservado: 'info',
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

/** Tela inicial de cada papel após o reagrupamento das abas. */
export const ROTA_INICIAL: Record<Papel, string> = {
  admin: '/painel',
  gestor: '/gestao',
  plantonista: '/plantonista',
  // As telas dos papéis novos chegam com as fases do plano; até lá, uma
  // página honesta em vez de um laço de redirecionamento.
  enfermeiro: '/triagem',
  // o técnico começa pela escala: Internação se só está em setor de
  // internação, senão o Pronto Socorro da enfermagem (InicioEnfermagem)
  tecnico_enfermagem: '/enfermagem',
  recepcao: '/recepcao',
  farmaceutico: '/farmacia',
  telemedicina: '/teleinterconsulta',
  regulador: '/aih',
  faturamento: '/faturamento',
}

export const ORDEM_PAPEL: Record<Papel, number> = {
  admin: 0,
  gestor: 1,
  plantonista: 2,
  telemedicina: 3,
  enfermeiro: 4,
  tecnico_enfermagem: 5,
  farmaceutico: 6,
  recepcao: 7,
  regulador: 8,
  faturamento: 9,
}

/** Papéis que só entram com plantão na escala agora (ADR 0003). */
export const PAPEIS_POR_ESCALA: readonly Papel[] = ['plantonista', 'enfermeiro', 'tecnico_enfermagem', 'recepcao', 'telemedicina', 'regulador']
