// node --experimental-strip-types --test src/clinico/escores/childPugh.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { childPugh } from './childPugh.ts'

// Índice da opção: 0 = 1 ponto, 1 = 2 pontos, 2 = 3 pontos.
const r = (bb: number, alb: number, inr: number, ascite: number, enc: number): Respostas => ({ bb, alb, inr, ascite, enc })

test('child-pugh: bilirrubina 2–3 + albumina < 2,8 + ascite leve = 9, classe B', () => {
  const res = childPugh.calcular(r(1, 2, 0, 1, 0))!
  assert.equal(res.valor, 'B')
  assert.match(res.nota, /^9 pontos/)
  assert.deepEqual(res.derivados[1], ['Sobrevida em 1 ano', '80%'])
})
test('child-pugh: tudo normal = 5, classe A; tudo máximo = 15, classe C', () => {
  assert.equal(childPugh.calcular(r(0, 0, 0, 0, 0))!.valor, 'A')
  const c = childPugh.calcular(r(2, 2, 2, 2, 2))!
  assert.equal(c.valor, 'C')
  assert.deepEqual(c.derivados[0], ['Pontos', '15 de 15'])
})
test('child-pugh: cortes das classes (6→A, 7→B, 9→B, 10→C)', () => {
  assert.equal(childPugh.calcular(r(1, 0, 0, 0, 0))!.valor, 'A')
  assert.equal(childPugh.calcular(r(1, 1, 0, 0, 0))!.valor, 'B')
  assert.equal(childPugh.calcular(r(1, 1, 1, 1, 0))!.valor, 'B')
  const c = childPugh.calcular(r(1, 1, 1, 1, 1))!
  assert.equal(c.valor, 'C')
  assert.equal(c.estado, 2)
})
test('child-pugh: incompleto devolve null', () => {
  assert.equal(childPugh.calcular({ bb: 0, alb: 0, inr: 0, ascite: 0 }), null)
})
test('child-pugh: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(childPugh.ficha.publico, 'adulto')
  assert.ok(childPugh.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(childPugh.ficha), false)
})
