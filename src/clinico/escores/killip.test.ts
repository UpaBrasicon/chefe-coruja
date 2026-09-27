// node --experimental-strip-types --test src/clinico/escores/killip.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { killip } from './killip.ts'

const classe = (c: number) => killip.calcular({ classe: c - 1 })!

test('killip: classe III, mortalidade 38%', () => {
  const r = classe(3)
  assert.equal(r.valor, 'III')
  assert.equal(r.estado, 2)
  assert.match(r.nota, /38%/)
})
test('killip: faixas por classe (I→0, II→1, III→2, IV→2) e mortalidade', () => {
  assert.equal(classe(1).estado, 0)
  assert.equal(classe(2).estado, 1)
  assert.equal(classe(4).estado, 2)
  assert.deepEqual(classe(1).derivados[0], ['Mortalidade hospitalar', '6%'])
  assert.deepEqual(classe(2).derivados[0], ['Mortalidade hospitalar', '17%'])
  assert.deepEqual(classe(4).derivados[0], ['Mortalidade hospitalar', '81%'])
})
test('killip: entra no TIMI a partir da classe II', () => {
  assert.equal(classe(1).derivados[1][1], 'não, 0 ponto')
  assert.equal(classe(2).derivados[1][1], 'sim, 2 pontos')
})
test('killip: incompleto devolve null', () => {
  assert.equal(killip.calcular({}), null)
})
test('killip: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(killip.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(killip.ficha), false)
})
