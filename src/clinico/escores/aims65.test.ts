// node --experimental-strip-types --test src/clinico/escores/aims65.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { aims65 } from './aims65.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(aims65.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('aims65: albumina baixa + idade > 65 = 2, mortalidade 3%', () => {
  const r = aims65.calcular(com('albumina', 'idade'))!
  assert.equal(r.valor, '2')
  assert.equal(r.estado, 1)
  assert.match(r.nota, /3%/)
})
test('aims65: todos = 5, mortalidade 25%', () => {
  assert.deepEqual(aims65.calcular(com('albumina', 'inr', 'mental', 'pas', 'idade'))!.derivados[0], ['Mortalidade hospitalar', '25%'])
})
test('aims65: cortes das faixas (1→0, 2→1, 3→2)', () => {
  assert.equal(aims65.calcular(com())!.estado, 0)
  assert.equal(aims65.calcular(com('inr'))!.estado, 0)
  assert.equal(aims65.calcular(com('inr', 'mental'))!.estado, 1)
  assert.equal(aims65.calcular(com('inr', 'mental', 'pas'))!.estado, 2)
})
test('aims65: incompleto devolve null', () => {
  const r = com()
  delete r.pas
  assert.equal(aims65.calcular(r), null)
})
test('aims65: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(aims65.ficha.publico, 'adulto')
  assert.ok(aims65.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(aims65.ficha), false)
})
