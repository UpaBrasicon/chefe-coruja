// node --experimental-strip-types --test src/clinico/escores/four.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { four } from './four.ts'

/** pontos por domínio (a opção de índice 0 vale 4) */
const com = (olhos: number, motor: number, tronco: number, resp: number) =>
  four.calcular({ olhos: 4 - olhos, motor: 4 - motor, tronco: 4 - tronco, resp: 4 - resp })!

test('four: normal = 16, leve', () => {
  const r = com(4, 4, 4, 4)
  assert.equal(r.valor, '16')
  assert.equal(r.estado, 0)
  assert.deepEqual(r.derivados[0], ['Ocular', '4 de 4'])
})
test('four: cortes (12→0, 11→1, 5→1, 4→2)', () => {
  assert.equal(com(4, 4, 4, 0).estado, 0)
  assert.equal(com(4, 4, 3, 0).estado, 1)
  assert.equal(com(1, 1, 3, 0).estado, 1)
  assert.equal(com(1, 1, 2, 0).estado, 2)
})
test('four: alerta com ocular, motor e tronco em zero', () => {
  assert.ok(com(0, 0, 0, 1).alerta)
  assert.equal(com(0, 0, 1, 0).alerta, undefined)
})
test('four: incompleto devolve null', () => {
  assert.equal(four.calcular({ olhos: 0, motor: 0, tronco: 0 }), null)
})
test('four: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(four.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(four.ficha), false)
})
