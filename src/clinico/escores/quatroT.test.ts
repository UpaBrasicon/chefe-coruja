// node --experimental-strip-types --test src/clinico/escores/quatroT.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { quatroT } from './quatroT.ts'

/** pontos por domínio (a opção de índice 0 vale 2) */
const com = (trombo: number, tempo: number, trombose: number, outras: number) =>
  quatroT.calcular({ trombo: 2 - trombo, tempo: 2 - tempo, trombose: 2 - trombose, outras: 2 - outras })!

test('4t: todos os domínios no máximo = 8, alta, em torno de 64%', () => {
  const r = com(2, 2, 2, 2)
  assert.equal(r.valor, '8')
  assert.equal(r.estado, 2)
  assert.deepEqual(r.derivados[0], ['Probabilidade de HIT na casuística original', 'em torno de 64%'])
})
test('4t: cortes (3→0, 4→1, 5→1, 6→2)', () => {
  assert.equal(com(1, 1, 1, 0).estado, 0)
  assert.equal(com(1, 1, 1, 1).estado, 1)
  assert.equal(com(2, 1, 1, 1).estado, 1)
  assert.equal(com(2, 2, 1, 1).estado, 2)
})
test('4t: unidade no singular com 1 ponto', () => {
  assert.equal(com(1, 0, 0, 0).unidade, 'ponto')
})
test('4t: escore baixo com trombose confirmada tem alerta', () => {
  assert.ok(com(0, 0, 2, 1).alerta)
  assert.equal(com(0, 0, 1, 1).alerta, undefined)
  assert.equal(com(2, 2, 2, 0).alerta, undefined)
})
test('4t: sem conduta no resultado', () => {
  const r = com(2, 2, 2, 2)
  const texto = [r.nota, r.alerta, ...r.derivados.flat(), ...r.cuidados].join(' ')
  assert.doesNotMatch(texto, /suspender|iniciar|anticoagular|varfarina/i)
})
test('4t: incompleto devolve null', () => {
  assert.equal(quatroT.calcular({ trombo: 0, tempo: 0, trombose: 0 }), null)
})
test('4t: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(quatroT.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(quatroT.ficha), false)
})
