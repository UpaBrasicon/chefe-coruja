// node --experimental-strip-types --test src/clinico/escores/bisap.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { bisap } from './bisap.ts'

const com = (ureia: number, ...ids: string[]): Respostas => ({ ureia, ...Object.fromEntries(['mental', 'sirs', 'idade', 'derrame'].map((k) => [k, ids.includes(k) ? 1 : 0])) })

test('bisap: ureia 64,2 mg/dL (BUN 30) + SIRS = 2, mortalidade 1,9%', () => {
  const r = bisap.calcular(com(64.2, 'sirs'))!
  assert.equal(r.valor, '2')
  assert.equal(r.estado, 1)
  assert.match(r.nota, /1,9%/)
  assert.match(r.derivados[0][1], /^30 mg\/dL/)
})
test('bisap: corte do BUN (ureia 53,5 → BUN 25 não pontua; 53,6 pontua)', () => {
  assert.equal(bisap.calcular(com(53.5))!.valor, '0')
  assert.equal(bisap.calcular(com(53.6))!.valor, '1')
})
test('bisap: cortes das faixas (1→0, 2→1, 3→2) e máximo 5 = 22,5%', () => {
  assert.equal(bisap.calcular(com(30, 'idade'))!.estado, 0)
  assert.equal(bisap.calcular(com(30, 'idade', 'sirs'))!.estado, 1)
  assert.equal(bisap.calcular(com(30, 'idade', 'sirs', 'derrame'))!.estado, 2)
  assert.match(bisap.calcular(com(100, 'mental', 'sirs', 'idade', 'derrame'))!.nota, /22,5%/)
})
test('bisap: incompleto ou ureia fora da faixa devolve null', () => {
  const r = com(30)
  delete r.sirs
  assert.equal(bisap.calcular(r), null)
  assert.equal(bisap.calcular(com(0)), null)
  assert.equal(bisap.calcular(com(6000)), null)
})
test('bisap: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(bisap.ficha.publico, 'adulto')
  assert.ok(bisap.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(bisap.ficha), false)
})
