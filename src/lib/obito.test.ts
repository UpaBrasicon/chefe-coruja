// node --experimental-strip-types --test src/lib/obito.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  avisosObito, destinoDoCorpo, detalhesObito, encaminhamentoDe, linhasCausas, obitoVazio, regrasObito, rotuloPendencias,
  termosVagos, unidadeEmiteDo, type ValorObito,
} from './obito.ts'

const agora = Date.parse('2026-11-10T15:00:00Z') // 12:00 em Brasília
const base = (x: Partial<ValorObito> = {}): ValorObito => ({ ...obitoVazio('2026-11-10T11:50'), ...x })

test('termos vagos: só os citados (MS/CFM 2009), com ou sem acento', () => {
  assert.deepEqual(termosVagos('Parada cardiorrespiratória'), ['parada cardiorrespiratória'])
  assert.deepEqual(termosVagos('PARADA CARDIO-RESPIRATORIA'), ['parada cardiorrespiratória'])
  assert.deepEqual(termosVagos('Parada cardíaca e parada respiratória'), ['parada cardíaca', 'parada respiratória'])
  assert.deepEqual(termosVagos('Falência múltipla dos órgãos'), ['falência de múltiplos órgãos'])
  assert.deepEqual(termosVagos('falência de múltiplos órgãos'), ['falência de múltiplos órgãos'])
  assert.deepEqual(termosVagos('Choque séptico; pneumonia'), [])
  assert.deepEqual(termosVagos(null), [])
})

test('caminho e D.O. por tipo de morte (Res. CFM 1.779/2005, art. 2º)', () => {
  assert.equal(encaminhamentoDe({ tipo: 'natural_assistida', encaminhamento: '' }), 'unidade')
  assert.equal(encaminhamentoDe({ tipo: 'violenta_ou_suspeita', encaminhamento: '' }), 'iml')
  assert.equal(encaminhamentoDe({ tipo: 'natural_sem_assistencia_ou_a_esclarecer', encaminhamento: '' }), null)
  assert.equal(unidadeEmiteDo({ tipo: 'natural_sem_assistencia_ou_a_esclarecer', encaminhamento: 'causa_desconhecida' }), true)
  assert.equal(unidadeEmiteDo({ tipo: 'natural_sem_assistencia_ou_a_esclarecer', encaminhamento: 'svo' }), false)
  assert.equal(unidadeEmiteDo({ tipo: 'violenta_ou_suspeita', encaminhamento: '' }), false)
  assert.equal(destinoDoCorpo('unidade'), 'funeraria')
  assert.equal(destinoDoCorpo('causa_desconhecida'), 'funeraria')
  assert.equal(destinoDoCorpo('svo'), 'svo')
  assert.equal(destinoDoCorpo('iml'), 'iml')
})

test('regras: natural com assistência pede D.O. de 9 dígitos, condição e linha a', () => {
  const falta = (v: ValorObito) => regrasObito(v, { agora }).filter((r) => !r.ok).map((r) => r.texto)
  assert.deepEqual(falta(base()), ['Tipo de morte'])
  assert.deepEqual(falta(base({ tipo: 'natural_assistida', numeroDo: '12345678' })),
    ['Nº da Declaração de Óbito (9 dígitos)', 'Você atesta como assistente ou substituto', 'Causa na linha a da Parte I'])
  assert.deepEqual(falta(base({ tipo: 'natural_assistida', numeroDo: '123.456.789', condicao: 'substituto', causaA: 'Infarto' })), [])
  assert.deepEqual(falta(base({ tipo: 'violenta_ou_suspeita' })), [])
  assert.deepEqual(falta(base({ tipo: 'natural_sem_assistencia_ou_a_esclarecer' })), ['SVO ou "causa da morte desconhecida" (sem SVO)'])
  assert.deepEqual(falta(base({ tipo: 'violenta_ou_suspeita', hora: '2026-11-10T13:00' })), ['Hora do óbito (entre a entrada e agora)'])
  assert.deepEqual(regrasObito(base({ tipo: 'violenta_ou_suspeita' }), { agora, desde: '2026-11-10T15:30:00Z' }).filter((r) => !r.ok).length, 1)
})

test('avisos: termo vago por linha; sem SVO só a Parte II', () => {
  assert.deepEqual(avisosObito(base({ tipo: 'natural_assistida', causaA: 'Parada cardiorrespiratória', causaB: 'Infarto' })).map((a) => a.split(':')[0]), ['linha a'])
  assert.deepEqual(avisosObito(base({ tipo: 'natural_sem_assistencia_ou_a_esclarecer', encaminhamento: 'causa_desconhecida', causaA: 'parada cardíaca', parte2: 'Falência múltipla dos órgãos (sic)' }))
    .map((a) => a.split(':')[0]), ['Parte II'])
})

test('jsonb: hora e número no primeiro nível; o resto em obito', () => {
  const d = detalhesObito(base({ tipo: 'natural_assistida', numeroDo: '123.456.789', condicao: 'assistente', causaA: ' Infarto ', parte2: 'Diabetes' }))
  assert.deepEqual(d, {
    hora_obito: '2026-11-10T14:50:00.000Z', numero_do: '123456789',
    obito: { tipo_morte: 'natural_assistida', atestado_condicao: 'assistente', causa_a: 'Infarto', parte2: 'Diabetes' },
  })
  // violenta: sem número nem condição, mesmo se digitados; polícia só quando marcada
  const v = detalhesObito(base({ tipo: 'violenta_ou_suspeita', numeroDo: '123456789', condicao: 'assistente', policiaComunicada: true, policiaEm: '2026-11-10T11:55', ocorrencia: ' BO 12 ' }))
  assert.deepEqual(v, {
    hora_obito: '2026-11-10T14:50:00.000Z',
    obito: { tipo_morte: 'violenta_ou_suspeita', policia_comunicada_em: '2026-11-10T14:55:00.000Z', policia_ocorrencia: 'BO 12' },
  })
  // sem SVO: a Parte I é do servidor ("causa da morte desconhecida")
  const c = detalhesObito(base({ tipo: 'natural_sem_assistencia_ou_a_esclarecer', encaminhamento: 'causa_desconhecida', numeroDo: '111111111', condicao: 'substituto', causaA: 'x' }))
  assert.deepEqual(c.obito, { tipo_morte: 'natural_sem_assistencia_ou_a_esclarecer', encaminhamento: 'causa_desconhecida', atestado_condicao: 'substituto' })
})

test('pendências e causas', () => {
  assert.equal(rotuloPendencias([]), '')
  assert.equal(rotuloPendencias(['comunicacao_familia', 'liberacao']), 'Falta: comunicação à família, liberação do corpo')
  assert.deepEqual(linhasCausas({ a: 'Infarto', b: null, c: ' ', d: null, parte2: 'Diabetes' }),
    [{ rotulo: 'Parte I, a', texto: 'Infarto' }, { rotulo: 'Parte II', texto: 'Diabetes' }])
})
