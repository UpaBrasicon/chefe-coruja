// node --experimental-strip-types --test src/lib/apac.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { competenciasDaValidade, numeroApac, numeroApacValido } from './apac.ts'

test('número da APAC: 13 dígitos, aceitando separadores', () => {
  assert.equal(numeroApac('3526.1000.0001-1'), '3526100000011')
  assert.equal(numeroApacValido('3526100000011'), true)
  assert.equal(numeroApacValido('352610000001'), false)
  assert.equal(numeroApacValido(''), false)
})

test('competências da validade', () => {
  assert.deepEqual(competenciasDaValidade('2026-11-01', '2027-01-31'), ['202611', '202612', '202701'])
  assert.deepEqual(competenciasDaValidade('2026-10-15', '2026-10-20'), ['202610'])
  assert.deepEqual(competenciasDaValidade(null, '2026-10-20'), [])
})
