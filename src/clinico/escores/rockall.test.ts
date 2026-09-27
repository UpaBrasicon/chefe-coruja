// node --experimental-strip-types --test src/clinico/escores/rockall.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { rockall } from './rockall.ts'

// idade/choque: índice = pontos; comorb: 0, 1 (=2), 2 (=3).
// diag: 0 sem endoscopia, 1 (=0), 2 (=1), 3 (=2); estigma: 0 sem endoscopia, 1 (=0), 2 (=2).
const r = (idade: number, choque: number, comorb: number, diag = 0, estigma = 0): Respostas => ({ idade, choque, comorb, diag, estigma })

test('rockall clínico: 60–79 anos + taquicardia = 2, sem endoscopia', () => {
  const res = rockall.calcular(r(1, 1, 0))!
  assert.equal(res.rotulo, 'Rockall clínico')
  assert.equal(res.valor, '2')
  assert.equal(res.unidade, 'de 7')
  assert.equal(res.estado, 0)
  assert.match(res.nota, /falta a endoscopia/)
})
test('rockall completo: 80+ + hipotensão + IC + outro diagnóstico + estigma = 2+2+2+1+2 = 9', () => {
  const res = rockall.calcular(r(2, 2, 1, 2, 2))!
  assert.equal(res.rotulo, 'Rockall completo')
  assert.equal(res.valor, '9')
  assert.equal(res.unidade, 'de 11')
})
test('rockall: não exibe mortalidade por ponto enquanto a tabela não for conferida', () => {
  assert.ok(!JSON.stringify(rockall.calcular(r(2, 2, 2, 1, 1))).match(/\d+,\d%/))
})
test('rockall: cortes das faixas (2→0, 3→1, 4→1, 5→2)', () => {
  assert.equal(rockall.calcular(r(2, 0, 0))!.estado, 0)
  assert.equal(rockall.calcular(r(1, 2, 0))!.estado, 1)
  assert.equal(rockall.calcular(r(2, 2, 0))!.estado, 1)
  assert.equal(rockall.calcular(r(2, 0, 2))!.estado, 2)
})
test('rockall: só um item endoscópico preenchido fica clínico, com alerta', () => {
  const res = rockall.calcular(r(0, 0, 0, 3, 0))!
  assert.equal(res.rotulo, 'Rockall clínico')
  assert.equal(res.valor, '0')
  assert.match(res.alerta!, /Só um dos dois/)
})
test('rockall: incompleto devolve null', () => {
  assert.equal(rockall.calcular({ idade: 0, choque: 0, comorb: 0 }), null)
})
test('rockall: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(rockall.ficha.publico, 'adulto')
  assert.ok(rockall.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(rockall.ficha), false)
})
