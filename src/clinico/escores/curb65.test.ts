// node --experimental-strip-types --test src/clinico/escores/curb65.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { curb65 } from './curb65.ts'

/** Critérios presentes pelo id; os demais respondidos "Não". */
const com = (...ids: string[]): Respostas => Object.fromEntries(curb65.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('curb-65: confusão + idade ≥ 65 = 2 pontos, mortalidade 13%', () => {
  const r = curb65.calcular(com('c', 'i'))!
  assert.equal(r.valor, '2')
  assert.equal(r.estado, 1)
  assert.match(r.nota, /13%/)
})
test('curb-65: todos presentes = 5, mortalidade 57%', () => {
  const r = curb65.calcular(com('c', 'u', 'r', 'b', 'i'))!
  assert.equal(r.valor, '5')
  assert.equal(r.estado, 2)
  assert.deepEqual(r.derivados[0], ['Mortalidade em 30 dias', '57%'])
})
test('curb-65: faixas nos cortes (1→0, 2→1, 3→2)', () => {
  assert.equal(curb65.calcular(com())!.estado, 0)
  assert.equal(curb65.calcular(com('c'))!.estado, 0)
  assert.equal(curb65.calcular(com('c', 'u'))!.estado, 1)
  assert.equal(curb65.calcular(com('c', 'u', 'r'))!.estado, 2)
})
test('curb-65: incompleto devolve null', () => {
  const r = com('c')
  delete r.i
  assert.equal(curb65.calcular(r), null)
  assert.equal(curb65.calcular({}), null)
})
test('curb-65: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(curb65.ficha.publico, 'adulto')
  assert.ok(curb65.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(curb65.ficha), false)
})
