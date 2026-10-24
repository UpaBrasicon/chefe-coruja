// node --experimental-strip-types --test src/clinico/adulto/colicaRenal.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ANALGESIA, condutaPorTamanho, quetaminaMg } from './colicaRenal.ts'

test('cólica: quetamina 0,2–0,4 mg/kg (p. 848)', () => {
  const q = quetaminaMg(70)!
  assert.ok(Math.abs(q[0] - 14) < 1e-9 && Math.abs(q[1] - 28) < 1e-9)
  assert.equal(quetaminaMg(0), null)
})
test('cólica: cetorolaco 10 mg é a 1ª linha (p. 848)', () => {
  assert.match(ANALGESIA[0].dose, /^10 mg EV/)
})
test('cólica: menor que 5 mm elimina sozinho; sem tansulosina', () => {
  const c = condutaPorTamanho(4)!
  assert.match(c.texto, /eliminação espontânea/)
  assert.equal(c.tansulosina, false)
})
test('cólica: 5 a 10 mm tansulosina; acima de 6 mm urologista na alta (p. 849)', () => {
  assert.equal(condutaPorTamanho(5)!.tansulosina, true)
  assert.doesNotMatch(condutaPorTamanho(6)!.texto, /urologista/)
  assert.match(condutaPorTamanho(7)!.texto, /urologista/)
})
test('cólica: acima de 10 mm avaliação urológica, sem tansulosina', () => {
  const c = condutaPorTamanho(12)!
  assert.match(c.texto, /improvável/)
  assert.equal(c.tansulosina, false)
})
