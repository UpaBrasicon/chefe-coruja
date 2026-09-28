// node --experimental-strip-types --test src/clinico/pediatria/choque.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { VASOATIVAS, fichaChoquePediatrico, volumesChoque } from './choque.ts'
import { calcularDose } from './fonteP2.ts'

test('choque: ficha do ICr', () => {
  assert.equal(temReferenciaPediatrica(fichaChoquePediatrico), true)
})

test('volume: 10–20 mL/kg; 40–60 mL/kg na 1ª hora; até 40 mL/kg sem suporte (p. 85)', () => {
  assert.deepEqual(volumesChoque(15), { bolus: [150, 300], primeiraHora: [600, 900], semSuporte: 600 })
  assert.equal(volumesChoque(0), null)
})

test('vasoativas (Tabela 2, p. 87) em µg/min', () => {
  const v = (id: string) => calcularDose(VASOATIVAS.find((x) => x.id === id)!, 10)!.dose
  assert.deepEqual(v('epinefrina'), [1, 10])
  assert.deepEqual(v('dopamina'), [20, 200])
  assert.deepEqual(v('dobutamina'), [20, 200])
})
