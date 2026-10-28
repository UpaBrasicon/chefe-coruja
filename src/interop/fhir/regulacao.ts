// ─────────────────────────────────────────────────────────────────────────────
// Regulação assistencial (MIRA) — documento RNDS, PURO (sem I/O, sem banco)
//
// Monta o Bundle do BRRegulacaoAssistencial 1.0 a partir do retrato que a fila
// grava em interop_outbox.payload.mira (migration 20270204000001). O retrato é
// a fonte: o banco já decidiu o status MIRA, a modalidade (04/09), o caráter e
// os CNES; aqui só vira FHIR.
//
// Perfis lidos em 28/10/2026 na API FHIR do projeto da RNDS no Simplifier
// (BRRegulacaoAssistencial, BRRequisicaoRegulacaoAssistencial e
// BRAgendamentoRegulacaoAssistencial, versão 1.0, de 04/2023):
// produto/docs/pesquisa/rnds-simplifier-regulacao/. Decisão do RT: base da
// 5.1, conferida contra o modelo oficial antes da homologação (5.5). O que é
// inferência está marcado "conferir".
//
// O que só o envio sabe (5.3) entra por `envio`: a hora, o identificador do
// solicitante na RNDS e o id RNDS do documento anterior, que este substitui.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Appointment,
  Bundle,
  Composition,
  CompositionEvent,
  Condition,
  Identifier,
  ServiceRequest,
} from '@medplum/fhirtypes'

const RNDS = 'http://www.saude.gov.br/fhir/r4'
export const PERFIL_REGULACAO = `${RNDS}/StructureDefinition/BRRegulacaoAssistencial`
const PERFIL_REQUISICAO = `${RNDS}/StructureDefinition/BRRequisicaoRegulacaoAssistencial`
const PERFIL_AGENDAMENTO = `${RNDS}/StructureDefinition/BRAgendamentoRegulacaoAssistencial`
const PERFIL_CID = `${RNDS}/StructureDefinition/BRCID10Avaliado-1.0`
const SISTEMA_INDIVIDUO = `${RNDS}/StructureDefinition/BRIndividuo-1.0`
const SISTEMA_ESTABELECIMENTO = `${RNDS}/StructureDefinition/BREstabelecimentoSaude-1.0`

export type StatusMira = 'pending' | 'returned-to-requester' | 'booked' | 'attended' | 'cancelled' | 'absence' | 'excluded'

/** Retrato gravado pela fila (private.rnds_mira_regulacao). */
export type DadosMira = {
  solicitacao_id: string
  numero: number
  status: StatusMira
  status_origem: string
  evento_em: string
  cnes_evento: string
  paciente_cpf: string | null
  paciente_cns: string | null
  modalidade: '04' | '09'
  carater: 'routine' | 'urgent'
  procedimento: string
  cbo: string | null
  cid: string | null
  cnes_solicitante: string
  cnes_executante: string | null
  cnes_regulador: string | null
  criada_em: string
  autorizada_em: string | null
  data_prevista: string | null
  realizada_em: string | null
}

export type EnvioMira = {
  /** hora do envio (Bundle.timestamp e Composition.date) */
  agora: string
  /** identificador do solicitante dado pela RNDS na credencial; sem ele, o Bundle sai sem identifier */
  identificadorSolicitante?: string | null
  /** id RNDS do último documento enviado desta solicitação: o novo o substitui */
  idRndsAnterior?: string | null
  /** gera os urn:uuid das entradas (o teste passa um determinístico) */
  uuid?: () => string
}

// status da requisição (request-status) e do agendamento (appointmentstatus +
// BRStatusAgendamentoRegulacaoAssistencial) para cada status MIRA — conferir
const STATUS_REQUISICAO: Record<StatusMira, ServiceRequest['status']> = {
  pending: 'active',
  'returned-to-requester': 'on-hold',
  booked: 'active',
  attended: 'completed',
  cancelled: 'revoked',
  absence: 'revoked',
  excluded: 'entered-in-error',
}
const STATUS_AGENDAMENTO: Record<StatusMira, string> = {
  pending: 'proposed',
  'returned-to-requester': 'returned-to-requester',
  booked: 'booked',
  attended: 'fulfilled',
  cancelled: 'cancelled',
  absence: 'noshow',
  excluded: 'excluded',
}
const STATUS_PARTICIPANTE: Record<StatusMira, 'accepted' | 'declined' | 'needs-action'> = {
  pending: 'needs-action',
  'returned-to-requester': 'needs-action',
  booked: 'accepted',
  attended: 'accepted',
  cancelled: 'declined',
  absence: 'declined',
  excluded: 'declined',
}

const estabelecimento = (cnes: string): { identifier: Identifier } => ({
  identifier: { system: SISTEMA_ESTABELECIMENTO, value: cnes },
})

/** CPF primeiro, CNS na falta (decisão de 10/10/2026). */
export function identificadorPaciente(d: DadosMira): Identifier {
  const valor = d.paciente_cpf ?? d.paciente_cns
  if (!valor) throw new Error(`regulação ${d.numero}: paciente sem CPF e sem CNS não vai à RNDS`)
  return { system: SISTEMA_INDIVIDUO, value: valor }
}

function uuidPadrao(): string {
  return crypto.randomUUID()
}

export function montarBundleRegulacao(d: DadosMira, envio: EnvioMira): Bundle {
  const uuid = envio.uuid ?? uuidPadrao
  const paciente = { identifier: identificadorPaciente(d) }
  const modalidade = { coding: [{ system: `${RNDS}/CodeSystem/BRModalidadeAssistencial`, code: d.modalidade }] }
  const procedimento = { coding: [{ system: `${RNDS}/CodeSystem/BRTabelaSUS`, code: d.procedimento }] }
  const cbo = d.cbo ? { coding: [{ system: `${RNDS}/CodeSystem/BRCBO`, code: d.cbo }] } : undefined

  const urlComposicao = `urn:uuid:${uuid()}`
  const urlRequisicao = `urn:uuid:${uuid()}`
  const urlAgendamento = `urn:uuid:${uuid()}`
  const urlCid = d.cid ? `urn:uuid:${uuid()}` : null

  const condicao: Condition | null = d.cid
    ? {
        resourceType: 'Condition',
        meta: { profile: [PERFIL_CID] },
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        code: { coding: [{ system: `${RNDS}/CodeSystem/BRCID10`, code: d.cid }] },
        subject: paciente,
      }
    : null

  const requisicao: ServiceRequest = {
    resourceType: 'ServiceRequest',
    meta: { profile: [PERFIL_REQUISICAO] },
    status: STATUS_REQUISICAO[d.status],
    intent: 'proposal',
    category: [modalidade],
    priority: d.carater,
    code: procedimento,
    subject: paciente,
    authoredOn: d.criada_em,
    requester: estabelecimento(d.cnes_solicitante),
  }
  if (cbo) requisicao.performerType = cbo
  if (d.cnes_executante) requisicao.performer = [estabelecimento(d.cnes_executante)]
  if (d.status === 'attended' && d.realizada_em) requisicao.occurrenceDateTime = d.realizada_em
  if (urlCid) requisicao.reasonReference = [{ reference: urlCid }]

  const agendamento: Appointment = {
    resourceType: 'Appointment',
    meta: { profile: [PERFIL_AGENDAMENTO] },
    status: STATUS_AGENDAMENTO[d.status] as Appointment['status'],
    serviceCategory: [modalidade],
    serviceType: [procedimento],
    appointmentType: { coding: [{ system: 'http://hl7.org/fhir/request-priority', code: d.carater }] },
    basedOn: [{ reference: urlRequisicao }],
    participant: [
      {
        type: [{ coding: [{ system: `${RNDS}/CodeSystem/BRTipoParticipante`, code: 'PCT' }] }],
        actor: paciente,
        status: STATUS_PARTICIPANTE[d.status],
      },
    ],
  }
  if (cbo) agendamento.specialty = [cbo]
  if (urlCid) agendamento.reasonReference = [{ reference: urlCid }]
  if (d.cnes_regulador) agendamento.supportingInformation = [estabelecimento(d.cnes_regulador)]
  if (d.autorizada_em) agendamento.created = d.autorizada_em
  // FHIR app-3: fora de proposed/cancelled o agendamento precisa de início e fim.
  // Sem a data prevista, vale a hora do evento — conferir
  if (!['proposed', 'cancelled'].includes(agendamento.status)) {
    const inicio = d.data_prevista ?? d.realizada_em ?? d.evento_em
    agendamento.start = inicio
    agendamento.end = inicio
  }

  const detalhe = estabelecimento(d.cnes_evento)
  if (d.status === 'pending') {
    // só o slice pending tipa o estabelecimento: ESS, o solicitante — conferir
    detalhe.identifier.type = { coding: [{ system: `${RNDS}/CodeSystem/BRTipoParticipante`, code: 'ESS' }] }
  }
  const evento: CompositionEvent = {
    code: [{ coding: [{ system: `${RNDS}/CodeSystem/BRStatusRegulacaoAssistencial`, code: d.status }] }],
    period: { end: d.evento_em },
    detail: [detalhe],
  }

  const composicao: Composition = {
    resourceType: 'Composition',
    meta: { profile: [PERFIL_REGULACAO] },
    status: 'final',
    type: { coding: [{ system: `${RNDS}/CodeSystem/BRTipoDocumento`, code: 'RA' }] },
    category: [modalidade],
    subject: paciente,
    date: envio.agora,
    // autor: a unidade que pede, dona da credencial — conferir
    author: [estabelecimento(d.cnes_solicitante)],
    title: 'Regulação Assistencial',
    event: [evento],
    section: [{ entry: [{ reference: urlAgendamento }] }],
  }
  if (envio.idRndsAnterior) {
    composicao.relatesTo = [{ code: 'replaces', targetReference: { reference: `Composition/${envio.idRndsAnterior}` } }]
  }

  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'document',
    timestamp: envio.agora,
    entry: [
      { fullUrl: urlComposicao, resource: composicao },
      { fullUrl: urlAgendamento, resource: agendamento },
      { fullUrl: urlRequisicao, resource: requisicao },
      ...(condicao && urlCid ? [{ fullUrl: urlCid, resource: condicao }] : []),
    ],
  }
  if (envio.identificadorSolicitante) {
    // o mesmo id local em todas as versões: a RNDS liga a substituição por ele
    bundle.identifier = { system: `${RNDS}/NamingSystem/BRRNDS-${envio.identificadorSolicitante}`, value: d.solicitacao_id }
  }
  return bundle
}
