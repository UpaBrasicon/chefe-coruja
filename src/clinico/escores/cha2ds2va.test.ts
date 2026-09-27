// node --experimental-strip-types --test src/clinico/escores/cha2ds2va.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { cha2ds2va } from './cha2ds2va.ts'

// Respostas pelo índice da opção: idade 0/1/2, demais 0 = Não, 1 = Sim.
const base: Respostas = { idade: 0, ic: 0, has: 0, dm: 0, avc: 0, vasc: 0 }

test('cha2ds2-va: 75 anos + hipertensão + AVC prévio = 5, AVC 7,2% ao ano', () => {
  const r = cha2ds2va.calcular({ ...base, idade: 2, has: 1, avc: 1 })!
  assert.equal(r.valor, '5')
  assert.equal(r.estado, 2)
  assert.match(r.nota, /7,2%/)
})
test('cha2ds2-va: sexo não é item do escore', () => {
  assert.equal(cha2ds2va.itens.some((i) => i.id === 'sexo'), false)
  assert.equal(cha2ds2va.calcular({ ...base, has: 1 })!.valor, '1')
})
test('cha2ds2-va: faixas nos cortes (0→0, 1→1, 2→2)', () => {
  assert.equal(cha2ds2va.calcular(base)!.estado, 0)
  assert.equal(cha2ds2va.calcular({ ...base, idade: 1 })!.estado, 1)
  assert.equal(cha2ds2va.calcular({ ...base, idade: 2 })!.estado, 2)
})
test('cha2ds2-va: máximo é 8', () => {
  const r = cha2ds2va.calcular({ idade: 2, ic: 1, has: 1, dm: 1, avc: 1, vasc: 1 })!
  assert.equal(r.valor, '8')
  assert.match(r.nota, /10,8%/)
})
test('cha2ds2-va: incompleto devolve null', () => {
  assert.equal(cha2ds2va.calcular({ ...base, ic: undefined }), null)
})
test('cha2ds2-va: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(cha2ds2va.ficha.publico, 'adulto')
  assert.ok(cha2ds2va.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(cha2ds2va.ficha), false)
})
