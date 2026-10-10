// node --experimental-strip-types --test src/lib/bpa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codigoSigtapNaTela, competenciasNaJanela, foraDaJanela, soDigitos } from './bpa.ts'

test('código SIGTAP como o SIGTAP mostra', () => {
  assert.equal(codigoSigtapNaTela('0301060096'), '03.01.06.009-6')
  assert.equal(codigoSigtapNaTela('0301100012'), '03.01.10.001-2')
  assert.equal(codigoSigtapNaTela('123'), '123')
  assert.equal(codigoSigtapNaTela(null), '—')
})

test('janela do SIA: competência atual e 3 anteriores', () => {
  assert.deepEqual(competenciasNaJanela('202602'), ['202602', '202601', '202512', '202511'])
  assert.equal(foraDaJanela('202511', '202602'), false)
  assert.equal(foraDaJanela('202510', '202602'), true)
})

test('só dígitos', () => {
  assert.equal(soDigitos('01310-100'), '01310100')
  assert.equal(soDigitos('11.222.333/0001-81'), '11222333000181')
})
