// node --experimental-strip-types --test src/clinico/pediatria/peconhentosPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { TABELA_SORO, expansaoEscorpiaoMl, fichaPeconhentosPed, prednisonaLoxoscelesMgDia, volumeSaarMl } from './peconhentosPed.ts'

test('escorpião (Tabela 1, p. 211–212): leve sem soro, moderado 3, grave 6 ampolas', () => {
  assert.equal(temReferenciaPediatrica(fichaPeconhentosPed), true)
  assert.equal(TABELA_SORO.escorpiao.leve.ampolas, null)
  assert.deepEqual(TABELA_SORO.escorpiao.moderado.ampolas, [3, 3])
  assert.deepEqual(TABELA_SORO.escorpiao.grave.ampolas, [6, 6])
  assert.match(TABELA_SORO.escorpiao.moderado.idade!, /≤ 10 anos/)
})

test('aranhas (Tabelas 2–4, p. 212–215)', () => {
  assert.deepEqual(TABELA_SORO.phoneutria.moderado.ampolas, [2, 4])
  assert.deepEqual(TABELA_SORO.phoneutria.grave.ampolas, [5, 10])
  assert.deepEqual(TABELA_SORO.loxosceles.moderado.ampolas, [5, 5])
  assert.deepEqual(TABELA_SORO.loxosceles.grave.ampolas, [10, 10])
  assert.deepEqual(TABELA_SORO.latrodectus.grave.ampolas, [1, 1])
  assert.equal(TABELA_SORO.latrodectus.grave.via, 'IM')
})

test('volume do SAAr (5 mL/ampola), prednisona 1 mg/kg/dia e expansão de 5 mL/kg', () => {
  assert.deepEqual(volumeSaarMl([5, 10]), [25, 50])
  assert.equal(prednisonaLoxoscelesMgDia(18), 18)
  assert.equal(expansaoEscorpiaoMl(20), 100)
  assert.equal(expansaoEscorpiaoMl(0), null)
})
