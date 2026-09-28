// node --experimental-strip-types --test src/clinico/pediatria/imunodeprimidoPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_IMUNODEPRIMIDO, corticoideImunossupressor, fichaImunodeprimidoPed } from './imunodeprimidoPed.ts'

const d = (id: string) => DOSES_IMUNODEPRIMIDO.find((x) => x.id === id)!

test('Tabela 7 com máximos do Apêndice', () => {
  assert.equal(temReferenciaPediatrica(fichaImunodeprimidoPed), true)
  assert.deepEqual(calcularDoseLivro(d('cefepima'), 50)!.porDose, [2000, 2000])
  assert.deepEqual(calcularDoseLivro(d('cefotaxima'), 40)!.dia, [6000, 6000])
  assert.deepEqual(calcularDoseLivro(d('gentamicina'), 10)!.porDose, [25, 25])
  assert.deepEqual(calcularDoseLivro(d('vancomicina'), 50)!.dia, [2000, 2000])
  assert.equal(DOSES_IMUNODEPRIMIDO.some((x) => x.id === 'teicoplanina'), false)
})

test('corticoide em dose imunossupressora (p. 484)', () => {
  assert.equal(corticoideImunossupressor(2, 7), true)
  assert.equal(corticoideImunossupressor(2, 6), false)
  assert.equal(corticoideImunossupressor(1, 15), true)
  assert.equal(corticoideImunossupressor(0.5, 30), false)
  assert.equal(corticoideImunossupressor(0, 10), null)
})
