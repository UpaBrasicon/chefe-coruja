// node --experimental-strip-types --test supabase/functions/api/fhir.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bundlePedidos, caminhoLaudoLab, conteudoCanonico, lerDiagnosticReport, lerImagingStudy, lerSpecimen, operationOutcome, paramsPedidos, rotaFhir } from './fhir.ts'

const ID = '2b000000-0000-4000-8000-0000000d3201'

test('rotas da porta do laboratório e da imagem', () => {
  assert.deepEqual(rotaFhir('/fhir/ServiceRequest', 'GET'), { acao: 'pedidos' })
  assert.deepEqual(rotaFhir('/fhir/Specimen', 'POST'), { acao: 'coleta' })
  assert.deepEqual(rotaFhir('/fhir/DiagnosticReport', 'POST'), { acao: 'laudo' })
  assert.deepEqual(rotaFhir('/fhir/ImagingStudy', 'POST'), { acao: 'estudo' })
  assert.equal((rotaFhir('/fhir/ImagingStudy', 'GET') as { erro: { status: number } }).erro.status, 405)
  assert.deepEqual(rotaFhir('/fhir/metadata', 'GET'), { acao: 'metadata' })
  assert.equal((rotaFhir('/fhir/ServiceRequest', 'POST') as { erro: { status: number } }).erro.status, 405)
  assert.equal((rotaFhir('/fhir/Patient', 'GET') as { erro: { status: number } }).erro.status, 404)
})

test('busca dos pedidos: unidade, authored=ge, _count e cursor', () => {
  assert.deepEqual(paramsPedidos(new URLSearchParams('authored=ge2026-10-19T00:00:00-03:00&_count=20&cursor=NTA=')),
    { desde: '2026-10-19T00:00:00-03:00', limite: 20, cursor: 'NTA=' })
  assert.ok('erro' in paramsPedidos(new URLSearchParams('authored=2026-10-19')))
  assert.ok('erro' in paramsPedidos(new URLSearchParams('_count=500')))
  assert.ok('erro' in paramsPedidos(new URLSearchParams('unidade_id=x')))
})

test('Specimen: pedido e hora da coleta', () => {
  assert.deepEqual(lerSpecimen({ resourceType: 'Specimen', request: [{ reference: `ServiceRequest/${ID}` }], collection: { collectedDateTime: '2026-10-19T10:00:00-03:00' } }),
    { exame_id: ID, coletado_em: '2026-10-19T10:00:00-03:00' })
  assert.ok('erro' in lerSpecimen({ resourceType: 'Specimen', request: [{ reference: 'Patient/1' }] }))
  assert.ok('erro' in lerSpecimen({ resourceType: 'Observation' }))
})

const laudo = {
  resourceType: 'DiagnosticReport', status: 'final', identifier: [{ value: 'LAB-9' }], basedOn: [{ reference: `ServiceRequest/${ID}` }],
  conclusion: 'Anemia importante.',
  contained: [
    { resourceType: 'Observation', id: 'hb', code: { coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin' }], text: 'Hemoglobina' },
      valueQuantity: { value: 6.9, unit: 'g/dL' }, referenceRange: [{ low: { value: 12, unit: 'g/dL' }, high: { value: 16, unit: 'g/dL' } }],
      interpretation: [{ coding: [{ code: 'LL' }] }] },
    { resourceType: 'Observation', id: 'leu', code: { text: 'Leucócitos' }, valueQuantity: { value: 50000, comparator: '>', unit: '/mm³' },
      referenceRange: [{ text: '4.000 a 11.000' }], interpretation: [{ coding: [{ code: 'H' }] }] },
  ],
  result: [{ reference: '#hb' }, { reference: '#leu' }],
  presentedForm: [{ contentType: 'application/pdf', data: 'JVBERi0xLjQK', title: 'laudo.pdf' }],
}

test('ImagingStudy: pedido, situação, hora e link do visualizador no Endpoint contido', () => {
  const estudo = {
    resourceType: 'ImagingStudy', status: 'available', basedOn: [{ reference: `ServiceRequest/${ID}` }],
    identifier: [{ system: 'urn:dicom:uid', value: 'urn:oid:1.2.3' }], started: '2026-10-20T10:00:00-03:00',
    contained: [{ resourceType: 'Endpoint', id: 'pacs', address: 'https://pacs.hospital.com.br/viewer?study=1.2.3' }],
    endpoint: [{ reference: '#pacs' }],
  }
  assert.deepEqual(lerImagingStudy(estudo), { exame_id: ID, status: 'available', iniciado_em: '2026-10-20T10:00:00-03:00',
    link: 'https://pacs.hospital.com.br/viewer?study=1.2.3', identificador: 'urn:oid:1.2.3' })
  assert.deepEqual(lerImagingStudy({ resourceType: 'ImagingStudy', status: 'registered', basedOn: [{ reference: `ServiceRequest/${ID}` }] }),
    { exame_id: ID, status: 'registered', iniciado_em: null, link: null, identificador: null })
  assert.ok('erro' in lerImagingStudy({ ...estudo, status: 'entered-in-error' }))
  assert.ok('erro' in lerImagingStudy({ ...estudo, basedOn: [{ reference: 'Patient/1' }] }))
  assert.ok('erro' in lerImagingStudy({ ...estudo, endpoint: [{ reference: 'Endpoint/externo' }] }))
  assert.ok('erro' in lerImagingStudy({ ...estudo, started: '2026-10-20' }))
  assert.ok('erro' in lerImagingStudy({ resourceType: 'DiagnosticReport' }))
})

test('DiagnosticReport: analitos como vieram; crítico só com a marca do laboratório; PDF', () => {
  const l = lerDiagnosticReport(laudo)
  assert.ok(!('erro' in l))
  if ('erro' in l) return
  assert.equal(l.exame_id, ID)
  assert.equal(l.identificador, 'LAB-9')
  assert.deepEqual(l.itens[0], { analito: 'Hemoglobina', loinc: '718-7', valor: '6.9', unidade: 'g/dL', referencia: '12 a 16 g/dL', marca: 'LL', critico: true })
  assert.deepEqual(l.itens[1], { analito: 'Leucócitos', loinc: null, valor: '>50000', unidade: '/mm³', referencia: '4.000 a 11.000', marca: 'H', critico: false })
  assert.equal(l.pdf?.nome, 'laudo.pdf')
})

test('DiagnosticReport recusado: status, referência, PDF e final vazio', () => {
  assert.ok('erro' in lerDiagnosticReport({ ...laudo, status: 'unknown' }))
  assert.ok('erro' in lerDiagnosticReport({ ...laudo, basedOn: [] }))
  assert.ok('erro' in lerDiagnosticReport({ ...laudo, result: [{ reference: '#nao' }] }))
  assert.ok('erro' in lerDiagnosticReport({ ...laudo, presentedForm: [{ contentType: 'image/png', data: 'AAAA' }] }))
  assert.ok('erro' in lerDiagnosticReport({ ...laudo, contained: [], result: [], presentedForm: [], conclusion: undefined }))
  assert.ok(!('erro' in lerDiagnosticReport({ resourceType: 'DiagnosticReport', status: 'preliminary', basedOn: [{ reference: `ServiceRequest/${ID}` }] })))
})

test('conteúdo estável, caminho do laudo, Bundle e OperationOutcome', () => {
  const l = lerDiagnosticReport(laudo)
  if ('erro' in l) throw new Error('laudo')
  assert.equal(conteudoCanonico(l, 'x'), conteudoCanonico({ ...l, status: 'amended' }, 'x'))
  assert.equal(caminhoLaudoLab(ID, 'LAB 9/á', 5), `${ID}/lab-LAB-9-a-5.pdf`)
  const b = bundlePedidos([{ resourceType: 'ServiceRequest', id: ID }], 'https://x/v1', new URLSearchParams('_count=1'), 'MQ==')
  assert.equal(b.entry[0].fullUrl, `https://x/v1/fhir/ServiceRequest/${ID}`)
  assert.equal(b.link[1].url, 'https://x/v1/fhir/ServiceRequest?_count=1&cursor=MQ%3D%3D')
  assert.equal(operationOutcome(409, 'x', 'r').issue[0].code, 'conflict')
})
