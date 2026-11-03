// ─────────────────────────────────────────────────────────────────────────────
// Documentos RAC e Sumário de Alta (FASE 4A; revistos na 5C-5.2)
//
// 1. Snapshots versionados (scripts/interop/__snapshots__/), os mesmos que o
//    validador local oficial confere (npm run fhir:validar).
// 2. Regras dos perfis que o validador cobra, para o CI pegar sem o Docker.
// 3. O que falta não é inventado: o documento fica retido com o motivo.
//
// Uso:
//   node --test scripts/interop/tests/bundles.test.ts
//   node scripts/interop/tests/bundles.test.ts --atualizar
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Bundle, Composition, Encounter, Observation, Resource } from '@medplum/fhirtypes'

import { montarBundleRAC, montarBundleSumarioAlta } from '../../../src/interop/fhir/mappers.ts'
import {
  fixtureAltaParaCasa,
  fixtureComEvasao,
  fixtureSumarioAltaParaCasa,
  fixtureSumarioAltaTransferencia,
} from '../../../src/interop/fhir/__fixtures__.ts'
import type { EnvioRnds } from '../../../src/interop/fhir/tipos.ts'

const ATUALIZAR = process.argv.includes('--atualizar')
const SNAP_DIR = resolve('scripts/interop/__snapshots__')
const RNDS = 'http://www.saude.gov.br/fhir/r4'

/**
 * Envio determinístico: a hora fixa, os urn:uuid em sequência e um
 * identificador de solicitante de teste (o documento exige um: bdl-9).
 */
function envio(extra: Partial<EnvioRnds> = {}): EnvioRnds {
  let n = 0
  return {
    agora: '2026-08-10T16:00:00Z',
    identificadorSolicitante: '99999',
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    ...extra,
  }
}

const CASOS: { nome: string; gerar: () => Bundle }[] = [
  { nome: 'rac-alta-para-casa.json', gerar: () => montarBundleRAC(fixtureAltaParaCasa(), envio()) },
  { nome: 'rac-com-evasao.json', gerar: () => montarBundleRAC(fixtureComEvasao(), envio()) },
  { nome: 'sumario-alta-para-casa.json', gerar: () => montarBundleSumarioAlta(fixtureSumarioAltaParaCasa(), envio()) },
  { nome: 'sumario-alta-transferencia.json', gerar: () => montarBundleSumarioAlta(fixtureSumarioAltaTransferencia(), envio()) },
]

const serializar = (bundle: unknown) => JSON.stringify(bundle, null, 2) + '\n'
const recursos = (b: Bundle) => b.entry!.map((e) => e.resource as Resource)
const doTipo = <T extends Resource>(b: Bundle, tipo: string) => recursos(b).filter((r) => r.resourceType === tipo) as T[]

describe('snapshots dos documentos', () => {
  for (const caso of CASOS) {
    it(caso.nome, () => {
      mkdirSync(SNAP_DIR, { recursive: true })
      const caminho = resolve(SNAP_DIR, caso.nome)
      const gerado = serializar(caso.gerar())
      if (ATUALIZAR || !existsSync(caminho)) {
        writeFileSync(caminho, gerado)
        return
      }
      // o checkout no Windows pode trazer CRLF; o conteúdo é o que conta
      assert.equal(readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n'), gerado, `${caso.nome} diverge: rode com --atualizar e confira o diff`)
    })
  }
})

describe('regras dos perfis', () => {
  it('Bundle: documento com a hora do envio, urn:uuid e meta.profile em tudo', () => {
    for (const caso of CASOS) {
      const b = caso.gerar()
      assert.equal(b.type, 'document')
      assert.equal(b.timestamp, '2026-08-10T16:00:00Z')
      assert.equal(b.entry![0].resource!.resourceType, 'Composition')
      for (const e of b.entry!) {
        assert.match(e.fullUrl!, /^urn:uuid:[0-9a-f-]{36}$/)
        assert.ok(e.resource!.meta?.profile?.[0]?.startsWith(`${RNDS}/StructureDefinition/`), `${caso.nome}: ${e.resource!.resourceType} sem perfil`)
      }
      const tipos = recursos(b).map((r) => r.resourceType)
      for (const proibido of ['Patient', 'Organization', 'Practitioner', 'MedicationRequest']) assert.ok(!tipos.includes(proibido as never), `${caso.nome}: ${proibido} não é entrada`)
    }
  })

  it('Composition: por identifier, categoria, sem encounter, uma entrada por seção apontando para o Bundle', () => {
    for (const caso of CASOS) {
      const b = caso.gerar()
      const c = b.entry![0].resource as Composition
      assert.deepEqual(c.subject, { identifier: { system: `${RNDS}/StructureDefinition/BRIndividuo-1.0`, value: '52998224725' } })
      assert.deepEqual(c.author, [{ identifier: { system: `${RNDS}/StructureDefinition/BREstabelecimentoSaude-1.0`, value: '9999995' } }])
      assert.equal(c.category![0].coding![0].code, '06')
      assert.equal(c.encounter, undefined)
      const urls = new Set(b.entry!.map((e) => e.fullUrl))
      for (const s of c.section!) {
        assert.equal(s.entry!.length, 1)
        assert.ok(urls.has(s.entry![0].reference), 'a seção aponta para uma entrada')
        assert.equal(s.emptyReason, undefined)
        assert.equal(s.text, undefined)
      }
    }
  })

  it('seções sem título (a base BRConjuntoMinimoDados-1.1 proíbe)', () => {
    for (const caso of CASOS) {
      const c = caso.gerar().entry![0].resource as Composition
      assert.ok(c.section!.every((s) => s.title === undefined), caso.nome)
    }
  })

  it('Encounter: modalidade, caráter, procedência, desfecho, CBO e procedimento com financiamento', () => {
    const b = montarBundleRAC(fixtureComEvasao(), envio())
    const [enc] = doTipo<Encounter>(b, 'Encounter')
    assert.equal(enc.status, 'finished')
    assert.equal(enc.class.code, '06')
    assert.equal(enc.priority!.coding![0].code, '02')
    assert.equal(enc.hospitalization!.admitSource!.coding![0].code, '09')
    assert.equal(enc.hospitalization!.dischargeDisposition!.coding![0].code, '04')
    assert.equal(enc.participant![0].extension![0].valueCodeableConcept!.coding![0].code, '225125')
    assert.equal(enc.participant![0].individual!.identifier!.system, `${RNDS}/StructureDefinition/BRProfissional-1.0`)
    const procedimento = enc.diagnosis!.find((d) => d.condition.extension)!
    assert.equal(procedimento.condition.extension![0].valueCodeableConcept!.coding![0].code, '01')
    assert.equal(enc.type, undefined, 'Encounter.type é proibido')
    assert.equal(enc.reasonCode, undefined, 'Encounter.reasonCode é proibido')
  })

  it('códigos sem display, CID sem ponto, LOINC no system da RNDS', () => {
    const json = serializar(montarBundleRAC(fixtureAltaParaCasa(), envio()))
    assert.ok(!json.includes('"display"'))
    assert.ok(!json.includes('http://loinc.org'))
    assert.ok(json.includes('"https://loinc.org/"'))
  })

  it('só as medidas do BRTipoObservacao-1.0 entram (frequência cardíaca e temperatura ficam fora)', () => {
    const obs = doTipo<Observation>(montarBundleRAC(fixtureAltaParaCasa(), envio()), 'Observation')
    assert.deepEqual(obs.map((o) => o.code.coding![0].code), ['8480-6', '8462-4'])
    assert.equal(obs[0].valueQuantity!.code, 'mm[Hg]')
  })

  it('SA leva o resumo da evolução num ClinicalImpression e não leva prescrição', () => {
    const b = montarBundleSumarioAlta(fixtureSumarioAltaParaCasa(), envio())
    const [ci] = doTipo<Resource & { summary?: string; status?: string }>(b, 'ClinicalImpression')
    assert.equal(ci.status, 'completed')
    assert.match(ci.summary!, /Melhora clínica/)
  })

  it('envio: identificador do solicitante e substituição do documento anterior', () => {
    const b = montarBundleRAC(fixtureAltaParaCasa(), envio({ identificadorSolicitante: '12345', idRndsAnterior: 'abc-999' }))
    assert.deepEqual(b.identifier, { system: `${RNDS}/NamingSystem/BRRNDS-12345`, value: 'rac-enc-0001' })
    assert.deepEqual((b.entry![0].resource as Composition).relatesTo, [{ code: 'replaces', targetReference: { reference: 'Composition/abc-999' } }])
    assert.equal(montarBundleRAC(fixtureAltaParaCasa(), envio({ identificadorSolicitante: null })).identifier, undefined, 'sem credencial, sem identifier')
  })
})

describe('retenção: o que falta não é inventado', () => {
  const casos: [string, () => unknown, RegExp][] = [
    ['sem procedimento SIGTAP', () => montarBundleRAC({ ...fixtureAltaParaCasa(), procedimentos: [] }, envio()), /retido: sem procedimento SIGTAP/],
    ['profissional sem CBO', () => montarBundleRAC({ ...fixtureAltaParaCasa(), profissional: { ...fixtureAltaParaCasa().profissional, cbo_codigo: null } }, envio()), /retido: profissional sem CBO/],
    ['paciente sem CPF e sem CNS', () => montarBundleRAC({ ...fixtureAltaParaCasa(), paciente: { ...fixtureAltaParaCasa().paciente, cpf: null } }, envio()), /retido: paciente sem CPF e sem CNS/],
    ['RAC sem diagnóstico', () => montarBundleRAC({ ...fixtureAltaParaCasa(), condicoes: [] }, envio()), /retido: RAC sem diagnóstico/],
    ['atendimento sem fim', () => montarBundleRAC({ ...fixtureAltaParaCasa(), encontro: { ...fixtureAltaParaCasa().encontro, data_alta: null } }, envio()), /retido: atendimento sem data de fim/],
    ['SA sem resumo', () => montarBundleSumarioAlta({ ...fixtureSumarioAltaParaCasa(), resumo_evolucao: '  ' }, envio()), /retido: Sumário de Alta sem resumo/],
  ]
  for (const [nome, montar, motivo] of casos) it(nome, () => assert.throws(montar, motivo))

  it('CNS na falta do CPF', () => {
    const b = montarBundleRAC({ ...fixtureAltaParaCasa(), paciente: { ...fixtureAltaParaCasa().paciente, cpf: null, cns: '898001000000003' } }, envio())
    assert.equal((b.entry![0].resource as Composition).subject!.identifier!.value, '898001000000003')
  })
})
