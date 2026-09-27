// node --experimental-strip-types --test src/clinico/escores/rass.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { rass } from './rass.ts'

/** índice da opção pelo nível (+4 é o índice 0, −5 é o 9) */
const nivel = (n: number) => rass.calcular({ nivel: 4 - n })!

test('rass: 0 alerta e calmo, sem cor', () => {
  const r = nivel(0)
  assert.equal(r.valor, '0')
  assert.equal(r.estado, 0)
  assert.equal(r.nota, 'alerta e calmo')
})
test('rass: formato com sinal (+2, −3)', () => {
  assert.equal(nivel(2).valor, '+2')
  assert.equal(nivel(-3).valor, '−3')
})
test('rass: bandas nos cortes', () => {
  assert.equal(nivel(3).estado, 2)
  assert.equal(nivel(2).estado, 2)
  assert.equal(nivel(1).estado, 1)
  assert.equal(nivel(-1).estado, 0)
  assert.equal(nivel(-2).estado, 0)
  assert.equal(nivel(-3).estado, 1)
  assert.equal(nivel(-4).estado, 2)
  assert.equal(nivel(-5).estado, 2)
})
test('rass: CAM-ICU não avaliável a partir de −4', () => {
  assert.match(nivel(-3).derivados[1][1], /^avaliável/)
  assert.match(nivel(-4).derivados[1][1], /não avaliável/)
})
test('rass: alerta de agitação grave a partir de +3', () => {
  assert.ok(nivel(3).alerta)
  assert.equal(nivel(2).alerta, undefined)
})
test('rass: incompleto devolve null', () => {
  assert.equal(rass.calcular({}), null)
})
test('rass: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(rass.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(rass.ficha), false)
})
