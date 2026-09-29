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
  assert.equal(res.estado, 1) // escore inicial 2: 5,6% (Tabela IV(A)), fora do baixo risco do artigo
  assert.match(res.nota, /falta a endoscopia/)
})
test('rockall completo: 80+ + hipotensão + IC + outro diagnóstico + estigma = 2+2+2+1+2 = 9', () => {
  const res = rockall.calcular(r(2, 2, 1, 2, 2))!
  assert.equal(res.rotulo, 'Rockall completo')
  assert.equal(res.valor, '9')
  assert.equal(res.unidade, 'de 11')
})
test('rockall .1: mortalidade e ressangramento da Tabela IV(B), p. 319', () => {
  assert.equal(rockall.ficha.versao, '2026-09-28.1')
  const zero = rockall.calcular(r(0, 0, 0, 1, 1))!
  assert.match(zero.nota, /mortalidade observada 0% · ressangramento 4,9%/)
  assert.equal(zero.estado, 0)
  const tres = rockall.calcular(r(1, 0, 0, 3, 1))! // 1 + 2 = 3
  assert.match(tres.nota, /2,9% · ressangramento 11,2%/)
  assert.equal(tres.estado, 1)
  const sete = rockall.calcular(r(2, 2, 0, 2, 2))! // 2+2+0+1+2 = 7
  assert.match(sete.nota, /27,0% · ressangramento 43,8%/)
  const onze = rockall.calcular(r(2, 2, 2, 3, 2))! // 11 → categoria 8+
  assert.equal(onze.valor, '11')
  assert.match(onze.nota, /41,1% · ressangramento 41,8%/)
  assert.match(onze.derivados[0][1], /8 pontos ou mais/)
})
test('rockall .1: escore inicial pela Tabela IV(A); baixo risco do artigo só no 0', () => {
  assert.match(rockall.calcular(r(0, 0, 0))!.nota, /0,2%/)
  assert.equal(rockall.calcular(r(0, 0, 0))!.estado, 0)
  assert.equal(rockall.calcular(r(1, 1, 0))!.estado, 1)
  assert.match(rockall.calcular(r(2, 2, 2))!.nota, /50,0%/)
  assert.match(rockall.calcular(r(2, 2, 1))!.nota, /48,9%/)
})
test('rockall .1: completo 2 é baixo risco do artigo; faixas 3–4/5+ do protótipo saíram', () => {
  assert.equal(rockall.calcular(r(2, 0, 0, 1, 1))!.estado, 0)
  assert.ok(!JSON.stringify(rockall.calcular(r(2, 2, 2, 3, 2))).includes('3 a 4 pontos'))
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
