// ─────────────────────────────────────────────────────────────────────────────
// RIA-R (percurso da UBS, U15, vacina, PR 7): o Bundle segue o Manual de
// Integração RIA-R v1.9 e as restrições dos perfis do validador oficial
// (BRRegistroImunobiologicoAdministradoRotina-2.0 e BRImunobiologicoAdministrado-3.0).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Composition, Condition, Immunization } from '@medplum/fhirtypes'

import { montarBundleRIA, PERFIL_IMUNIZACAO, PERFIL_RIA_R, type EntidadeRIA } from '../../../src/interop/fhir/ria.ts'
import type { EnvioRnds } from '../../../src/interop/fhir/tipos.ts'

const RNDS = 'http://www.saude.gov.br/fhir/r4'
// snapshots que o validador local confere: npm run fhir:validar -- --ria
const ATUALIZAR = process.argv.includes('--atualizar')
const SNAP_DIR = resolve('scripts/interop/__snapshots__/ria')

function envio(extra: Partial<EnvioRnds> = {}): EnvioRnds {
  let n = 0
  return { agora: '2026-11-20T13:00:00Z', identificadorSolicitante: '99999', uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, ...extra }
}

function dados(vacina: Partial<EntidadeRIA['vacina']> = {}, paciente: Partial<EntidadeRIA['paciente']> = {}): EntidadeRIA {
  return {
    paciente: { id: 'p', nome: 'Paciente', data_nascimento: '1990-01-01', sexo: 'M', cpf: '52998224725', cns: null, telefone: null, prontuario: null, ...paciente },
    estabelecimento: { id: 'u', nome: 'UBS', cnes: '9912345', municipio: null, uf: 'GO', organizacao_id: 'o' },
    profissional: { id: 'e', nome_completo: 'Enfermeira', cpf: null, crm: null, uf_crm: null, cbo_codigo: '223505', cns: '700000000000005' },
    vacina: {
      id: 'v1', registro_anterior: false, aplicado_exterior: false, data_aplicacao: '2026-11-20', registrado_em: '2026-11-20T12:50:00Z',
      imunobiologico: '57', dose: '8', estrategia: '1', grupo_atendimento: '000210', via: '10890', local: '1',
      fabricante: '149', lote: 'DTPA01', validade: '2027-06-30', condicao_maternal: '1', comunicante_hanseniase: null,
      prescritor_cbo: null, cid10_motivo: null, ...vacina,
    },
  }
}

const partes = (b: ReturnType<typeof montarBundleRIA>) => ({
  c: b.entry![0].resource as Composition,
  i: b.entry![1].resource as Immunization,
  outros: b.entry!.slice(2).map((e) => e.resource),
})

describe('snapshots do RIA', () => {
  const casos = [
    { nome: 'ria-aplicada.json', gerar: () => montarBundleRIA(dados(), envio()) },
    { nome: 'ria-transcricao.json', gerar: () => montarBundleRIA(dados({ registro_anterior: true, estrategia: '0', grupo_atendimento: '00', lote: null, fabricante: null, validade: null, imunobiologico: '9', dose: '1', data_aplicacao: '1990-01-02' }), envio()) },
    { nome: 'ria-especial-bcg.json', gerar: () => montarBundleRIA(dados({ imunobiologico: '15', dose: '9', comunicante_hanseniase: false, estrategia: '2', prescritor_cbo: '225125', cid10_motivo: 'D80.0', via: '10885', local: '14', lote: 'BCG01', fabricante: '149' }, { cpf: null, cns: '898000000000002', sexo: 'F' }), envio()) },
  ]
  for (const caso of casos) {
    it(caso.nome, () => {
      mkdirSync(SNAP_DIR, { recursive: true })
      const caminho = resolve(SNAP_DIR, caso.nome)
      const gerado = JSON.stringify(caso.gerar(), null, 2) + '\n'
      if (ATUALIZAR || !existsSync(caminho)) { writeFileSync(caminho, gerado); return }
      assert.equal(readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n'), gerado, `${caso.nome} diverge: rode com --atualizar e confira o diff`)
    })
  }
})

describe('RIA-R: vacina aplicada na UBS', () => {
  const b = montarBundleRIA(dados(), envio())
  const { c, i, outros } = partes(b)
  it('Bundle documento com o identificador do solicitante', () => {
    assert.equal(b.type, 'document')
    assert.deepEqual(b.identifier, { system: `${RNDS}/NamingSystem/BRRNDS-99999`, value: 'ria-v1' })
    assert.equal(outros.length, 0)
  })
  it('Composition no perfil de rotina, sem category, com o título fixo e uma seção', () => {
    assert.deepEqual(c.meta?.profile, [PERFIL_RIA_R])
    assert.equal(c.category, undefined)
    assert.equal(c.title, 'Registro de Imunobiologico Administrado na Rotina')
    assert.deepEqual(c.type?.coding, [{ system: `${RNDS}/CodeSystem/BRTipoDocumento`, code: 'RIA' }])
    assert.deepEqual(c.author, [{ identifier: { system: `${RNDS}/StructureDefinition/BREstabelecimentoSaude-1.0`, value: '9912345' } }])
    assert.equal(c.section?.length, 1)
    assert.equal(c.section?.[0].entry?.length, 1)
  })
  it('Immunization com os códigos da RNDS e sem recorded', () => {
    assert.deepEqual(i.meta?.profile, [PERFIL_IMUNIZACAO])
    assert.equal(i.recorded, undefined)
    assert.equal(i.primarySource, true)
    assert.equal(i.reportOrigin, undefined)
    assert.equal(i.vaccineCode.coding?.[0].code, '57')
    assert.equal(i.patient.identifier?.value, '52998224725')
    assert.equal(i.occurrenceDateTime, '2026-11-20')
    assert.equal(i.lotNumber, 'DTPA01')
    assert.equal(i.expirationDate, '2027-06-30')
    assert.equal(i.manufacturer?.identifier?.value, '149')
    assert.equal(i.site?.coding?.[0].code, '1')
    assert.equal(i.route?.coding?.[0].code, '10890')
    assert.deepEqual(i.performer, [{ actor: { reference: 'Practitioner/700000000000005' } }])
    assert.equal(i.protocolApplied?.[0].doseNumberString, '8')
    assert.equal(i.protocolApplied?.[0].extension?.[0].valueCodeableConcept?.coding?.[0].code, '1')
    assert.deepEqual(i.extension?.map((e) => e.url.split('/').pop()), ['BRGrupoAtendimento', 'BRCondicaoMaternal'])
  })
})

describe('RIA-R: transcrição de caderneta, especial e o que retém', () => {
  it('transcrição: primarySource false, origem 01 e Brasil; sem lote', () => {
    const { i } = partes(montarBundleRIA(dados({ registro_anterior: true, estrategia: '0', grupo_atendimento: '00', lote: null, fabricante: null, validade: null }), envio()))
    assert.equal(i.primarySource, false)
    assert.equal(i.reportOrigin?.coding?.[0].code, '01')
    assert.deepEqual(i.location, { identifier: { system: `${RNDS}/CodeSystem/BRPais`, value: '10' } })
    assert.equal(i.lotNumber, undefined)
    assert.equal(i.manufacturer, undefined)
  })
  it('vacina no exterior: origem 02 e sem país', () => {
    const { i } = partes(montarBundleRIA(dados({ registro_anterior: true, aplicado_exterior: true, imunobiologico: '85', lote: null, fabricante: null }), envio()))
    assert.equal(i.reportOrigin?.coding?.[0].code, '02')
    assert.equal(i.location, undefined)
  })
  it('estratégia especial: CBO do prescritor e o CID-10 do motivo', () => {
    const { i, outros } = partes(montarBundleRIA(dados({ estrategia: '2', prescritor_cbo: '225125', cid10_motivo: 'D80.0' }), envio()))
    assert.equal(i.performer?.[0].function?.coding?.[0].code, '225125')
    assert.equal(i.reasonReference?.length, 1)
    const motivo = outros[0] as Condition
    assert.equal(motivo.code?.coding?.[0].code, 'D800')
    assert.deepEqual(motivo.meta?.profile, [`${RNDS}/StructureDefinition/BRCID10Avaliado-1.0`])
  })
  it('BCG leva o contato com hanseníase', () => {
    const { i } = partes(montarBundleRIA(dados({ imunobiologico: '15', comunicante_hanseniase: false }), envio()))
    assert.equal(i.extension?.find((e) => e.url.endsWith('BRContatoHanseniase'))?.valueBoolean, false)
  })
  it('substitui o documento anterior', () => {
    const { c } = partes(montarBundleRIA(dados(), envio({ idRndsAnterior: 'abc' })))
    assert.deepEqual(c.relatesTo, [{ code: 'replaces', targetReference: { reference: 'Composition/abc' } }])
  })
  it('retém o que falta', () => {
    assert.throws(() => montarBundleRIA(dados({}, { cpf: null, cns: null }), envio()), /retido: paciente sem CPF e sem CNS/)
    assert.throws(() => montarBundleRIA({ ...dados(), profissional: { ...dados().profissional, cns: null } }, envio()), /retido: profissional sem CNS/)
    assert.throws(() => montarBundleRIA(dados({ condicao_maternal: null }), envio()), /retido: vacina sem condição maternal/)
    assert.throws(() => montarBundleRIA(dados({ imunobiologico: '15' }), envio()), /retido: BCG sem contato/)
    assert.throws(() => montarBundleRIA(dados({ lote: null }), envio()), /retido: vacina aplicada sem lote/)
    assert.throws(() => montarBundleRIA(dados({ estrategia: '2' }), envio()), /retido: estratégia especial/)
  })
})
