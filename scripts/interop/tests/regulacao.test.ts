// ─────────────────────────────────────────────────────────────────────────────
// Documento MIRA da regulação (Fase 5C, tarefa 5, etapa 5.1)
//
// Confere o Bundle do BRRegulacaoAssistencial montado a partir do retrato da
// fila contra as regras dos perfis da RNDS (Simplifier, versão 1.0):
// cardinalidade, códigos fixos, identificadores e referências internas.
//
//   node --test scripts/interop/tests/regulacao.test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Appointment, Composition, Condition, ServiceRequest } from '@medplum/fhirtypes'

import { montarBundleRegulacao, type DadosMira } from '../../../src/interop/fhir/regulacao.ts'

const RNDS = 'http://www.saude.gov.br/fhir/r4'

const base: DadosMira = {
  solicitacao_id: '4f1c2b7e-0000-4000-8000-000000000001',
  numero: 31,
  status: 'pending',
  status_origem: 'enviada',
  evento_em: '2026-10-28T12:00:00Z',
  cnes_evento: '9999995',
  paciente_cpf: '52998224725',
  paciente_cns: null,
  modalidade: '04',
  carater: 'urgent',
  procedimento: '0303060190',
  cbo: null,
  cid: 'I219',
  cnes_solicitante: '9999995',
  cnes_executante: '9999994',
  cnes_regulador: '9999993',
  criada_em: '2026-10-28T11:50:00Z',
  autorizada_em: null,
  data_prevista: null,
  realizada_em: null,
}

function montar(d: Partial<DadosMira> = {}, envio: Partial<Parameters<typeof montarBundleRegulacao>[1]> = {}) {
  let n = 0
  const bundle = montarBundleRegulacao({ ...base, ...d }, {
    agora: '2026-10-28T12:05:00Z',
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    ...envio,
  })
  const doTipo = <T>(tipo: string) => bundle.entry!.find((e) => e.resource!.resourceType === tipo)?.resource as T
  return {
    bundle,
    composicao: doTipo<Composition>('Composition'),
    agendamento: doTipo<Appointment>('Appointment'),
    requisicao: doTipo<ServiceRequest>('ServiceRequest'),
    condicao: doTipo<Condition | undefined>('Condition'),
  }
}

describe('documento MIRA da regulação', () => {
  it('é um documento com Composition, agendamento, requisição e CID, ligados por urn:uuid', () => {
    const { bundle, composicao, agendamento, requisicao } = montar()
    assert.equal(bundle.type, 'document')
    assert.equal(bundle.timestamp, '2026-10-28T12:05:00Z')
    assert.deepEqual(bundle.entry!.map((e) => e.resource!.resourceType), ['Composition', 'Appointment', 'ServiceRequest', 'Condition'])
    const urls = new Set(bundle.entry!.map((e) => e.fullUrl))
    for (const u of urls) assert.match(u!, /^urn:uuid:[0-9a-f-]{36}$/)
    assert.ok(urls.has(composicao.section![0].entry![0].reference), 'a seção aponta para o agendamento')
    assert.equal(composicao.section![0].entry!.length, 1)
    assert.ok(urls.has(agendamento.basedOn![0].reference), 'o agendamento aponta para a requisição')
    assert.ok(urls.has(requisicao.reasonReference![0].reference), 'a requisição aponta para o CID')
  })

  it('Composition: tipo RA, modalidade, um evento com o status e quem mudou', () => {
    const { composicao } = montar()
    assert.deepEqual(composicao.meta!.profile, [`${RNDS}/StructureDefinition/BRRegulacaoAssistencial`])
    assert.equal(composicao.status, 'final')
    assert.equal(composicao.type.coding![0].code, 'RA')
    assert.equal(composicao.category![0].coding![0].code, '04')
    assert.deepEqual(composicao.subject, { identifier: { system: `${RNDS}/StructureDefinition/BRIndividuo-1.0`, value: '52998224725' } })
    assert.equal(composicao.author![0].identifier!.value, '9999995')
    assert.equal(composicao.event!.length, 1)
    const ev = composicao.event![0]
    assert.equal(ev.code![0].coding![0].system, `${RNDS}/CodeSystem/BRStatusRegulacaoAssistencial`)
    assert.equal(ev.code![0].coding![0].code, 'pending')
    assert.equal(ev.period!.end, '2026-10-28T12:00:00Z')
    assert.equal(ev.detail![0].identifier!.value, '9999995')
    assert.equal(ev.detail![0].identifier!.type!.coding![0].code, 'ESS')
    assert.equal(composicao.encounter, undefined, 'encounter é proibido')
    assert.equal(composicao.relatesTo, undefined, 'primeiro envio não substitui nada')
  })

  it('requisição: proposta, caráter, SIGTAP, CNES da origem e do destino', () => {
    const { requisicao } = montar()
    assert.equal(requisicao.intent, 'proposal')
    assert.equal(requisicao.status, 'active')
    assert.equal(requisicao.priority, 'urgent')
    assert.equal(requisicao.code!.coding![0].system, `${RNDS}/CodeSystem/BRTabelaSUS`)
    assert.equal(requisicao.code!.coding![0].code, '0303060190')
    assert.equal(requisicao.requester!.identifier!.value, '9999995')
    assert.equal(requisicao.performer![0].identifier!.value, '9999994')
    assert.equal(requisicao.authoredOn, '2026-10-28T11:50:00Z')
    assert.equal(requisicao.performerType, undefined, 'sem CBO, sem especialidade')
    assert.equal(requisicao.occurrenceDateTime, undefined)
  })

  it('pendente: agendamento proposto, sem data, com o regulador e o paciente', () => {
    const { agendamento } = montar()
    assert.equal(agendamento.status, 'proposed')
    assert.equal(agendamento.start, undefined)
    assert.equal(agendamento.supportingInformation![0].identifier!.value, '9999993')
    assert.equal(agendamento.participant.length, 1)
    assert.equal(agendamento.participant[0].type![0].coding![0].code, 'PCT')
    assert.equal(agendamento.participant[0].status, 'needs-action')
  })

  it('agendada: booked, com início e fim, autorização e CBO', () => {
    const { composicao, agendamento, requisicao } = montar({
      status: 'booked', status_origem: 'agendada', cnes_evento: '9999993', modalidade: '09', carater: 'routine', cbo: '225270',
      autorizada_em: '2026-10-28T13:00:00Z', data_prevista: '2026-11-03T09:00:00Z',
    })
    assert.equal(composicao.event![0].code![0].coding![0].code, 'booked')
    assert.equal(composicao.event![0].detail![0].identifier!.type, undefined, 'só o pending tipa o estabelecimento')
    assert.equal(composicao.category![0].coding![0].code, '09')
    assert.equal(agendamento.status, 'booked')
    assert.equal(agendamento.start, '2026-11-03T09:00:00Z')
    assert.equal(agendamento.end, '2026-11-03T09:00:00Z')
    assert.equal(agendamento.created, '2026-10-28T13:00:00Z')
    assert.equal(agendamento.specialty![0].coding![0].code, '225270')
    assert.equal(agendamento.appointmentType!.coding![0].code, 'routine')
    assert.equal(requisicao.performerType!.coding![0].system, `${RNDS}/CodeSystem/BRCBO`)
  })

  it('realizada: attended, requisição completa com a data', () => {
    const { agendamento, requisicao } = montar({ status: 'attended', realizada_em: '2026-10-29T08:00:00Z' })
    assert.equal(agendamento.status, 'fulfilled')
    assert.equal(agendamento.start, '2026-10-29T08:00:00Z')
    assert.equal(requisicao.status, 'completed')
    assert.equal(requisicao.occurrenceDateTime, '2026-10-29T08:00:00Z')
  })

  it('cancelada, falta, excluída e devolvida', () => {
    assert.equal(montar({ status: 'cancelled' }).requisicao.status, 'revoked')
    assert.equal(montar({ status: 'cancelled' }).agendamento.start, undefined)
    assert.equal(montar({ status: 'absence' }).agendamento.status, 'noshow')
    assert.equal(montar({ status: 'excluded' }).requisicao.status, 'entered-in-error')
    assert.equal(montar({ status: 'excluded' }).agendamento.status, 'excluded')
    assert.equal(montar({ status: 'returned-to-requester' }).requisicao.status, 'on-hold')
  })

  it('CID no perfil BRCID10Avaliado, código sem ponto; sem CID, sem Condition', () => {
    const { condicao } = montar()
    assert.equal(condicao!.code!.coding![0].system, `${RNDS}/CodeSystem/BRCID10`)
    assert.equal(condicao!.code!.coding![0].code, 'I219')
    assert.equal(condicao!.clinicalStatus!.coding![0].code, 'active')
    const sem = montar({ cid: null })
    assert.equal(sem.condicao, undefined)
    assert.equal(sem.requisicao.reasonReference, undefined)
  })

  it('CNS na falta do CPF; sem os dois, recusa', () => {
    assert.equal(montar({ paciente_cpf: null, paciente_cns: '898001000000003' }).composicao.subject!.identifier!.value, '898001000000003')
    assert.throws(() => montar({ paciente_cpf: null, paciente_cns: null }), /sem CPF e sem CNS/)
  })

  it('envio: identificador do solicitante e substituição do documento anterior', () => {
    const { bundle, composicao } = montar({}, { identificadorSolicitante: '12345', idRndsAnterior: 'abc-999' })
    assert.deepEqual(bundle.identifier, { system: `${RNDS}/NamingSystem/BRRNDS-12345`, value: base.solicitacao_id })
    assert.deepEqual(composicao.relatesTo, [{ code: 'replaces', targetReference: { reference: 'Composition/abc-999' } }])
    assert.equal(montar().bundle.identifier, undefined, 'sem credencial, sem identifier')
  })
})
