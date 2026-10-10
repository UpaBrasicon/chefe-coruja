// BPA individualizado (Fase 3, tarefa 3): formatos das RPCs e regras de tela.
// O servidor gera o arquivo no leiaute do BPA Magnético 05.00 e confere tudo
// de novo (migration 20261103000002_bpa_i.sql).
import { somarMeses } from './aih.ts'

export type OrigemBpa = 'atendimento' | 'classificacao' | 'medicacao' | 'registro'
export const ORIGEM_BPA: Record<OrigemBpa, string> = {
  atendimento: 'Atendimento médico',
  classificacao: 'Acolhimento com classificação de risco',
  medicacao: 'Administração de medicamentos',
  registro: 'Procedimento registrado',
}

/** Fonte automática (um código por unidade) ou a lista curta registrável. */
export type UsoProcedimento = 'atendimento_medico' | 'classificacao' | 'medicacao' | 'lista'
export const USO_PROCEDIMENTO: Record<UsoProcedimento, string> = {
  atendimento_medico: 'Atendimento médico na porta',
  classificacao: 'Acolhimento com classificação de risco',
  medicacao: 'Medicação administrada (Checagem)',
  lista: 'Lista de procedimentos registráveis',
}
/** Códigos da pesquisa no SIGTAP (09/2026) para cada fonte: só sugestão; a unidade confirma. */
export const SUGESTAO_SIGTAP: Partial<Record<UsoProcedimento, string>> = {
  atendimento_medico: '0301060096',
  classificacao: '0301060118',
  medicacao: '0301100012',
}

export type CriticaBpa = { codigo: string; texto: string }
export type GlobalBpa = CriticaBpa & { tipo: 'bloqueio' | 'aviso' }

export type LinhaConferencia = {
  origem: OrigemBpa; origem_id: string; paciente_id: string; episodio_id: string | null
  paciente: string; profissional: string | null; em: string
  procedimento: string | null; quantidade: number
  criticas: CriticaBpa[]; avisos: CriticaBpa[]
  /** BPA-I, BPA-C (o que não fecha no BPA-I) ou fora (crítica) — tarefa 4 */
  destino?: DestinoBpa; motivo_c?: string | null
}

export type DestinoBpa = 'bpa_i' | 'bpa_c' | 'fora'
export const DESTINO_BPA: Record<DestinoBpa, string> = { bpa_i: 'BPA-I', bpa_c: 'BPA-C', fora: 'fora do arquivo' }

export type FechamentoResumo = {
  id: string; situacao: 'fechada' | 'reaberta'; processamento: string
  linhas: number; linhas_bpa_c?: number; folhas: number; controle: number
  fechado_por: string | null; fechado_em: string
  reaberto_por: string | null; reaberto_em: string | null; motivo_reabertura: string | null
}

export type Conferencia = {
  competencia: string
  globais: GlobalBpa[]
  total: number; prontas: number; com_critica: number; com_aviso: number
  bpa_i?: number; bpa_c?: number
  por_origem: Partial<Record<OrigemBpa, number>>
  por_critica: Record<string, number>
  linhas: LinhaConferencia[]
  fechamento: FechamentoResumo | null
}

export type FechamentoBpa = FechamentoResumo & { competencia: string; excluidas: number }

export type ProcedimentoUnidade = {
  id: string; procedimento: string; uso: UsoProcedimento; nome: string | null; no_sigtap: boolean
  /** instrumentos do SIGTAP (01 BPA-C, 02 BPA-I...) e a marca da unidade — tarefa 4 */
  sempre_bpa_c?: boolean; instrumentos?: string[]
  definido_por: string | null; definido_em: string
}

export type ConfigBpa = {
  cnes: string | null
  orgao_origem: string | null; sigla: string | null; cnpj: string | null
  orgao_destino: string | null; destino: 'M' | 'E' | null
  carater_atendimento: string | null; ine: string | null
  atualizado_por: string | null; atualizado_em: string | null
  sigtap_competencia: string | null
  procedimentos: ProcedimentoUnidade[]
}

export type ProcedimentoRealizado = {
  id: string; procedimento: string; nome: string | null; quantidade: number; realizado_em: string
  episodio_id: string | null; via: 'quem_fez' | 'faturamento'
  profissional: string | null; registrado_por: string | null; meu: boolean
  cancelado_em: string | null; motivo_cancelamento: string | null; fechada: boolean
}

export type Registravel = { procedimento: string; nome: string }
export type AtendimentoParaFaturar = {
  episodio_id: string; paciente_id: string; paciente: string; chegada_em: string; medico: string | null; medico_id: string | null
}
export type ProfissionalParaFaturar = { id: string; nome: string; cbo: string | null; cns_ok: boolean; papeis: string[] }

export type EnderecoSus = {
  cep: string | null; municipio_ibge: string | null; municipio: string | null; uf: string | null
  tipo_logradouro: string | null; endereco: string | null; numero_endereco: string | null
  complemento: string | null; bairro: string | null; nacionalidade: string | null; etnia: string | null
  raca_cor: string | null; situacao_rua: boolean; sem_documento: boolean
}

/** Rótulo das críticas e avisos (códigos do servidor). */
export const CRITICA_BPA: Record<string, string> = {
  sem_codigo: 'Fonte sem código SIGTAP na unidade',
  procedimento_sigtap: 'Procedimento fora do SIGTAP carregado',
  cns_profissional: 'Profissional sem CNS válido',
  cbo: 'Profissional sem CBO',
  cbo_enfermagem: 'Medicação com CBO que não é de enfermagem',
  raca: 'Raça/cor ausente ou "sem informação"',
  etnia: 'Indígena sem etnia',
  sexo: 'Sexo ausente',
  nascimento: 'Nascimento ausente',
  documento: 'Paciente sem CNS nem CPF',
  endereco: 'Endereço incompleto',
  nacionalidade: 'Nacionalidade ausente',
  instrumento: 'Procedimento sem BPA no SIGTAP',
  cbo_nao_aceito: 'CBO não aceito pelo procedimento',
  quantidade_maxima: 'Quantidade acima do máximo',
}

/** Instrumentos do SIGTAP (tb_registro) que importam aqui. */
export const INSTRUMENTO_SIGTAP: Record<string, string> = { '01': 'BPA-C', '02': 'BPA-I', '03': 'AIH', '06': 'APAC' }

/** 0301060096 → 03.01.06.009-6 (como o SIGTAP mostra). */
export function codigoSigtapNaTela(codigo: string | null): string {
  if (!codigo || !/^\d{10}$/.test(codigo)) return codigo ?? '—'
  return `${codigo.slice(0, 2)}.${codigo.slice(2, 4)}.${codigo.slice(4, 6)}.${codigo.slice(6, 9)}-${codigo.slice(9)}`
}

/** Competências que o SIA ainda processa: a atual e as 3 anteriores (Portaria SAES 1.110/2021). */
export function competenciasNaJanela(atual: string): string[] {
  return [0, -1, -2, -3].map((n) => somarMeses(atual, n))
}

export function foraDaJanela(competencia: string, atual: string): boolean {
  return competencia < somarMeses(atual, -3)
}

/** Só dígitos; o banco também limpa. */
export function soDigitos(v: string): string {
  return v.replace(/\D/g, '')
}
