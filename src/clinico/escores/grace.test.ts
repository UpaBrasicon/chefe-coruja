// node --experimental-strip-types --test src/clinico/escores/grace.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { grace } from './grace.ts'

/** Padrão do protótipo: 65 anos, FC 80, PAS 130, Cr 1,0; Killip I e o resto "Não". */
const base: Respostas = { idade: 65, fc: 80, pas: 130, cr: 1, killip: 0, parada: 0, st: 0, marcador: 0 }

test('grace: padrão do protótipo = 58 + 9 + 34 + 7 = 108, baixo risco', () => {
  const r = grace.calcular(base)!
  assert.equal(r.valor, '108')
  assert.equal(r.estado, 0)
  assert.deepEqual(r.derivados[0], ['Idade', '58 pontos'])
  assert.deepEqual(r.derivados[1], ['Frequência cardíaca', '9 pontos'])
  assert.deepEqual(r.derivados[2], ['Pressão sistólica', '34 pontos'])
  assert.deepEqual(r.derivados[3], ['Creatinina', '7 pontos'])
})
test('grace: corte 109 (intermediário) e 108 (baixo)', () => {
  // 58 (idade 65) + 9 (FC 80) + 24 (PAS 140) + 4 (Cr 0,79) + 14 (marcador) = 109
  const r109 = grace.calcular({ ...base, pas: 140, cr: 0.79, marcador: 1 })!
  assert.equal(r109.valor, '109')
  assert.equal(r109.estado, 1)
  assert.equal(grace.calcular(base)!.estado, 0) // 108
  // creatinina 1,2 dá 10 em vez de 7
  assert.equal(grace.calcular({ ...base, cr: 1.2 })!.valor, '111')
})
test('grace: corte 140 (intermediário) e acima de 140 (alto)', () => {
  // 58 + 9 + 24 (PAS 140) + 7 + ST 28 + marcador 14 = 140
  const r140 = grace.calcular({ ...base, pas: 140, st: 1, marcador: 1 })!
  assert.equal(r140.valor, '140')
  assert.equal(r140.estado, 1)
  // 108 + ST 28 + FC 90 (15 em vez de 9) = 142
  const alto = grace.calcular({ ...base, st: 1, fc: 90 })!
  assert.equal(alto.valor, '142')
  assert.equal(alto.estado, 2)
})
test('grace: limites da tabela são "abaixo de"', () => {
  assert.equal(grace.calcular({ ...base, idade: 69 })!.derivados[0][1], '58 pontos')
  assert.equal(grace.calcular({ ...base, idade: 70 })!.derivados[0][1], '75 pontos')
  assert.equal(grace.calcular({ ...base, pas: 79 })!.derivados[2][1], '58 pontos')
  assert.equal(grace.calcular({ ...base, pas: 200 })!.derivados[2][1], '0 pontos')
  assert.equal(grace.calcular({ ...base, cr: 4 })!.derivados[3][1], '28 pontos')
})
test('grace: seletores somam Killip, parada, ST e marcador', () => {
  const r = grace.calcular({ ...base, killip: 3, parada: 1, st: 1, marcador: 1 })!
  assert.deepEqual(r.derivados[4], ['Killip, parada, ST e marcador', String(59 + 39 + 28 + 14) + ' pontos'])
})
test('grace: incompleto devolve null', () => {
  assert.equal(grace.calcular({ ...base, cr: undefined }), null)
  assert.equal(grace.calcular({ ...base, killip: undefined }), null)
})
test('grace: número fora da faixa devolve null', () => {
  assert.equal(grace.calcular({ ...base, fc: 800 }), null)
  assert.equal(grace.calcular({ ...base, idade: -1 }), null)
  assert.equal(grace.calcular({ ...base, cr: 0 }), null)
})
test('grace: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(grace.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(grace.ficha), false)
})
