// node --experimental-strip-types --test src/clinico/escores/cockcroftGault.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { clearanceCockcroftGault, cockcroftGault } from './cockcroftGault.ts'

const r = (creatinina: number, idade: number, peso: number, sexo: 0 | 1) => ({ creatinina, idade, peso, sexo })

test('cockcroft-gault: homem de 40 anos, 70 kg, creatinina 1,0 = 97 mL/min', () => {
  assert.equal(Math.round(clearanceCockcroftGault(1, 40, 70, false)!), 97) // 100 × 70 / 72 = 97,2
  const res = cockcroftGault.calcular(r(1, 40, 70, 1))!
  assert.equal(res.valor, '97')
  assert.equal(res.estado, 0)
})
test('cockcroft-gault: mulher tem 15% a menos (× 0,85)', () => {
  assert.equal(cockcroftGault.calcular(r(1, 40, 70, 0))!.valor, '83') // 97,2 × 0,85 = 82,6
})
test('cockcroft-gault: faixas abaixo de 60 e de 30', () => {
  assert.equal(cockcroftGault.calcular(r(2, 70, 70, 1))!.estado, 1) // 70 × 70 / 144 = 34
  assert.equal(cockcroftGault.calcular(r(4, 80, 60, 1))!.estado, 2) // 60 × 60 / 288 = 12,5
})
test('cockcroft-gault: abaixo de 18 anos ou incompleto não calcula', () => {
  assert.equal(clearanceCockcroftGault(1, 17, 50, false), null)
  assert.equal(cockcroftGault.calcular({ creatinina: 1, idade: 40, sexo: 1 }), null)
})
test('cockcroft-gault: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(cockcroftGault.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(cockcroftGault.ficha), false)
})
