// node --experimental-strip-types --test src/clinico/pediatria/insuficienciaAdrenalPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  expansaoAdrenalMl, fichaInsuficienciaAdrenalPed, fludrocortisonaDispensavel, hidrocortisonaBolusMg, hidrocortisonaManutencao, hidrocortisonaReducao,
} from './insuficienciaAdrenalPed.ts'

test('hidrocortisona por m² (p. 530)', () => {
  assert.equal(temReferenciaPediatrica(fichaInsuficienciaAdrenalPed), true)
  assert.deepEqual(hidrocortisonaBolusMg(0.8), [60, 80])
  const m = hidrocortisonaManutencao(0.8)!
  assert.deepEqual(m.dia, [60, 80])
  assert.deepEqual(m.porDose, [15, 20])
  assert.deepEqual(hidrocortisonaReducao(1), [50, 75])
  assert.equal(hidrocortisonaBolusMg(0), null)
})

test('fludrocortisona dispensável acima de 50 mg/24 h de hidrocortisona EV', () => {
  assert.equal(fludrocortisonaDispensavel(50), false)
  assert.equal(fludrocortisonaDispensavel(60), true)
  assert.equal(fludrocortisonaDispensavel(0), null)
})

test('expansão 20 mL/kg', () => {
  assert.deepEqual(expansaoAdrenalMl(12), [240, 240])
})
