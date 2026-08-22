import type { Papel, StatusLeito, TipoLeito, TipoSetor, TipoUnidade } from '@/types/database'

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  plantonista: 'Plantonista',
}

export const PAPEL_DESCRIPTION: Record<Papel, string> = {
  admin: 'Todas as unidades da organização (sem identidade de paciente)',
  gestor: 'Gestão da unidade — setores, leitos e equipe',
  plantonista: 'Acesso aos pacientes sob seu cuidado',
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
}

export const STATUS_LEITO_VARIANT: Record<StatusLeito, 'success' | 'destructive' | 'warning' | 'info'> = {
  livre: 'success',
  ocupado: 'destructive',
  bloqueado: 'warning',
  higienizacao: 'info',
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

/** Tela inicial de cada papel após o reagrupamento das abas. */
export const ROTA_INICIAL: Record<Papel, string> = {
  admin: '/painel',
  gestor: '/unidade',
  plantonista: '/plantonista',
}

export const ORDEM_PAPEL: Record<Papel, number> = {
  admin: 0,
  gestor: 1,
  plantonista: 2,
}
