// node --experimental-strip-types --test src/clinico/escores/mcisaac.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { mcisaac } from './mcisaac.ts'

// idade: índice 0 = 3 a 14 anos (+1), 1 = 15 a 44 (0), 2 = 45 ou mais (−1)
const r = (febre: number, semTosse: number, adenopatia: number, amigdala: number, idade: number) => ({ febre, semTosse, adenopatia, amigdala, idade })

test('mcisaac: quatro achados aos 10 anos = 5, contado como 4', () => {
  const res = mcisaac.calcular(r(1, 1, 1, 1, 0))!
  assert.equal(res.valor, '4')
  assert.deepEqual(res.derivados[0], ['Soma antes do ajuste', '5'])
})
test('mcisaac: nenhum achado aos 50 anos = −1, contado como 0', () => {
  assert.equal(mcisaac.calcular(r(0, 0, 0, 0, 2))!.valor, '0')
})
test('mcisaac: corte em 2', () => {
  assert.equal(mcisaac.calcular(r(1, 0, 0, 0, 1))!.estado, 0)
  assert.equal(mcisaac.calcular(r(1, 1, 0, 0, 1))!.estado, 1)
})
test('mcisaac: vale também na criança (fonte com crianças)', () => {
  assert.equal(temReferenciaPediatrica(mcisaac.ficha), true)
})
