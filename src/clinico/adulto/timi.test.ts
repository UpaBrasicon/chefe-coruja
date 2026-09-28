import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { timiSemSupra } from './timi.ts'

const zeros = { idade: 0, fatores: 0, estenose: 0, dor: 0, aas: 0, st: 0, marcadores: 0 }

test('TIMI-NSTEMI: ficha de adulto do manual do HC', () => {
  assert.equal(timiSemSupra.ficha.id, 'adulto-timi-nstemi')
  assert.equal(timiSemSupra.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(timiSemSupra.ficha), false)
  assert.match(timiSemSupra.ficha.fontes[0].citacao, /p\. 192/)
})

test('TIMI-NSTEMI: sete fatores de 1 ponto (Tabela 4, p. 192)', () => {
  assert.equal(timiSemSupra.itens.length, 7)
  assert.equal(timiSemSupra.calcular({ ...zeros, st: undefined }), null)
  assert.equal(timiSemSupra.calcular(zeros)!.valor, '0')
  assert.equal(timiSemSupra.calcular({ idade: 1, fatores: 1, estenose: 1, dor: 1, aas: 1, st: 1, marcadores: 1 })!.valor, '7')
})

test('TIMI-NSTEMI: baixo risco 0 ou 1 (p. 194); ≥ 2 invasiva 72 h (p. 210); sem %', () => {
  assert.equal(timiSemSupra.calcular({ ...zeros, aas: 1 })!.estado, 0)
  const dois = timiSemSupra.calcular({ ...zeros, aas: 1, st: 1 })!
  assert.equal(dois.estado, 1)
  assert.match(JSON.stringify(dois.derivados), /72 h/)
  for (const n of [0, 3, 7]) {
    const r = Object.fromEntries(Object.keys(zeros).map((k, i) => [k, i < n ? 1 : 0]))
    assert.doesNotMatch(JSON.stringify(timiSemSupra.calcular(r)), /\d%/)
  }
})
