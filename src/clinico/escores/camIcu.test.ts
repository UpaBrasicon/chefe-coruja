// node --experimental-strip-types --test src/clinico/escores/camIcu.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { camIcu } from './camIcu.ts'

/** RASS avaliável (índice 0) e as características presentes pelo id */
const com = (...ids: string[]): Respostas => ({ rass: 0, ...Object.fromEntries(['c1', 'c2', 'c3', 'c4'].map((id) => [id, ids.includes(id) ? 1 : 0])) })

test('cam-icu: 1 + 2 + 3 = delirium presente', () => {
  const r = camIcu.calcular(com('c1', 'c2', 'c3'))!
  assert.equal(r.valor, 'Delirium presente')
  assert.equal(r.estado, 2)
  assert.deepEqual(r.derivados[0], ['Características presentes', '3 de 4'])
})
test('cam-icu: 1 + 2 + 4 também é positivo', () => {
  assert.equal(camIcu.calcular(com('c1', 'c2', 'c4'))!.valor, 'Delirium presente')
})
test('cam-icu: 1 + 2 sem 3 nem 4 é negativo', () => {
  const r = camIcu.calcular(com('c1', 'c2'))!
  assert.equal(r.valor, 'Delirium ausente')
  assert.equal(r.estado, 0)
})
test('cam-icu: 1 + 3 + 4 sem desatenção é negativo, com alerta', () => {
  const r = camIcu.calcular(com('c1', 'c3', 'c4'))!
  assert.equal(r.valor, 'Delirium ausente')
  assert.ok(r.alerta)
})
test('cam-icu: 2 + 3 + 4 sem a 1 é negativo', () => {
  assert.equal(camIcu.calcular(com('c2', 'c3', 'c4'))!.valor, 'Delirium ausente')
})
test('cam-icu: RASS −4/−5 dá não avaliável mesmo sem as características', () => {
  const r = camIcu.calcular({ rass: 1 })!
  assert.equal(r.valor, 'Não avaliável')
  assert.equal(r.estado, 1)
})
test('cam-icu: incompleto devolve null', () => {
  assert.equal(camIcu.calcular({ rass: 0, c1: 1, c2: 1, c3: 1 }), null)
  assert.equal(camIcu.calcular({}), null)
})
test('cam-icu: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(camIcu.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(camIcu.ficha), false)
})
