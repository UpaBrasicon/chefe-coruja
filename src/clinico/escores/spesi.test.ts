// node --experimental-strip-types --test src/clinico/escores/spesi.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { spesi } from './spesi.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(spesi.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('sPESI: nenhuma variável = 0, baixo risco, 1,0% na derivação e 1,1% no RIETE', () => {
  const r = spesi.calcular(com())!
  assert.equal(r.valor, '0')
  assert.equal(r.estado, 0)
  assert.deepEqual(r.derivados.map((d) => d[1]), ['1,0%', '1,1%'])
})
test('sPESI: uma variável já é alto risco (10,9% e 8,9%)', () => {
  const r = spesi.calcular(com('fc'))!
  assert.equal(r.valor, '1')
  assert.equal(r.estado, 2)
  assert.deepEqual(r.derivados.map((d) => d[1]), ['10,9%', '8,9%'])
})
test('sPESI: seis variáveis de 1 ponto, máximo 6', () => {
  assert.equal(spesi.itens.length, 6)
  assert.equal(spesi.calcular(com(...spesi.itens.map((i) => i.id)))!.valor, '6')
})
test('sPESI: incompleto devolve null', () => {
  const r = com()
  delete r.sat
  assert.equal(spesi.calcular(r), null)
})
test('sPESI: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(spesi.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(spesi.ficha), false)
})
