// node --experimental-strip-types --test src/clinico/pediatria/criseEpileptica.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { DOSES_CRISE, fichaCriseEpilepticaPediatrica, tempoMinimoFenitoina, tempoValproato } from './criseEpileptica.ts'
import { calcularDose } from './fonteP2.ts'

const d = (id: string) => DOSES_CRISE.find((x) => x.id === id)!

test('crise: ficha do ICr; ids únicos; toda dose com página', () => {
  assert.equal(temReferenciaPediatrica(fichaCriseEpilepticaPediatrica), true)
  assert.equal(new Set(DOSES_CRISE.map((x) => x.id)).size, DOSES_CRISE.length)
  for (const x of DOSES_CRISE) assert.ok(x.pagina, x.id)
})

test('benzodiazepínicos com máximo (Tabela 1, p. 127)', () => {
  assert.deepEqual(calcularDose(d('lorazepam'), 20)!.dose, [1, 2])
  assert.deepEqual(calcularDose(d('lorazepam'), 60)!.dose, [3, 4])
  assert.deepEqual(calcularDose(d('diazepam-iv'), 40)!.dose, [8, 10])
  assert.deepEqual(calcularDose(d('diazepam-vr'), 10)!.dose, [5, 10])
  assert.deepEqual(calcularDose(d('midazolam-iv'), 50)!.dose, [5, 10])
  assert.deepEqual(calcularDose(d('midazolam-im'), 20)!.dose, [4, 5])
  assert.deepEqual(calcularDose(d('midazolam-in'), 30)!.dose, [6, 7.5])
})

test('ataque: fenitoína, valproato, levetiracetam, fenobarbital (p. 127)', () => {
  assert.deepEqual(calcularDose(d('fenitoina'), 20)!.dose, [200, 400])
  assert.equal(tempoMinimoFenitoina(400), 8) // até 50 mg/min
  assert.deepEqual(calcularDose(d('valproato'), 10)!.dose, [200, 400])
  assert.deepEqual(tempoValproato(30), [10, 20]) // 1,5–3 mg/kg/min
  assert.deepEqual(calcularDose(d('levetiracetam'), 50)!.dose, [3000, 3000])
  assert.deepEqual(calcularDose(d('levetiracetam'), 80)!.dose, [4500, 4500])
  assert.deepEqual(calcularDose(d('fenobarbital'), 12)!.dose, [240, 240])
  assert.deepEqual(calcularDose(d('glicose25'), 10)!.dose, [20, 40])
})

test('refratário: tiopental máx. 500 mg; infusões por peso', () => {
  assert.deepEqual(calcularDose(d('tiopental-bolus'), 120)!.dose, [500, 500])
  assert.deepEqual(calcularDose(d('midazolam-continuo'), 10)!.dose, [10, 180])
  assert.deepEqual(calcularDose(d('tiopental-continuo'), 10)!.dose, [10, 30])
  assert.deepEqual(calcularDose(d('propofol'), 10)!.dose, [50, 50])
})
