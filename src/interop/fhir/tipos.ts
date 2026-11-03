// ─────────────────────────────────────────────────────────────────────────────
// Tipos de domínio consumidos pelos mappers FHIR (FASE 4A; revistos na 5C-5.2)
//
// Os mappers são PUROS: recebem estas entidades já carregadas (a carga fica em
// outra camada, fora do mapper) e devolvem recursos FHIR R4. Os códigos das
// terminologias da RNDS (modalidade, caráter, procedência, desfecho,
// financiamento) chegam prontos: quem carrega decide, o mapper só vira FHIR.
// ─────────────────────────────────────────────────────────────────────────────

/** Paciente (public.pacientes) — sem PII em log. */
export type EntidadePaciente = {
  id: string
  nome: string
  data_nascimento: string | null
  sexo: string | null
  cpf: string | null
  /** CNS, usado só na falta do CPF */
  cns: string | null
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
  /** código CBO (terminologia.cbo), 6 dígitos; null = lacuna, e o documento fica retido */
  cbo_codigo: string | null
  /** CNS, que vai no header Authorization do envio (não entra no documento) */
  cns?: string | null
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

/** Encontro (public.internacoes, ou o episódio da porta) */
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

/**
 * Caracterização do contato na RNDS (BRContatoAssistencial-1.0). Códigos dos
 * CodeSystems da RNDS, decididos por quem carrega.
 */
export type ContatoRnds = {
  /** BRModalidadeAssistencial (06 = urgência e emergência) */
  modalidade: string
  /** BRCaraterAtendimento (01 eletivo, 02 urgência) */
  carater: string
  /** BRProcedencia (09 demanda espontânea, 12 demanda referenciada) */
  procedencia: string
  /** BRMotivoDesfecho (01 alta clínica, 04 evasão, 09 transferência…) */
  desfecho: string
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

/** Procedimento SIGTAP registrado no atendimento */
export type EntidadeProcedimento = {
  id: string
  codigo_sigtap: string
  realizado_em: string
  quantidade: number
  /** BRFinanciamento (01 SUS federal, 07 SUS municipal…) */
  financiamento: string
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

/** Dados agregados do atendimento da porta para montar o Bundle RAC */
export type EntidadeAtendimentoRAC = {
  paciente: EntidadePaciente
  estabelecimento: EntidadeEstabelecimento
  encontro: EntidadeEncontro
  contato: ContatoRnds
  profissional: EntidadeProfissional
  condicoes: EntidadeCondicao[]
  procedimentos: EntidadeProcedimento[]
  observacoes: EntidadeObservacao[]
}

/** Dados agregados para o Bundle de Sumário de Alta */
export type EntidadeSumarioAlta = {
  paciente: EntidadePaciente
  estabelecimento: EntidadeEstabelecimento
  encontro: EntidadeEncontro
  contato: ContatoRnds
  profissional: EntidadeProfissional
  condicoes: EntidadeCondicao[]
  procedimentos: EntidadeProcedimento[]
  /** texto do resumo da evolução clínica (obrigatório no SA) */
  resumo_evolucao: string | null
}

/** O que só o envio sabe (5.3): a hora, a credencial e o documento anterior. */
export type EnvioRnds = {
  /** hora do envio (Bundle.timestamp e Composition.date) */
  agora: string
  /** identificador do solicitante dado pela RNDS na credencial; sem ele, o Bundle sai sem identifier */
  identificadorSolicitante?: string | null
  /** id RNDS do último documento enviado: o novo o substitui */
  idRndsAnterior?: string | null
  /** gera os urn:uuid das entradas (o teste passa um determinístico) */
  uuid?: () => string
}
