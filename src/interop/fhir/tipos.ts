// ─────────────────────────────────────────────────────────────────────────────
// Tipos de domínio consumidos pelos mappers FHIR (FASE 4A)
//
// Os mappers são PUROS: recebem estas entidades já carregadas (a carga fica em
// outra camada, fora do mapper) e devolvem recursos FHIR R4.
// ─────────────────────────────────────────────────────────────────────────────

/** Paciente (public.pacientes) — sem PII em log. */
export type EntidadePaciente = {
  id: string
  nome: string
  data_nascimento: string | null
  sexo: string | null
  cpf: string | null
  telefone: string | null
  prontuario: string | null
}

/** Profissional (public.perfis + public.vinculos) */
export type EntidadeProfissional = {
  id: string
  nome_completo: string
  cpf: string | null
  crm: string | null
  uf_crm: string | null
  /** código CBO (terminologia.cbo) quando conhecido; null = lacuna */
  cbo_codigo: string | null
}

/** Estabelecimento (public.unidades) — CNES via terminologia */
export type EntidadeEstabelecimento = {
  id: string
  nome: string
  cnes: string | null
  municipio: string | null
  uf: string | null
  organizacao_id: string
}

/** Encontro (public.internacoes) — episódio de internação/atendimento */
export type EntidadeEncontro = {
  id: string
  paciente_id: string
  unidade_id: string
  tipo_internacao: string
  origem_admissao: string
  status: string
  leito_atual_id: string | null
  setor_atual_id: string | null
  data_admissao: string
  data_entrada_setor: string | null
  data_alta: string | null
  cid_principal: string | null
  motivo_alta: string | null
}

/** Condição (diagnóstico) — CID-10 vindo de terminologia.cid10 */
export type EntidadeCondicao = {
  id: string
  paciente_id: string
  encontro_id: string | null
  codigo_cid: string
  descricao: string | null
  categoria: string | null // ex.: 'principal' | 'secundaria'
  verificado: boolean
  data: string | null
}

/** Observação (public.observacao + conceito) — LOINC quando existir */
export type EntidadeObservacao = {
  id: string
  conceito_id: string
  conceito_nome: string
  conceito_tipo: string
  loinc_codigo: string | null // null = lacuna (não inventar)
  unidade_padrao: string | null
  valor_num: number | null
  valor_texto: string | null
  unidade: string | null
  ref_min: number | null
  ref_max: number | null
  flag: string | null
  aferido_em: string
  origem: string
  registrado_por: string | null
}

/** Medicação (public.prescricoes + prescricao_itens) */
export type EntidadeMedicacao = {
  id: string
  prescricao_id: string
  paciente_id: string
  medico_id: string
  descricao: string
  dose: string | null
  posologia: string | null
  status_prescricao: string
  prescrito_em: string
}

/** Dados agregados do atendimento para montar o Bundle RAC */
export type EntidadeAtendimentoRAC = {
  paciente: EntidadePaciente
  estabelecimento: EntidadeEstabelecimento
  encontro: EntidadeEncontro
  profissional: EntidadeProfissional
  condicoes: EntidadeCondicao[]
  observacoes: EntidadeObservacao[]
  medicacoes: EntidadeMedicacao[]
}

/** Dados agregados para o Bundle de Sumário de Alta */
export type EntidadeSumarioAlta = {
  paciente: EntidadePaciente
  estabelecimento: EntidadeEstabelecimento
  encontro: EntidadeEncontro
  profissional: EntidadeProfissional
  condicoes: EntidadeCondicao[]
  observacoes: EntidadeObservacao[]
  medicacoes: EntidadeMedicacao[]
  motivo_alta: string | null
  orientacoes: string | null // ex.: de documentos_clinicos (sumario_alta)
}
